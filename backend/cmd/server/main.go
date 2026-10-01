package main

import (
	"context"
	"encoding/json"
	"fmt"
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
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sejatidimedia/flash_sale_platform/internal/config"
	"github.com/sejatidimedia/flash_sale_platform/internal/graph"
	"github.com/sejatidimedia/flash_sale_platform/internal/middleware"
	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/database"
	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/metrics"
	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/midtrans"
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

	// 🛠️ Auto-Migration: Pastikan kolom category ada di tabel events
	_, _ = dbPool.Exec(context.Background(), "ALTER TABLE events ADD COLUMN IF NOT EXISTS category VARCHAR(100) NOT NULL DEFAULT 'concerts'")

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

	// 🌱 Auto-Seed Default Admin Account (admin@example.com / admin123)
	go func() {
		_, _, err := authService.Register(context.Background(), "Administrator", "admin@example.com", "admin123", "admin")
		if err == nil {
			log.Println("🌱 Default Admin seeded successfully: admin@example.com / admin123")
		}
	}()

	eventRepo := repository.NewEventRepository(dbPool)
	eventService := service.NewEventService(eventRepo, redisClient)

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

	// 🌐 CORS Middleware
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, X-Request-ID")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// 🔍 Pasang Request ID (Trace ID) & Auth Middleware & Prometheus Metrics
	r.Use(middleware.RequestIDMiddleware())
	r.Use(middleware.AuthMiddleware(authService))
	r.Use(metrics.PrometheusMiddleware())

	// Endpoints
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	r.GET("/metrics", gin.WrapH(promhttp.Handler()))
	r.GET("/", playgroundHandler())
	r.POST("/query", graphqlHandler(authService, eventService, checkoutService, orderRepo, eventRepo, redisClient))
	r.GET("/query", graphqlHandler(authService, eventService, checkoutService, orderRepo, eventRepo, redisClient))

	// 💳 Midtrans Payment Gateway Endpoints
	midtransClient := midtrans.NewClient(cfg)

	r.POST("/api/midtrans/snap-token", func(c *gin.Context) {
		var req struct {
			OrderID    string  `json:"order_id" binding:"required"`
			EventID    string  `json:"event_id"`
			EventName  string  `json:"event_name"`
			Quantity   int     `json:"quantity"`
			TotalPrice float64 `json:"total_price" binding:"required"`
			UserName   string  `json:"user_name"`
			UserEmail  string  `json:"user_email"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		snapReq := midtrans.CreateSnapRequest{
			TransactionDetails: midtrans.SnapTransactionDetails{
				OrderID:     req.OrderID,
				GrossAmount: int64(req.TotalPrice),
			},
			CustomerDetails: midtrans.SnapCustomerDetails{
				FirstName: req.UserName,
				Email:     req.UserEmail,
			},
		}

		if req.EventName != "" && req.Quantity > 0 {
			pricePerItem := int64(req.TotalPrice) / int64(req.Quantity)
			snapReq.ItemDetails = []midtrans.SnapItemDetails{
				{
					ID:       req.EventID,
					Price:    pricePerItem,
					Quantity: req.Quantity,
					Name:     req.EventName,
				},
			}
		}

		snapResp, err := midtransClient.CreateSnapTransaction(c.Request.Context(), snapReq)
		if err != nil {
			log.Printf("❌ Failed to create Snap transaction: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, snapResp)
	})

	r.POST("/api/midtrans/webhook", func(c *gin.Context) {
		var notif midtrans.NotificationPayload
		if err := c.ShouldBindJSON(&notif); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		log.Printf("📢 [Midtrans Webhook] OrderID: %s, Status: %s, PaymentType: %s",
			notif.OrderID, notif.TransactionStatus, notif.PaymentType)

		// Settlement or capture indicates successful payment
		if notif.TransactionStatus == "settlement" || notif.TransactionStatus == "capture" {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			_ = orderRepo.UpdateOrderStatus(ctx, notif.OrderID, "CONFIRMED")
			_ = orderRepo.CreateOrderLog(ctx, notif.OrderID, "MIDTRANS_PAYMENT_SETTLED",
				fmt.Sprintf(`{"payment_type":"%s","transaction_id":"%s","gross_amount":"%s"}`,
					notif.PaymentType, notif.TransactionID, notif.GrossAmount))

			// Broadcast via Redis Pub/Sub
			order, _ := orderRepo.GetOrderByID(ctx, notif.OrderID)
			if order != nil {
				if orderBytes, err := json.Marshal(order); err == nil {
					_ = redisClient.PublishMessage(ctx, fmt.Sprintf("order_status:%s", notif.OrderID), string(orderBytes))
				}
			}
		}

		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// 💳 Endpoint konfirmasi pembayaran Midtrans (dipanggil setelah user bayar via Snap / QRIS / VA / Simulasi)
	r.POST("/api/midtrans/confirm-payment", func(c *gin.Context) {
		var req struct {
			OrderID       string `json:"order_id" binding:"required"`
			PaymentType   string `json:"payment_type"`
			TransactionID string `json:"transaction_id"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()

		order, err := orderRepo.GetOrderByID(ctx, req.OrderID)
		if err != nil || order == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
			return
		}

		if order.Status == "CONFIRMED" {
			c.JSON(http.StatusOK, gin.H{"status": "CONFIRMED", "order": order})
			return
		}

		// 1. Update status order menjadi CONFIRMED di PostgreSQL
		if err := orderRepo.UpdateOrderStatus(ctx, req.OrderID, "CONFIRMED"); err != nil {
			log.Printf("❌ Failed to update order status to CONFIRMED: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to confirm order"})
			return
		}

		paymentType := req.PaymentType
		if paymentType == "" {
			paymentType = "midtrans_snap"
		}
		txID := req.TransactionID
		if txID == "" {
			txID = fmt.Sprintf("TX-MID-%d", time.Now().Unix())
		}

		// 2. Audit Log
		_ = orderRepo.CreateOrderLog(ctx, req.OrderID, "MIDTRANS_PAYMENT_CONFIRMED",
			fmt.Sprintf(`{"payment_type":"%s","transaction_id":"%s","status":"CONFIRMED"}`,
				paymentType, txID))

		// 3. Broadcast Real-Time via Redis Pub/Sub
		order.Status = "CONFIRMED"
		if orderBytes, err := json.Marshal(order); err == nil {
			_ = redisClient.PublishMessage(ctx, fmt.Sprintf("order_status:%s", req.OrderID), string(orderBytes))
		}

		// 4. Asynchronous event ke RabbitMQ
		payload := worker.OrderMessagePayload{
			OrderID:    order.ID,
			UserID:     order.UserID,
			EventID:    order.EventID,
			Quantity:   order.Quantity,
			TotalPrice: order.TotalPrice,
		}
		_ = rabbitClient.PublishEvent(ctx, rabbitmq.OrderConfirmedKey, payload)

		log.Printf("🎉 [Midtrans Payment Confirmed] Order %s successfully CONFIRMED! PaymentType: %s",
			order.ID, paymentType)

		c.JSON(http.StatusOK, gin.H{"status": "CONFIRMED", "order": order})
	})

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
