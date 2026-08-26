package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Event struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	Description    *string   `json:"description"`
	StartSaleAt    time.Time `json:"start_sale_at"`
	EndSaleAt      time.Time `json:"end_sale_at"`
	TotalStock     int       `json:"total_stock"`
	AvailableStock int       `json:"available_stock"`
	Price          float64   `json:"price"`
	Status         string    `json:"status"`   // draft, scheduled, active, closed
	Category       string    `json:"category"` // concerts, festivals, cinema, sports, social
	MaxPerUser     int       `json:"max_per_user"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type EventRepository interface {
	CreateEvent(ctx context.Context, event *Event) (*Event, error)
	UpdateEvent(ctx context.Context, event *Event) (*Event, error)
	GetEventByID(ctx context.Context, id string) (*Event, error)
	ListEvents(ctx context.Context, status *string) ([]*Event, error)
	UpdateAvailableStock(ctx context.Context, id string, newStock int) error
}

type eventRepository struct {
	db *pgxpool.Pool
}

func NewEventRepository(db *pgxpool.Pool) EventRepository {
	return &eventRepository{db: db}
}

func (r *eventRepository) CreateEvent(ctx context.Context, e *Event) (*Event, error) {
	if e.Category == "" {
		e.Category = "concerts"
	}

	query := `
		INSERT INTO events (name, description, start_sale_at, end_sale_at, total_stock, available_stock, price, status, max_per_user, category)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, name, description, start_sale_at, end_sale_at, total_stock, available_stock, price, status, max_per_user, category, created_at, updated_at
	`

	var created Event
	err := r.db.QueryRow(ctx, query,
		e.Name, e.Description, e.StartSaleAt, e.EndSaleAt, e.TotalStock, e.TotalStock, e.Price, e.Status, e.MaxPerUser, e.Category,
	).Scan(
		&created.ID, &created.Name, &created.Description, &created.StartSaleAt, &created.EndSaleAt,
		&created.TotalStock, &created.AvailableStock, &created.Price, &created.Status, &created.MaxPerUser,
		&created.Category, &created.CreatedAt, &created.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create event: %w", err)
	}

	return &created, nil
}

func (r *eventRepository) UpdateEvent(ctx context.Context, e *Event) (*Event, error) {
	if e.Category == "" {
		e.Category = "concerts"
	}

	query := `
		UPDATE events
		SET name = $1, description = $2, start_sale_at = $3, end_sale_at = $4,
		    total_stock = $5, price = $6, status = $7, max_per_user = $8, category = $9, updated_at = NOW()
		WHERE id = $10
		RETURNING id, name, description, start_sale_at, end_sale_at, total_stock, available_stock, price, status, max_per_user, category, created_at, updated_at
	`

	var updated Event
	err := r.db.QueryRow(ctx, query,
		e.Name, e.Description, e.StartSaleAt, e.EndSaleAt, e.TotalStock, e.Price, e.Status, e.MaxPerUser, e.Category, e.ID,
	).Scan(
		&updated.ID, &updated.Name, &updated.Description, &updated.StartSaleAt, &updated.EndSaleAt,
		&updated.TotalStock, &updated.AvailableStock, &updated.Price, &updated.Status, &updated.MaxPerUser,
		&updated.Category, &updated.CreatedAt, &updated.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update event: %w", err)
	}

	return &updated, nil
}

func (r *eventRepository) GetEventByID(ctx context.Context, id string) (*Event, error) {
	query := `
		SELECT id, name, description, start_sale_at, end_sale_at, total_stock, available_stock, price, status, max_per_user, category, created_at, updated_at
		FROM events
		WHERE id = $1
	`

	var e Event
	err := r.db.QueryRow(ctx, query, id).Scan(
		&e.ID, &e.Name, &e.Description, &e.StartSaleAt, &e.EndSaleAt,
		&e.TotalStock, &e.AvailableStock, &e.Price, &e.Status, &e.MaxPerUser,
		&e.Category, &e.CreatedAt, &e.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get event: %w", err)
	}

	return &e, nil
}

func (r *eventRepository) ListEvents(ctx context.Context, status *string) ([]*Event, error) {
	var rows pgx.Rows
	var err error

	if status != nil && *status != "" {
		query := `
			SELECT id, name, description, start_sale_at, end_sale_at, total_stock, available_stock, price, status, max_per_user, category, created_at, updated_at
			FROM events
			WHERE status = $1
			ORDER BY start_sale_at ASC
		`
		rows, err = r.db.Query(ctx, query, *status)
	} else {
		query := `
			SELECT id, name, description, start_sale_at, end_sale_at, total_stock, available_stock, price, status, max_per_user, category, created_at, updated_at
			FROM events
			ORDER BY start_sale_at ASC
		`
		rows, err = r.db.Query(ctx, query)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to list events: %w", err)
	}
	defer rows.Close()

	var events []*Event
	for rows.Next() {
		var e Event
		if err := rows.Scan(
			&e.ID, &e.Name, &e.Description, &e.StartSaleAt, &e.EndSaleAt,
			&e.TotalStock, &e.AvailableStock, &e.Price, &e.Status, &e.MaxPerUser,
			&e.Category, &e.CreatedAt, &e.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan event row: %w", err)
		}
		events = append(events, &e)
	}

	return events, nil
}

func (r *eventRepository) UpdateAvailableStock(ctx context.Context, id string, newStock int) error {
	query := `UPDATE events SET available_stock = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.Exec(ctx, query, newStock, id)
	return err
}
