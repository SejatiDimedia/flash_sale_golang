package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/rabbitmq"
	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/redisclient"
	"github.com/sejatidimedia/flash_sale_platform/internal/repository"
	"github.com/sejatidimedia/flash_sale_platform/internal/worker"
)

type CheckoutService interface {
	PurchaseTicket(ctx context.Context, userID, eventID string, quantity int) (*repository.Order, error)
	PurchaseTicketWithIdempotency(ctx context.Context, userID, eventID string, quantity int, idempotencyKey string) (*repository.Order, error)
	CancelExpiredOrders(ctx context.Context, expiryWindow time.Duration) (int, error)
	SyncEventStockToRedis(ctx context.Context, eventID string) error
}

type checkoutService struct {
	orderRepo    repository.OrderRepository
	eventRepo    repository.EventRepository
	redisClient  *redisclient.RedisClient
	rabbitClient *rabbitmq.RabbitMQClient
}

func NewCheckoutService(
	orderRepo repository.OrderRepository,
	eventRepo repository.EventRepository,
	redisClient *redisclient.RedisClient,
	rabbitClient *rabbitmq.RabbitMQClient,
) CheckoutService {
	return &checkoutService{
		orderRepo:    orderRepo,
		eventRepo:    eventRepo,
		redisClient:  redisClient,
		rabbitClient: rabbitClient,
	}
}

func (s *checkoutService) PurchaseTicket(ctx context.Context, userID, eventID string, quantity int) (*repository.Order, error) {
	return s.PurchaseTicketWithIdempotency(ctx, userID, eventID, quantity, "")
}

func (s *checkoutService) PurchaseTicketWithIdempotency(ctx context.Context, userID, eventID string, quantity int, idempotencyKey string) (*repository.Order, error) {
	if quantity <= 0 {
		return nil, errors.New("quantity must be at least 1")
	}

	// 0. 🔑 PENANGANAN IDEMPOTENCY KEY
	if idempotencyKey != "" {
		acquired, err := s.redisClient.AcquireIdempotencyLock(ctx, userID, idempotencyKey, 2*time.Minute)
		if err != nil {
			log.Printf("⚠️ Failed to acquire idempotency lock: %v", err)
		} else if !acquired {
			// Idempotency key sudah pernah dikirim sebelumnya
			// Coba polling status hingga 2 detik jika masih PROCESSING, atau langsung ambil hasil jika sudah tersimpan
			for attempts := 0; attempts < 10; attempts++ {
				val, _ := s.redisClient.GetIdempotencyValue(ctx, userID, idempotencyKey)
				if val != "" && val != "PROCESSING" {
					existingOrder, err := s.orderRepo.GetOrderByID(ctx, val)
					if err == nil && existingOrder != nil {
						return existingOrder, nil
					}
				}
				time.Sleep(100 * time.Millisecond)
			}
			return nil, errors.New("request with this idempotency key is already in progress or completed, please try again")
		}
	}

	// 1. Ambil detail event
	event, err := s.eventRepo.GetEventByID(ctx, eventID)
	if err != nil {
		if idempotencyKey != "" {
			_ = s.redisClient.ReleaseIdempotencyLock(ctx, userID, idempotencyKey)
		}
		return nil, err
	}
	if event == nil {
		if idempotencyKey != "" {
			_ = s.redisClient.ReleaseIdempotencyLock(ctx, userID, idempotencyKey)
		}
		return nil, errors.New("event not found")
	}

	if event.Status != "active" {
		if idempotencyKey != "" {
			_ = s.redisClient.ReleaseIdempotencyLock(ctx, userID, idempotencyKey)
		}
		return nil, fmt.Errorf("event is not active (current status: %s)", event.Status)
	}

	// 2. 🎟️ VALIDASI VIRTUAL WAITING ROOM (Jika mode Surge Queue Gate aktif, user WAJIB memiliki pass)
	gateMode, _ := s.redisClient.GetGateMode(ctx, eventID)
	hasPass, _ := s.redisClient.HasCheckoutPass(ctx, eventID, userID)

	if gateMode == "MANUAL" && !hasPass {
		if idempotencyKey != "" {
			_ = s.redisClient.ReleaseIdempotencyLock(ctx, userID, idempotencyKey)
		}
		return nil, errors.New("surge queue is active: you must wait in the virtual waiting room and be admitted before checking out")
	}

	// Jika mode AUTO, pastikan pass tersedia atau buatkan pass instan
	if gateMode == "AUTO" && !hasPass {
		_ = s.redisClient.GrantCheckoutPass(ctx, eventID, userID, 5*time.Minute)
	}

	// 3. Cek anti-spam / Rate Limiting (Maks 5 request / 10 detik per user)
	allowed, err := s.redisClient.CheckRateLimit(ctx, userID, eventID, 5, 10*time.Second)
	if err != nil {
		if idempotencyKey != "" {
			_ = s.redisClient.ReleaseIdempotencyLock(ctx, userID, idempotencyKey)
		}
		return nil, fmt.Errorf("rate limit check failed: %w", err)
	}
	if !allowed {
		if idempotencyKey != "" {
			_ = s.redisClient.ReleaseIdempotencyLock(ctx, userID, idempotencyKey)
		}
		return nil, errors.New("too many requests: please slow down")
	}

	// 4. Validasi Max Ticket Per User (Anti-Scalping)
	purchasedCount, err := s.orderRepo.GetUserPurchasedCount(ctx, userID, eventID)
	if err != nil {
		if idempotencyKey != "" {
			_ = s.redisClient.ReleaseIdempotencyLock(ctx, userID, idempotencyKey)
		}
		return nil, err
	}
	if purchasedCount+quantity > event.MaxPerUser {
		if idempotencyKey != "" {
			_ = s.redisClient.ReleaseIdempotencyLock(ctx, userID, idempotencyKey)
		}
		return nil, fmt.Errorf("purchase exceeds max ticket limit (%d allowed per user, you already have %d)", event.MaxPerUser, purchasedCount)
	}

	// 5. ATOMIC DECREMENT STOK DI REDIS (Zero-Oversell Guaranteed)
	remainingStock, err := s.redisClient.DecrStockAtomic(ctx, eventID, quantity)
	if err != nil {
		// Jika error karena key belum diinisialisasi di Redis, inisialisasi SEKALI dari DB lalu coba lagi
		if err.Error() == "event stock is not initialized in cache" {
			_ = s.redisClient.InitStock(ctx, eventID, event.AvailableStock)
			remainingStock, err = s.redisClient.DecrStockAtomic(ctx, eventID, quantity)
		}

		// Jika tetap error (misal "sold out"), tolak langsung!
		if err != nil {
			if idempotencyKey != "" {
				_ = s.redisClient.ReleaseIdempotencyLock(ctx, userID, idempotencyKey)
			}
			return nil, err
		}
	}

	totalPrice := event.Price * float64(quantity)

	// 6. Simpan Order PENDING
	order := &repository.Order{
		UserID:     userID,
		EventID:    eventID,
		Quantity:   quantity,
		TotalPrice: totalPrice,
		Status:     "PENDING",
	}

	createdOrder, err := s.orderRepo.CreateOrder(ctx, order)
	if err != nil {
		_ = s.redisClient.IncrStock(ctx, eventID, quantity)
		if idempotencyKey != "" {
			_ = s.redisClient.ReleaseIdempotencyLock(ctx, userID, idempotencyKey)
		}
		return nil, fmt.Errorf("failed to save order: %w", err)
	}

	// 7. Update available stock di DB secara relatif (mencegah out-of-order overwrite)
	if dbStockErr := s.eventRepo.DeductAvailableStock(ctx, eventID, quantity); dbStockErr != nil {
		log.Printf("⚠️ DB DeductAvailableStock warning (fallback to remainingStock): %v", dbStockErr)
		_ = s.eventRepo.UpdateAvailableStock(ctx, eventID, remainingStock)
	}

	// 8. Audit Logs
	createdPayload := fmt.Sprintf(`{"event_id":"%s","quantity":%d,"total_price":%.2f,"user_id":"%s"}`,
		eventID, quantity, totalPrice, userID)
	_ = s.orderRepo.CreateOrderLog(ctx, createdOrder.ID, "ORDER_CREATED", createdPayload)

	stockPayload := fmt.Sprintf(`{"remaining_stock":%d,"quantity_deducted":%d}`, remainingStock, quantity)
	_ = s.orderRepo.CreateOrderLog(ctx, createdOrder.ID, "STOCK_RESERVED", stockPayload)

	// 🎟️ KONSUMSI CHECKOUT PASS (Single-Use Token)
	_ = s.redisClient.DeleteCheckoutPass(ctx, eventID, userID)

	// 9. 🔴 REAL-TIME BROADCAST: Broadcast sisa stok ke Redis Pub/Sub
	event.AvailableStock = remainingStock
	if eventBytes, err := json.Marshal(event); err == nil {
		pubCtx, pubCancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer pubCancel()
		if pubErr := s.redisClient.PublishMessage(pubCtx, fmt.Sprintf("stock_updated:%s", eventID), string(eventBytes)); pubErr != nil {
			log.Printf("❌ Failed to broadcast stock update: %v", pubErr)
		} else {
			log.Printf("📢 [Redis Pub/Sub] Broadcasted stock update for event %s (Remaining: %d)", eventID, remainingStock)
		}
	}

	// 10. Publish ke RabbitMQ (Dengan Zero-Stock-Leak Rollback)
	payload := worker.OrderMessagePayload{
		OrderID:    createdOrder.ID,
		UserID:     userID,
		EventID:    eventID,
		Quantity:   quantity,
		TotalPrice: totalPrice,
	}

	if err := s.rabbitClient.PublishEvent(ctx, rabbitmq.OrderPendingKey, payload); err != nil {
		log.Printf("❌ [Checkout FAILED] RabbitMQ publish failed: %v. Rolling back stock...", err)
		// Rollback stok di Redis
		_ = s.redisClient.IncrStock(ctx, eventID, quantity)
		// Rollback stok di DB
		_ = s.eventRepo.RestoreAvailableStock(ctx, eventID, quantity)
		// Update status order menjadi FAILED
		_ = s.orderRepo.UpdateOrderStatus(ctx, createdOrder.ID, "FAILED")
		_ = s.orderRepo.CreateOrderLog(ctx, createdOrder.ID, "ORDER_FAILED", fmt.Sprintf(`{"reason":"broker_publish_failure","error":%q}`, err.Error()))

		if idempotencyKey != "" {
			_ = s.redisClient.ReleaseIdempotencyLock(ctx, userID, idempotencyKey)
		}
		return nil, fmt.Errorf("failed to process order due to queue broker failure, stock has been restored: %w", err)
	}

	// 11. Simpan hasil sukses ke Idempotency key
	if idempotencyKey != "" {
		_ = s.redisClient.SaveIdempotencyResult(ctx, userID, idempotencyKey, createdOrder.ID, 24*time.Hour)
	}

	return createdOrder, nil
}

// CancelExpiredOrders membatalkan order PENDING yang melebihi batas waktu (reservasi kedaluwarsa) dan melepaskan stok
func (s *checkoutService) CancelExpiredOrders(ctx context.Context, expiryWindow time.Duration) (int, error) {
	if expiryWindow <= 0 {
		expiryWindow = 10 * time.Minute
	}

	expiredOrders, err := s.orderRepo.GetExpiredPendingOrders(ctx, expiryWindow)
	if err != nil {
		return 0, fmt.Errorf("failed to fetch expired pending orders: %w", err)
	}

	cancelledCount := 0
	for _, order := range expiredOrders {
		// Update status order menjadi CANCELLED
		if err := s.orderRepo.UpdateOrderStatus(ctx, order.ID, "CANCELLED"); err != nil {
			log.Printf("⚠️ Failed to cancel expired order %s: %v", order.ID, err)
			continue
		}

		// Kembalikan stok ke Redis
		_ = s.redisClient.IncrStock(ctx, order.EventID, order.Quantity)

		// Kembalikan stok ke PostgreSQL
		_ = s.eventRepo.RestoreAvailableStock(ctx, order.EventID, order.Quantity)

		// Log audit trail
		_ = s.orderRepo.CreateOrderLog(ctx, order.ID, "RESERVATION_EXPIRED",
			fmt.Sprintf(`{"released_quantity":%d,"reason":"payment_timeout"}`, order.Quantity))

		// Broadcast stock update via Redis Pub/Sub
		if event, err := s.eventRepo.GetEventByID(ctx, order.EventID); err == nil && event != nil {
			cachedStock, _ := s.redisClient.GetStock(ctx, order.EventID)
			event.AvailableStock = cachedStock
			if eventBytes, err := json.Marshal(event); err == nil {
				_ = s.redisClient.PublishMessage(ctx, fmt.Sprintf("stock_updated:%s", order.EventID), string(eventBytes))
			}
		}

		cancelledCount++
		log.Printf("♻️ [Reservation Expired] Released %d tickets for order %s (Event: %s)", order.Quantity, order.ID, order.EventID)
	}

	return cancelledCount, nil
}

func (s *checkoutService) SyncEventStockToRedis(ctx context.Context, eventID string) error {
	event, err := s.eventRepo.GetEventByID(ctx, eventID)
	if err != nil {
		return err
	}
	if event == nil {
		return errors.New("event not found")
	}

	return s.redisClient.InitStock(ctx, eventID, event.AvailableStock)
}
