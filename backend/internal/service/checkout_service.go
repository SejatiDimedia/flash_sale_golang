package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/redisclient"
	"github.com/sejatidimedia/flash_sale_platform/internal/repository"
)

type CheckoutService interface {
	PurchaseTicket(ctx context.Context, userID, eventID string, quantity int) (*repository.Order, error)
	SyncEventStockToRedis(ctx context.Context, eventID string) error
}

type checkoutService struct {
	orderRepo   repository.OrderRepository
	eventRepo   repository.EventRepository
	redisClient *redisclient.RedisClient
}

func NewCheckoutService(
	orderRepo repository.OrderRepository,
	eventRepo repository.EventRepository,
	redisClient *redisclient.RedisClient,
) CheckoutService {
	return &checkoutService{
		orderRepo:   orderRepo,
		eventRepo:   eventRepo,
		redisClient: redisClient,
	}
}

func (s *checkoutService) PurchaseTicket(ctx context.Context, userID, eventID string, quantity int) (*repository.Order, error) {
	if quantity <= 0 {
		return nil, errors.New("quantity must be at least 1")
	}

	// 1. Ambil detail event dari database
	event, err := s.eventRepo.GetEventByID(ctx, eventID)
	if err != nil {
		return nil, err
	}
	if event == nil {
		return nil, errors.New("event not found")
	}

	// 2. Validasi status event
	if event.Status != "active" {
		return nil, fmt.Errorf("event is not active (current status: %s)", event.Status)
	}

	// 3. Cek anti-spam / Rate Limiting (Maksimal 5 request per 10 detik per user)
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

	// 5. ATOMIC DECREMENT STOK DI REDIS
	// Jika stok belum ada di Redis, inisialisasi dulu dari database
	cachedStock, _ := s.redisClient.GetStock(ctx, eventID)
	if cachedStock == 0 && event.AvailableStock > 0 {
		_ = s.redisClient.InitStock(ctx, eventID, event.AvailableStock)
	}

	remainingStock, err := s.redisClient.DecrStockAtomic(ctx, eventID, quantity)
	if err != nil {
		return nil, err // Misal: "sold out: insufficient stock available"
	}

	totalPrice := event.Price * float64(quantity)

	// 6. Buat Record Order
	order := &repository.Order{
		UserID:     userID,
		EventID:    eventID,
		Quantity:   quantity,
		TotalPrice: totalPrice,
		Status:     "CONFIRMED", // Pada Step 6 nanti akan diubah menjadi PENDING -> RabbitMQ
	}

	createdOrder, err := s.orderRepo.CreateOrder(ctx, order)
	if err != nil {
		// Jika insert DB gagal, rollback stok di Redis!
		_ = s.redisClient.IncrStock(ctx, eventID, quantity)
		return nil, fmt.Errorf("failed to save order: %w", err)
	}

	// Update available stock di DB
	_ = s.eventRepo.UpdateAvailableStock(ctx, eventID, remainingStock)

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
