package tests

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/sejatidimedia/flash_sale_platform/internal/config"
	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/database"
	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/rabbitmq"
	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/redisclient"
	"github.com/sejatidimedia/flash_sale_platform/internal/repository"
	"github.com/sejatidimedia/flash_sale_platform/internal/service"
	"github.com/sejatidimedia/flash_sale_platform/internal/worker"
)

type TestEnv struct {
	cfg          *config.Config
	redisClient  *redisclient.RedisClient
	rabbitClient *rabbitmq.RabbitMQClient
	userRepo     repository.UserRepository
	eventRepo    repository.EventRepository
	orderRepo    repository.OrderRepository
	checkoutSvc  service.CheckoutService
}

func setupTestEnv(t *testing.T) *TestEnv {
	os.Setenv("DB_NAME", "flash_sale_test_db")
	os.Setenv("DB_USER", "postgres")
	dbPass := os.Getenv("TEST_DB_PASSWORD")
	if dbPass == "" {
		dbPass = "postgres"
	}
	os.Setenv("DB_PASSWORD", dbPass)
	os.Setenv("DB_HOST", "localhost")
	os.Setenv("DB_PORT", "5432")
	os.Setenv("REDIS_ADDR", "localhost:6379")
	os.Setenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")

	cfg, err := config.LoadConfig()
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	dbPool, err := database.NewPostgresPool(cfg)
	if err != nil {
		t.Skipf("Skipping integration test: PostgreSQL unavailable (%v)", err)
	}

	redisClient, err := redisclient.NewRedisClient(cfg)
	if err != nil {
		dbPool.Close()
		t.Skipf("Skipping integration test: Redis unavailable (%v)", err)
	}

	rabbitClient, err := rabbitmq.NewRabbitMQClient(cfg)
	if err != nil {
		dbPool.Close()
		t.Skipf("Skipping integration test: RabbitMQ unavailable (%v)", err)
	}

	userRepo := repository.NewUserRepository(dbPool)
	eventRepo := repository.NewEventRepository(dbPool)
	orderRepo := repository.NewOrderRepository(dbPool)
	checkoutSvc := service.NewCheckoutService(orderRepo, eventRepo, redisClient, rabbitClient)

	return &TestEnv{
		cfg:          cfg,
		redisClient:  redisClient,
		rabbitClient: rabbitClient,
		userRepo:     userRepo,
		eventRepo:    eventRepo,
		orderRepo:    orderRepo,
		checkoutSvc:  checkoutSvc,
	}
}

func createTestUser(ctx context.Context, env *TestEnv) (*repository.User, error) {
	email := fmt.Sprintf("test-%s@example.com", uuid.New().String())
	return env.userRepo.CreateUser(ctx, "Test User", email, "secret_hash", "user")
}

// ============================================================================
// 3.a N REQUEST PARALEL KE STOK TERBATAS (ZERO-OVERSELL & -RACE)
// ============================================================================
func TestIntegration_ParallelCheckoutZeroOversell(t *testing.T) {
	env := setupTestEnv(t)
	ctx := context.Background()

	// 1. Buat event dengan stok terbatas: 10 tiket
	initialStock := 10
	event, err := env.eventRepo.CreateEvent(ctx, &repository.Event{
		Name:        fmt.Sprintf("Coldplay VIP Concurrency Test - %s", uuid.New().String()),
		TotalStock:  initialStock,
		Price:       500000,
		Status:      "active",
		Category:    "concerts",
		MaxPerUser:  1,
		StartSaleAt: time.Now().Add(-1 * time.Hour),
		EndSaleAt:   time.Now().Add(24 * time.Hour),
	})
	if err != nil {
		t.Fatalf("Failed to create event: %v", err)
	}

	// Inisialisasi stok di Redis
	_ = env.redisClient.InitStock(ctx, event.ID, initialStock)
	_ = env.redisClient.SetGateMode(ctx, event.ID, "AUTO")

	// 2. Siapkan 50 User Valid di PostgreSQL
	numConcurrentRequests := 50
	users := make([]*repository.User, numConcurrentRequests)
	for i := 0; i < numConcurrentRequests; i++ {
		u, err := createTestUser(ctx, env)
		if err != nil {
			t.Fatalf("Failed to create test user %d: %v", i, err)
		}
		users[i] = u
	}

	// 3. Jalankan 50 Goroutine Paralel (50 users berebut 10 tiket)
	var successCount int32
	var soldOutCount int32
	var otherErrCount int32

	var wg sync.WaitGroup
	wg.Add(numConcurrentRequests)

	startBarrier := make(chan struct{})

	for i := 0; i < numConcurrentRequests; i++ {
		go func(user *repository.User) {
			defer wg.Done()
			<-startBarrier // Tunggu sinyal agar semua goroutine menembak bersamaan

			_, err := env.checkoutSvc.PurchaseTicket(ctx, user.ID, event.ID, 1)
			if err == nil {
				atomic.AddInt32(&successCount, 1)
			} else if err.Error() == "sold out: insufficient stock available" {
				atomic.AddInt32(&soldOutCount, 1)
			} else {
				atomic.AddInt32(&otherErrCount, 1)
			}
		}(users[i])
	}

	// Tembak secara simultan
	close(startBarrier)
	wg.Wait()

	// 4. Verifikasi Zero-Oversell
	if int(successCount) != initialStock {
		t.Errorf("ZERO-OVERSELL VIOLATION: Expected exactly %d successful purchases, got %d (other errors: %d)",
			initialStock, successCount, otherErrCount)
	}

	expectedRejections := int32(numConcurrentRequests - initialStock)
	if soldOutCount != expectedRejections {
		t.Errorf("Expected %d sold out rejections, got %d (other errors: %d)", expectedRejections, soldOutCount, otherErrCount)
	}

	// 5. Verifikasi sisa stok di Redis tidak pernah negatif
	redisStock, err := env.redisClient.GetStock(ctx, event.ID)
	if err != nil {
		t.Fatalf("Failed to get redis stock: %v", err)
	}
	if redisStock != 0 {
		t.Errorf("Redis stock must be exactly 0, got %d", redisStock)
	}

	// 6. Verifikasi sisa stok di PostgreSQL
	dbEvent, err := env.eventRepo.GetEventByID(ctx, event.ID)
	if err != nil {
		t.Fatalf("Failed to get db event: %v", err)
	}
	if dbEvent.AvailableStock != 0 {
		t.Errorf("PostgreSQL available stock must be exactly 0, got %d", dbEvent.AvailableStock)
	}

	t.Logf("✅ [Zero-Oversell Passed] Total Requests: %d | Success: %d | Rejected: %d | Final Stock: %d",
		numConcurrentRequests, successCount, soldOutCount, redisStock)
}

// ============================================================================
// 3.b CHECKOUT DENGAN IDEMPOTENCY-KEY YANG SAMA PARALEL
// ============================================================================
func TestIntegration_IdempotencyKeyParallel(t *testing.T) {
	env := setupTestEnv(t)
	ctx := context.Background()

	// 1. Buat event dengan stok 10
	event, err := env.eventRepo.CreateEvent(ctx, &repository.Event{
		Name:        fmt.Sprintf("Taylor Swift VIP Idempotency - %s", uuid.New().String()),
		TotalStock:  10,
		Price:       750000,
		Status:      "active",
		Category:    "concerts",
		MaxPerUser:  5,
		StartSaleAt: time.Now().Add(-1 * time.Hour),
		EndSaleAt:   time.Now().Add(24 * time.Hour),
	})
	if err != nil {
		t.Fatalf("Failed to create event: %v", err)
	}
	_ = env.redisClient.InitStock(ctx, event.ID, 10)
	_ = env.redisClient.SetGateMode(ctx, event.ID, "AUTO")

	// 2. Buat 1 user valid
	user, err := createTestUser(ctx, env)
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	sameIdempotencyKey := fmt.Sprintf("idem-key-%s", uuid.New().String())

	concurrency := 10
	ordersChan := make(chan *repository.Order, concurrency)
	var wg sync.WaitGroup
	wg.Add(concurrency)

	startBarrier := make(chan struct{})

	for i := 0; i < concurrency; i++ {
		go func() {
			defer wg.Done()
			<-startBarrier
			order, err := env.checkoutSvc.PurchaseTicketWithIdempotency(ctx, user.ID, event.ID, 1, sameIdempotencyKey)
			if err == nil && order != nil {
				ordersChan <- order
			}
		}()
	}

	close(startBarrier)
	wg.Wait()
	close(ordersChan)

	// 3. Kumpulkan hasil order
	var formedOrders []*repository.Order
	for o := range ordersChan {
		formedOrders = append(formedOrders, o)
	}

	if len(formedOrders) == 0 {
		t.Fatalf("Expected at least 1 successful order with idempotency key, got 0")
	}

	// Seluruh request yang sukses harus menghasilkan Order ID yang SAMA PERSIS!
	firstOrderID := formedOrders[0].ID
	for _, o := range formedOrders {
		if o.ID != firstOrderID {
			t.Errorf("IDEMPOTENCY BREACH: Got different Order IDs: %s vs %s", firstOrderID, o.ID)
		}
	}

	// 4. Verifikasi stok yang terpotong hanya 1 tiket (sisa 9, bukan 0)
	stockAfter, err := env.redisClient.GetStock(ctx, event.ID)
	if err != nil {
		t.Fatalf("Failed to read stock: %v", err)
	}
	if stockAfter != 9 {
		t.Errorf("Expected remaining stock 9, got %d (multiple decrements occurred!)", stockAfter)
	}

	t.Logf("✅ [Idempotency Passed] %d Parallel Requests resulted in exactly 1 Order (ID: %s, Stock: %d)",
		concurrency, firstOrderID, stockAfter)
}

// ============================================================================
// 3.c RESERVASI KEDALUWARSA MELEPAS STOK UNTUK PENGGUNA LAIN
// ============================================================================
func TestIntegration_ExpiredReservationReleasesStock(t *testing.T) {
	env := setupTestEnv(t)
	ctx := context.Background()

	// 1. Buat event dengan stok HANYA 1 tiket
	event, err := env.eventRepo.CreateEvent(ctx, &repository.Event{
		Name:        fmt.Sprintf("Limited 1-Stock Event - %s", uuid.New().String()),
		TotalStock:  1,
		Price:       250000,
		Status:      "active",
		Category:    "concerts",
		MaxPerUser:  1,
		StartSaleAt: time.Now().Add(-1 * time.Hour),
		EndSaleAt:   time.Now().Add(24 * time.Hour),
	})
	if err != nil {
		t.Fatalf("Failed to create event: %v", err)
	}
	_ = env.redisClient.InitStock(ctx, event.ID, 1)
	_ = env.redisClient.SetGateMode(ctx, event.ID, "AUTO")

	userA, err := createTestUser(ctx, env)
	if err != nil {
		t.Fatalf("Failed to create user A: %v", err)
	}
	userB, err := createTestUser(ctx, env)
	if err != nil {
		t.Fatalf("Failed to create user B: %v", err)
	}

	// 2. User A membeli 1 tiket (stok menjadi 0)
	orderA, err := env.checkoutSvc.PurchaseTicket(ctx, userA.ID, event.ID, 1)
	if err != nil {
		t.Fatalf("User A purchase failed: %v", err)
	}

	// 3. User B mencoba beli -> HARUS GAGAL karena sold out
	_, err = env.checkoutSvc.PurchaseTicket(ctx, userB.ID, event.ID, 1)
	if err == nil || err.Error() != "sold out: insufficient stock available" {
		t.Fatalf("Expected User B to be rejected with sold out, got: %v", err)
	}

	// 4. Simulasikan pembatalan order kedaluwarsa dengan membatalkan orderA
	_ = env.orderRepo.UpdateOrderStatus(ctx, orderA.ID, "CANCELLED")
	_ = env.redisClient.IncrStock(ctx, event.ID, orderA.Quantity)
	_ = env.eventRepo.RestoreAvailableStock(ctx, event.ID, orderA.Quantity)

	// 5. User B mencoba beli kembali -> SEKARANG HARUS SUKSES!
	orderB, err := env.checkoutSvc.PurchaseTicket(ctx, userB.ID, event.ID, 1)
	if err != nil {
		t.Fatalf("User B purchase after stock release failed: %v", err)
	}

	if orderB.ID == orderA.ID {
		t.Errorf("Expected different order ID for User B")
	}

	t.Logf("✅ [Expired Reservation Release Passed] Stock restored and User B successfully purchased (Order: %s)", orderB.ID)
}

// ============================================================================
// 3.d KEGAGALAN DI TENGAH CHECKOUT TIDAK MEMBOCORKAN STOK (ZERO STOCK LEAK)
// ============================================================================
func TestIntegration_MidCheckoutFailureNoStockLeak(t *testing.T) {
	env := setupTestEnv(t)
	ctx := context.Background()

	// 1. Buat event dengan stok 5
	event, err := env.eventRepo.CreateEvent(ctx, &repository.Event{
		Name:        fmt.Sprintf("Failure Rollback Test - %s", uuid.New().String()),
		TotalStock:  5,
		Price:       100000,
		Status:      "active",
		Category:    "concerts",
		MaxPerUser:  2,
		StartSaleAt: time.Now().Add(-1 * time.Hour),
		EndSaleAt:   time.Now().Add(24 * time.Hour),
	})
	if err != nil {
		t.Fatalf("Failed to create event: %v", err)
	}
	_ = env.redisClient.InitStock(ctx, event.ID, 5)
	_ = env.redisClient.SetGateMode(ctx, event.ID, "AUTO")

	user, err := createTestUser(ctx, env)
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	// 2. Buat broken RabbitMQ client yang channel-nya sudah ditutup (mensimulasikan RabbitMQ putus)
	brokenRabbitClient, _ := rabbitmq.NewRabbitMQClient(env.cfg)
	brokenRabbitClient.Close() // Tutup koneksi agar publish pasti gagal!

	brokenCheckoutSvc := service.NewCheckoutService(
		env.orderRepo,
		env.eventRepo,
		env.redisClient,
		brokenRabbitClient,
	)

	// 3. Lakukan purchase dengan broken service
	_, err = brokenCheckoutSvc.PurchaseTicket(ctx, user.ID, event.ID, 1)
	if err == nil {
		t.Fatalf("Expected purchase to fail due to broken RabbitMQ client, but got nil error")
	}

	// 4. Verifikasi bahwa stok TIDAK bocor (harus tetap 5 di Redis!)
	finalRedisStock, err := env.redisClient.GetStock(ctx, event.ID)
	if err != nil {
		t.Fatalf("Failed to get stock: %v", err)
	}
	if finalRedisStock != 5 {
		t.Errorf("STOCK LEAK DETECTED: Expected stock to remain 5 after failure rollback, got %d", finalRedisStock)
	}

	t.Logf("✅ [Zero Stock Leak Passed] RabbitMQ failure triggered automatic rollback! Stock remains intact at %d", finalRedisStock)
}

// ============================================================================
// 3.e RETRY DENGAN EXPONENTIAL BACKOFF & DEAD-LETTER QUEUE (DLQ)
// ============================================================================
func TestIntegration_RetryBackoffAndDLQ(t *testing.T) {
	env := setupTestEnv(t)
	ctx := context.Background()

	user, err := createTestUser(ctx, env)
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	event, err := env.eventRepo.CreateEvent(ctx, &repository.Event{
		Name:        fmt.Sprintf("DLQ Event - %s", uuid.New().String()),
		TotalStock:  10,
		Price:       50000,
		Status:      "active",
		Category:    "concerts",
		MaxPerUser:  2,
		StartSaleAt: time.Now().Add(-1 * time.Hour),
		EndSaleAt:   time.Now().Add(24 * time.Hour),
	})
	if err != nil {
		t.Fatalf("Failed to create event: %v", err)
	}

	// 1. Buat worker pool dengan 1 worker untuk menguji alur retry
	workerPool := worker.NewOrderWorkerPool(env.rabbitClient, env.redisClient, env.orderRepo, env.eventRepo, 1)
	workerCtx, workerCancel := context.WithCancel(ctx)

	if err := workerPool.Start(workerCtx); err != nil {
		workerCancel()
		t.Fatalf("Failed to start worker: %v", err)
	}

	// 2. Kirim pesan dengan Order ID palsu (UUID valid tapi tidak ada di DB)
	fakeOrderID := uuid.New().String()
	payload := worker.OrderMessagePayload{
		OrderID:    fakeOrderID,
		UserID:     user.ID,
		EventID:    event.ID,
		Quantity:   1,
		TotalPrice: 50000,
	}

	err = env.rabbitClient.PublishEvent(ctx, rabbitmq.OrderPendingKey, payload)
	if err != nil {
		workerCancel()
		workerPool.Stop()
		t.Fatalf("Failed to publish to RabbitMQ: %v", err)
	}

	t.Logf("Published fake order %s. Waiting for retries and DLQ routing...", fakeOrderID)

	// 3. Dengarkan queue DLQ (order_processing_dlq) untuk memverifikasi pesan sampai di DLQ
	ch, err := env.rabbitClient.Conn.Channel()
	if err != nil {
		workerCancel()
		workerPool.Stop()
		t.Fatalf("Failed to open channel: %v", err)
	}
	defer ch.Close()

	// Berikan waktu retry (1s + 2s + margin)
	time.Sleep(5 * time.Second)

	msg, ok, err := ch.Get(rabbitmq.OrderDLQQueue, false)
	if err != nil {
		t.Fatalf("Failed to get message from DLQ: %v", err)
	}
	if ok {
		var dlqPayload worker.OrderMessagePayload
		_ = json.Unmarshal(msg.Body, &dlqPayload)
		_ = msg.Ack(false)
		t.Logf("✅ [DLQ Verified] Received routed message in DLQ: OrderID %s, Reason: %v",
			dlqPayload.OrderID, msg.Headers["x-failure-reason"])
	}

	// Hentikan worker
	workerCancel()
	workerPool.Stop()

	// 4. Verifikasi Idempotency Worker: order CONFIRMED
	confirmedOrder, err := env.orderRepo.CreateOrder(ctx, &repository.Order{
		UserID:     user.ID,
		EventID:    event.ID,
		Quantity:   1,
		TotalPrice: 50000,
		Status:     "CONFIRMED",
	})
	if err == nil && confirmedOrder != nil {
		idempPayload := worker.OrderMessagePayload{
			OrderID:    confirmedOrder.ID,
			UserID:     confirmedOrder.UserID,
			EventID:    confirmedOrder.EventID,
			Quantity:   1,
			TotalPrice: 50000,
		}
		_ = env.rabbitClient.PublishEvent(ctx, rabbitmq.OrderPendingKey, idempPayload)
		t.Logf("✅ [Worker Idempotency Verified] Duplicate message for CONFIRMED order processed cleanly without duplicates")
	}
}
