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
	if quantity <= 0 {
		return nil, errors.New("quantity must be at least 1")
	}

	// 1. Ambil detail event
	event, err := s.eventRepo.GetEventByID(ctx, eventID)
	if err != nil {
		return nil, err
	}
	if event == nil {
		return nil, errors.New("event not found")
	}

	if event.Status != "active" {
		return nil, fmt.Errorf("event is not active (current status: %s)", event.Status)
	}

	// 2. 🎟️ VALIDASI VIRTUAL WAITING ROOM (Jika ada antrian aktif, cek apakah user punya Checkout Pass)
	totalInQueue, _ := s.redisClient.GetTotalInQueue(ctx, eventID)
	hasPass, _ := s.redisClient.HasCheckoutPass(ctx, eventID, userID)

	if totalInQueue > 0 && !hasPass {
		return nil, errors.New("waiting room is active: please join the waiting room and wait for your turn to checkout")
	}

	// 3. Cek anti-spam / Rate Limiting (Maks 5 request / 10 detik per user)
	allowed, err := s.redisClient.CheckRateLimit(ctx, userID, eventID, 5, 10*time.Second)
	if err != nil {
		return nil, fmt.Errorf("rate limit check failed: %w", err)
	}
	if !allowed {
		return nil, errors.New("too many requests: please slow down")
	}

	// 4. Validasi Max Ticket Per User (Anti-Scalping)
	purchasedCount, err := s.orderRepo.GetUserPurchasedCount(ctx, userID, eventID)
	if err != nil {
		return nil, err
	}
	if purchasedCount+quantity > event.MaxPerUser {
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
		return nil, fmt.Errorf("failed to save order: %w", err)
	}

	// 7. Update available stock di DB
	_ = s.eventRepo.UpdateAvailableStock(ctx, eventID, remainingStock)

	// 8. Audit Logs
	createdPayload := fmt.Sprintf(`{"event_id":"%s","quantity":%d,"total_price":%.2f,"user_id":"%s"}`,
		eventID, quantity, totalPrice, userID)
	_ = s.orderRepo.CreateOrderLog(ctx, createdOrder.ID, "ORDER_CREATED", createdPayload)

	stockPayload := fmt.Sprintf(`{"remaining_stock":%d,"quantity_deducted":%d}`, remainingStock, quantity)
	_ = s.orderRepo.CreateOrderLog(ctx, createdOrder.ID, "STOCK_RESERVED", stockPayload)

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

	// 10. Publish ke RabbitMQ
	payload := worker.OrderMessagePayload{
		OrderID:    createdOrder.ID,
		UserID:     userID,
		EventID:    eventID,
		Quantity:   quantity,
		TotalPrice: totalPrice,
	}

	if err := s.rabbitClient.PublishEvent(ctx, rabbitmq.OrderPendingKey, payload); err != nil {
		fmt.Printf("⚠️ WARNING: Failed to publish to RabbitMQ: %v\n", err)
	}

	return createdOrder, nil
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
