package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/extension"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/gin-gonic/gin"
	"github.com/sejatidimedia/flash_sale_platform/internal/config"
	"github.com/sejatidimedia/flash_sale_platform/internal/graph"
	"github.com/sejatidimedia/flash_sale_platform/internal/middleware"
	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/database"
	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/rabbitmq"
	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/redisclient"
	"github.com/sejatidimedia/flash_sale_platform/internal/repository"
	"github.com/sejatidimedia/flash_sale_platform/internal/service"
	"github.com/sejatidimedia/flash_sale_platform/internal/worker"
)

func graphqlHandler(
	authService service.AuthService,
	eventService service.EventService,
	checkoutService service.CheckoutService,
	orderRepo repository.OrderRepository,
	eventRepo repository.EventRepository,
	redisClient *redisclient.RedisClient,
) gin.HandlerFunc {
	srv := handler.New(
		graph.NewExecutableSchema(
			graph.Config{
				Resolvers: &graph.Resolver{
					AuthService:     authService,
					EventService:    eventService,
					CheckoutService: checkoutService,
					OrderRepo:       orderRepo,
					EventRepo:       eventRepo,
					RedisClient:     redisClient,
				},
			},
		),
	)

	// 🔴 AKTIFKAN TRANSPORTS: POST, GET & WEBSOCKET SUBSCRIPTION
	srv.AddTransport(transport.POST{})
	srv.AddTransport(transport.GET{})
	srv.AddTransport(transport.Websocket{
		KeepAlivePingInterval: 10 * time.Second,
	})
	srv.Use(extension.Introspection{})

	return func(c *gin.Context) {
		srv.ServeHTTP(c.Writer, c.Request)
	}
}

func playgroundHandler() gin.HandlerFunc {
	h := playground.Handler("GraphQL Playground", "/query")
	return func(c *gin.Context) {
		h.ServeHTTP(c.Writer, c.Request)
	}
}

func main() {
	// 1. Load config dari .env
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// 2. Inisialisasi Database Connection Pool
	dbPool, err := database.NewPostgresPool(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer dbPool.Close()

	// 3. Inisialisasi Redis Client
	redisClient, err := redisclient.NewRedisClient(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}

	// 4. Inisialisasi RabbitMQ Client
	rabbitClient, err := rabbitmq.NewRabbitMQClient(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to RabbitMQ: %v", err)
	}
	defer rabbitClient.Close()

	// 5. Inisialisasi Repositories & Services
	userRepo := repository.NewUserRepository(dbPool)
	authService := service.NewAuthService(userRepo, cfg)

	eventRepo := repository.NewEventRepository(dbPool)
	eventService := service.NewEventService(eventRepo)

	orderRepo := repository.NewOrderRepository(dbPool)
	checkoutService := service.NewCheckoutService(orderRepo, eventRepo, redisClient, rabbitClient)

	// 6. Start Worker Pool
	workerCtx, workerCancel := context.WithCancel(context.Background())
	workerPool := worker.NewOrderWorkerPool(rabbitClient, redisClient, orderRepo, eventRepo, 10)

	if err := workerPool.Start(workerCtx); err != nil {
		log.Fatalf("Failed to start worker pool: %v", err)
	}

	// ⚖️ Start Reconciliation Worker (Audit konsistensi setiap 1 menit)
	reconciliationWorker := worker.NewReconciliationWorker(eventRepo, orderRepo, redisClient, 1*time.Minute)
	reconciliationWorker.Start(workerCtx)

	// 7. Setup Router Gin
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()

	// Pasang Auth Middleware ke semua request
	r.Use(middleware.AuthMiddleware(authService))

	// Endpoints
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	r.GET("/", playgroundHandler())
	r.POST("/query", graphqlHandler(authService, eventService, checkoutService, orderRepo, eventRepo, redisClient))
	r.GET("/query", graphqlHandler(authService, eventService, checkoutService, orderRepo, eventRepo, redisClient))

	// 8. Graceful Shutdown Setup
	srv := &http.Server{
		Addr:    ":" + cfg.ServerPort,
		Handler: r,
	}

	go func() {
		log.Printf("🚀 Server ready at http://localhost:%s/", cfg.ServerPort)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to run server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("🛑 Shutting down server...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	workerCancel()
	workerPool.Stop()

	log.Println("✅ Server & Workers shut down gracefully. Goodbye!")
}
