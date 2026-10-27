package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/sejatidimedia/flash_sale_platform/internal/config"
	"github.com/sejatidimedia/flash_sale_platform/internal/handler"
	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/database"
	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/midtrans"
	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/rabbitmq"
	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/redisclient"
	"github.com/sejatidimedia/flash_sale_platform/internal/repository"
	"github.com/sejatidimedia/flash_sale_platform/internal/service"
	"github.com/sejatidimedia/flash_sale_platform/internal/worker"
)

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
	reconciliationWorker := worker.NewReconciliationWorker(checkoutService, eventRepo, orderRepo, redisClient, 1*time.Minute)
	reconciliationWorker.Start(workerCtx)

	// 📦 Start Transactional Outbox Relay Worker (Guaranteed Delivery ke RabbitMQ setiap 1 detik - US-15)
	outboxWorker := worker.NewOutboxWorker(orderRepo, rabbitClient, 1*time.Second, 50)
	outboxWorker.Start(workerCtx)

	// 7. Setup Handlers & Centralized Router
	midtransClient := midtrans.NewClient(cfg)
	midtransHandler := handler.NewMidtransHandler(midtransClient, orderRepo, redisClient, rabbitClient)

	router := handler.SetupRouter(handler.RouterDependencies{
		Config:          cfg,
		AuthService:     authService,
		EventService:    eventService,
		CheckoutService: checkoutService,
		OrderRepo:       orderRepo,
		EventRepo:       eventRepo,
		RedisClient:     redisClient,
		MidtransHandler: midtransHandler,
	})

	// 8. Graceful Shutdown Setup
	srv := &http.Server{
		Addr:    ":" + cfg.ServerPort,
		Handler: router,
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
	outboxWorker.Wait()

	log.Println("✅ Server & Workers shut down gracefully. Goodbye!")
}
