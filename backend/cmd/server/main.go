package main

import (
	"log"
	"net/http"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/gin-gonic/gin"
	"github.com/sejatidimedia/flash_sale_platform/internal/config"
	"github.com/sejatidimedia/flash_sale_platform/internal/graph"
	"github.com/sejatidimedia/flash_sale_platform/internal/middleware"
	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/database"
	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/redisclient"
	"github.com/sejatidimedia/flash_sale_platform/internal/repository"
	"github.com/sejatidimedia/flash_sale_platform/internal/service"
)

func graphqlHandler(
	authService service.AuthService,
	eventService service.EventService,
	checkoutService service.CheckoutService,
	orderRepo repository.OrderRepository,
) gin.HandlerFunc {
	srv := handler.NewDefaultServer(
		graph.NewExecutableSchema(
			graph.Config{
				Resolvers: &graph.Resolver{
					AuthService:     authService,
					EventService:    eventService,
					CheckoutService: checkoutService,
					OrderRepo:       orderRepo,
				},
			},
		),
	)

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

	// 4. Inisialisasi Repositories & Services
	userRepo := repository.NewUserRepository(dbPool)
	authService := service.NewAuthService(userRepo, cfg)

	eventRepo := repository.NewEventRepository(dbPool)
	eventService := service.NewEventService(eventRepo)

	orderRepo := repository.NewOrderRepository(dbPool)
	checkoutService := service.NewCheckoutService(orderRepo, eventRepo, redisClient)

	// 5. Setup Router Gin
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
	r.POST("/query", graphqlHandler(authService, eventService, checkoutService, orderRepo))
	r.GET("/query", graphqlHandler(authService, eventService, checkoutService, orderRepo))

	log.Printf("🚀 Server ready at http://localhost:%s/", cfg.ServerPort)

	if err := r.Run(":" + cfg.ServerPort); err != nil {
		log.Fatalf("Failed to run server: %v", err)
	}
}
