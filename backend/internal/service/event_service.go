package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/redisclient"
	"github.com/sejatidimedia/flash_sale_platform/internal/repository"
	"golang.org/x/sync/singleflight"
)

type CreateEventRequest struct {
	Name        string
	Description *string
	StartSaleAt time.Time
	EndSaleAt   time.Time
	TotalStock  int
	Price       float64
	Status      string
	Category    string
	MaxPerUser  int
}

type UpdateEventRequest struct {
	ID          string
	Name        string
	Description *string
	StartSaleAt time.Time
	EndSaleAt   time.Time
	TotalStock  int
	Price       float64
	Status      string
	Category    string
	MaxPerUser  int
}

type EventService interface {
	CreateEvent(ctx context.Context, actorRole string, req CreateEventRequest) (*repository.Event, error)
	UpdateEvent(ctx context.Context, actorRole string, req UpdateEventRequest) (*repository.Event, error)
	GetEventByID(ctx context.Context, id string) (*repository.Event, error)
	ListEvents(ctx context.Context, status *string) ([]*repository.Event, error)
}

type eventService struct {
	eventRepo   repository.EventRepository
	redisClient *redisclient.RedisClient
	sfGroup     singleflight.Group
}

func NewEventService(eventRepo repository.EventRepository, redisClient *redisclient.RedisClient) EventService {
	return &eventService{
		eventRepo:   eventRepo,
		redisClient: redisClient,
	}
}

func (s *eventService) CreateEvent(ctx context.Context, actorRole string, req CreateEventRequest) (*repository.Event, error) {
	// 1. Cek Admin Authorization
	if actorRole != "admin" {
		return nil, errors.New("forbidden: only admin can create events")
	}

	// 2. Validasi Input
	if req.Name == "" {
		return nil, errors.New("event name is required")
	}
	if req.TotalStock <= 0 {
		return nil, errors.New("total stock must be greater than 0")
	}
	if req.Price < 0 {
		return nil, errors.New("price cannot be negative")
	}
	if req.EndSaleAt.Before(req.StartSaleAt) {
		return nil, errors.New("endSaleAt must be after startSaleAt")
	}
	if req.MaxPerUser <= 0 {
		req.MaxPerUser = 1
	}
	if req.Status == "" {
		req.Status = "draft"
	}
	if req.Category == "" {
		req.Category = "concerts"
	}

	event := &repository.Event{
		Name:        req.Name,
		Description: req.Description,
		StartSaleAt: req.StartSaleAt,
		EndSaleAt:   req.EndSaleAt,
		TotalStock:  req.TotalStock,
		Price:       req.Price,
		Status:      req.Status,
		Category:    req.Category,
		MaxPerUser:  req.MaxPerUser,
	}

	created, err := s.eventRepo.CreateEvent(ctx, event)
	if err != nil {
		return nil, err
	}

	// 3. Inisialisasi stok langsung di Redis cache agar zero-delay saat flash sale dimulai
	if s.redisClient != nil {
		_ = s.redisClient.InitStock(ctx, created.ID, created.TotalStock)
	}

	return created, nil
}

func (s *eventService) UpdateEvent(ctx context.Context, actorRole string, req UpdateEventRequest) (*repository.Event, error) {
	// 1. Cek Admin Authorization
	if actorRole != "admin" {
		return nil, errors.New("forbidden: only admin can update events")
	}

	// 2. Cek apakah event ada
	existing, err := s.eventRepo.GetEventByID(ctx, req.ID)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, errors.New("event not found")
	}

	if req.Category == "" {
		req.Category = existing.Category
	}
	if req.Category == "" {
		req.Category = "concerts"
	}

	// Hitung perubahan stok jika totalStock diubah
	soldCount := existing.TotalStock - existing.AvailableStock
	if soldCount < 0 {
		soldCount = 0
	}
	newAvailableStock := req.TotalStock - soldCount
	if newAvailableStock < 0 {
		newAvailableStock = 0
	}

	event := &repository.Event{
		ID:             req.ID,
		Name:           req.Name,
		Description:    req.Description,
		StartSaleAt:    req.StartSaleAt,
		EndSaleAt:      req.EndSaleAt,
		TotalStock:     req.TotalStock,
		AvailableStock: newAvailableStock,
		Price:          req.Price,
		Status:         req.Status,
		Category:       req.Category,
		MaxPerUser:     req.MaxPerUser,
	}

	updated, err := s.eventRepo.UpdateEvent(ctx, event)
	if err != nil {
		return nil, err
	}

	if s.redisClient != nil {
		_ = s.redisClient.SetStock(ctx, updated.ID, newAvailableStock)
		// Invalidate cache event detail agar data segar langsung dimuat
		if s.redisClient.Client != nil {
			_ = s.redisClient.Client.Del(ctx, fmt.Sprintf("event:detail:%s", updated.ID)).Err()
		}
	}

	return updated, nil
}

// GetEventByID mengambil detail event dengan proteksi ganda:
// 1. Cache Redis (TTL 30 detik)
// 2. Cache Stampede (Dogpiling) Protection via golang.org/x/sync/singleflight
func (s *eventService) GetEventByID(ctx context.Context, id string) (*repository.Event, error) {
	// 1. Coba ambil dari Cache Redis jika tersedia
	if s.redisClient != nil {
		if cachedEvent, err := s.getEventFromCache(ctx, id); err == nil && cachedEvent != nil {
			// Sinkronkan sisa stok realtime dari redis atomic counter
			if stock, err := s.redisClient.GetStock(ctx, id); err == nil {
				cachedEvent.AvailableStock = stock
			}
			return cachedEvent, nil
		}
	}

	// 2. Proteksi Cache Stampede dengan singleflight.Group:
	// Jika ribuan goroutine memanggil GetEventByID(id) di saat bersamaan (misal saat cache miss),
	// HANYA 1 pemanggilan database yang dieksekusi. Hasilnya dibagikan bersama ke semua pemanggil.
	v, err, _ := s.sfGroup.Do(fmt.Sprintf("event:%s", id), func() (interface{}, error) {
		event, err := s.eventRepo.GetEventByID(ctx, id)
		if err != nil {
			return nil, err
		}
		if event == nil {
			return nil, errors.New("event not found")
		}

		// Simpan hasil ke Cache Redis dengan TTL 30 detik
		if s.redisClient != nil {
			_ = s.setEventToCache(ctx, event, 30*time.Second)
		}

		return event, nil
	})

	if err != nil {
		return nil, err
	}

	event, ok := v.(*repository.Event)
	if !ok || event == nil {
		return nil, errors.New("event not found")
	}

	// Buat shallow copy agar aman dari race condition antar-goroutine pemanggil
	eventCopy := *event
	if s.redisClient != nil {
		if stock, err := s.redisClient.GetStock(ctx, id); err == nil {
			eventCopy.AvailableStock = stock
		}
	}

	return &eventCopy, nil
}

// ListEvents mengambil daftar event dengan proteksi deduplikasi query via singleflight
func (s *eventService) ListEvents(ctx context.Context, status *string) ([]*repository.Event, error) {
	key := "list_events:all"
	if status != nil {
		key = "list_events:" + *status
	}

	v, err, _ := s.sfGroup.Do(key, func() (interface{}, error) {
		events, err := s.eventRepo.ListEvents(ctx, status)
		if err != nil {
			return nil, err
		}

		// Sinkronkan stok terkini dari Redis counter
		if s.redisClient != nil {
			for _, ev := range events {
				if stock, err := s.redisClient.GetStock(ctx, ev.ID); err == nil {
					ev.AvailableStock = stock
				}
			}
		}

		return events, nil
	})

	if err != nil {
		return nil, err
	}

	events, ok := v.([]*repository.Event)
	if !ok {
		return nil, errors.New("failed to cast events from singleflight")
	}

	return events, nil
}

func (s *eventService) getEventFromCache(ctx context.Context, id string) (*repository.Event, error) {
	if s.redisClient == nil || s.redisClient.Client == nil {
		return nil, errors.New("redis client not available")
	}
	key := fmt.Sprintf("event:detail:%s", id)
	val, err := s.redisClient.Client.Get(ctx, key).Result()
	if err != nil {
		return nil, err
	}
	var ev repository.Event
	if err := json.Unmarshal([]byte(val), &ev); err != nil {
		return nil, err
	}
	return &ev, nil
}

func (s *eventService) setEventToCache(ctx context.Context, ev *repository.Event, ttl time.Duration) error {
	if s.redisClient == nil || s.redisClient.Client == nil {
		return nil
	}
	key := fmt.Sprintf("event:detail:%s", ev.ID)
	data, err := json.Marshal(ev)
	if err != nil {
		return err
	}
	return s.redisClient.Client.Set(ctx, key, string(data), ttl).Err()
}
