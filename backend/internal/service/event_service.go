package service

import (
	"context"
	"errors"
	"time"

	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/redisclient"
	"github.com/sejatidimedia/flash_sale_platform/internal/repository"
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
}

func NewEventService(eventRepo repository.EventRepository, redisClient *redisclient.RedisClient) EventService {
	return &eventService{eventRepo: eventRepo, redisClient: redisClient}
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
	}

	return updated, nil
}

func (s *eventService) GetEventByID(ctx context.Context, id string) (*repository.Event, error) {
	event, err := s.eventRepo.GetEventByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if event == nil {
		return nil, errors.New("event not found")
	}
	return event, nil
}

func (s *eventService) ListEvents(ctx context.Context, status *string) ([]*repository.Event, error) {
	return s.eventRepo.ListEvents(ctx, status)
}
