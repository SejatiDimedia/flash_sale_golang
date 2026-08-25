package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Order struct {
	ID          string     `json:"id"`
	UserID      string     `json:"user_id"`
	EventID     string     `json:"event_id"`
	Quantity    int        `json:"quantity"`
	TotalPrice  float64    `json:"total_price"`
	Status      string     `json:"status"` // PENDING, CONFIRMED, FAILED, CANCELLED
	CreatedAt   time.Time  `json:"created_at"`
	ConfirmedAt *time.Time `json:"confirmed_at"`
}

type OrderLog struct {
	ID        int64     `json:"id"`
	OrderID   string    `json:"order_id"`
	EventType string    `json:"event_type"` // ORDER_CREATED, STOCK_RESERVED, ORDER_CONFIRMED, ORDER_FAILED
	Payload   string    `json:"payload"`
	CreatedAt time.Time `json:"created_at"`
}

type OrderRepository interface {
	CreateOrder(ctx context.Context, order *Order) (*Order, error)
	GetOrderByID(ctx context.Context, id string) (*Order, error)
	GetOrdersByUserID(ctx context.Context, userID string) ([]*Order, error)
	GetAllOrders(ctx context.Context, eventID *string) ([]*Order, error)
	UpdateOrderStatus(ctx context.Context, id string, status string) error
	GetUserPurchasedCount(ctx context.Context, userID, eventID string) (int, error)
	CreateOrderLog(ctx context.Context, orderID, eventType, payloadJSON string) error
	GetOrderLogsByOrderID(ctx context.Context, orderID string) ([]*OrderLog, error)
	GetConfirmedTicketCount(ctx context.Context, eventID string) (int, error) // 👈 Tambahkan ini
}

type orderRepository struct {
	db *pgxpool.Pool
}

func NewOrderRepository(db *pgxpool.Pool) OrderRepository {
	return &orderRepository{db: db}
}

func (r *orderRepository) CreateOrder(ctx context.Context, o *Order) (*Order, error) {
	query := `
		INSERT INTO orders (user_id, event_id, quantity, total_price, status)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, user_id, event_id, quantity, total_price, status, created_at, confirmed_at
	`

	var created Order
	err := r.db.QueryRow(ctx, query, o.UserID, o.EventID, o.Quantity, o.TotalPrice, o.Status).Scan(
		&created.ID, &created.UserID, &created.EventID, &created.Quantity,
		&created.TotalPrice, &created.Status, &created.CreatedAt, &created.ConfirmedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create order: %w", err)
	}

	return &created, nil
}

func (r *orderRepository) GetOrderByID(ctx context.Context, id string) (*Order, error) {
	query := `
		SELECT id, user_id, event_id, quantity, total_price, status, created_at, confirmed_at
		FROM orders
		WHERE id = $1
	`

	var o Order
	err := r.db.QueryRow(ctx, query, id).Scan(
		&o.ID, &o.UserID, &o.EventID, &o.Quantity,
		&o.TotalPrice, &o.Status, &o.CreatedAt, &o.ConfirmedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get order by id: %w", err)
	}

	return &o, nil
}

func (r *orderRepository) GetOrdersByUserID(ctx context.Context, userID string) ([]*Order, error) {
	query := `
		SELECT id, user_id, event_id, quantity, total_price, status, created_at, confirmed_at
		FROM orders
		WHERE user_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user orders: %w", err)
	}
	defer rows.Close()

	var orders []*Order
	for rows.Next() {
		var o Order
		if err := rows.Scan(
			&o.ID, &o.UserID, &o.EventID, &o.Quantity,
			&o.TotalPrice, &o.Status, &o.CreatedAt, &o.ConfirmedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan order: %w", err)
		}
		orders = append(orders, &o)
	}

	return orders, nil
}

func (r *orderRepository) GetAllOrders(ctx context.Context, eventID *string) ([]*Order, error) {
	var rows pgx.Rows
	var err error

	if eventID != nil && *eventID != "" {
		query := `
			SELECT id, user_id, event_id, quantity, total_price, status, created_at, confirmed_at
			FROM orders
			WHERE event_id = $1
			ORDER BY created_at DESC
		`
		rows, err = r.db.Query(ctx, query, *eventID)
	} else {
		query := `
			SELECT id, user_id, event_id, quantity, total_price, status, created_at, confirmed_at
			FROM orders
			ORDER BY created_at DESC
		`
		rows, err = r.db.Query(ctx, query)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to get all orders: %w", err)
	}
	defer rows.Close()

	var orders []*Order
	for rows.Next() {
		var o Order
		if err := rows.Scan(
			&o.ID, &o.UserID, &o.EventID, &o.Quantity,
			&o.TotalPrice, &o.Status, &o.CreatedAt, &o.ConfirmedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan order: %w", err)
		}
		orders = append(orders, &o)
	}

	return orders, nil
}

func (r *orderRepository) UpdateOrderStatus(ctx context.Context, id string, status string) error {
	var query string
	if status == "CONFIRMED" {
		query = `UPDATE orders SET status = $1, confirmed_at = NOW() WHERE id = $2`
	} else {
		query = `UPDATE orders SET status = $1 WHERE id = $2`
	}

	_, err := r.db.Exec(ctx, query, status, id)
	return err
}

func (r *orderRepository) GetUserPurchasedCount(ctx context.Context, userID, eventID string) (int, error) {
	query := `
		SELECT COALESCE(SUM(quantity), 0)
		FROM orders
		WHERE user_id = $1 AND event_id = $2 AND status IN ('PENDING', 'CONFIRMED')
	`

	var count int
	err := r.db.QueryRow(ctx, query, userID, eventID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count purchased tickets: %w", err)
	}

	return count, nil
}

func (r *orderRepository) CreateOrderLog(ctx context.Context, orderID, eventType, payloadJSON string) error {
	query := `
		INSERT INTO order_logs (order_id, event_type, payload)
		VALUES ($1, $2, $3::jsonb)
	`
	_, err := r.db.Exec(ctx, query, orderID, eventType, payloadJSON)
	return err
}

func (r *orderRepository) GetOrderLogsByOrderID(ctx context.Context, orderID string) ([]*OrderLog, error) {
	query := `
		SELECT id, order_id, event_type, payload::text, created_at
		FROM order_logs
		WHERE order_id = $1
		ORDER BY created_at ASC
	`

	rows, err := r.db.Query(ctx, query, orderID)
	if err != nil {
		return nil, fmt.Errorf("failed to get order logs: %w", err)
	}
	defer rows.Close()

	var logs []*OrderLog
	for rows.Next() {
		var l OrderLog
		if err := rows.Scan(&l.ID, &l.OrderID, &l.EventType, &l.Payload, &l.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan order log: %w", err)
		}
		logs = append(logs, &l)
	}

	return logs, nil
}

// GetConfirmedTicketCount menghitung jumlah total tiket yang sah CONFIRMED untuk sebuah event
func (r *orderRepository) GetConfirmedTicketCount(ctx context.Context, eventID string) (int, error) {
	query := `
		SELECT COALESCE(SUM(quantity), 0)
		FROM orders
		WHERE event_id = $1 AND status IN ('PENDING', 'CONFIRMED')
	`

	var totalConfirmed int
	err := r.db.QueryRow(ctx, query, eventID).Scan(&totalConfirmed)
	if err != nil {
		return 0, fmt.Errorf("failed to calculate reserved tickets: %w", err)
	}

	return totalConfirmed, nil
}
