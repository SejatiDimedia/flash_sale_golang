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

// OutboxEvent merepresentasikan event yang disimpan secara atomik bersama order (Transactional Outbox Pattern)
type OutboxEvent struct {
	ID            string     `json:"id"`
	AggregateType string     `json:"aggregate_type"`
	AggregateID   string     `json:"aggregate_id"`
	EventType     string     `json:"event_type"`
	Payload       string     `json:"payload"`
	Status        string     `json:"status"` // PENDING, PUBLISHED, FAILED
	RetryCount    int        `json:"retry_count"`
	CreatedAt     time.Time  `json:"created_at"`
	ProcessedAt   *time.Time `json:"processed_at"`
}

type OrderRepository interface {
	CreateOrder(ctx context.Context, order *Order) (*Order, error)
	CreateOrderWithOutbox(ctx context.Context, order *Order, outbox *OutboxEvent) (*Order, *OutboxEvent, error)
	GetPendingOutboxEvents(ctx context.Context, limit int) ([]*OutboxEvent, error)
	MarkOutboxEventPublished(ctx context.Context, id string) error
	MarkOutboxEventFailed(ctx context.Context, id string, maxRetries int) error
	GetOrderByID(ctx context.Context, id string) (*Order, error)
	GetOrdersByUserID(ctx context.Context, userID string) ([]*Order, error)
	GetAllOrders(ctx context.Context, eventID *string) ([]*Order, error)
	UpdateOrderStatus(ctx context.Context, id string, status string) error
	GetUserPurchasedCount(ctx context.Context, userID, eventID string) (int, error)
	CreateOrderLog(ctx context.Context, orderID, eventType, payloadJSON string) error
	GetOrderLogsByOrderID(ctx context.Context, orderID string) ([]*OrderLog, error)
	GetConfirmedTicketCount(ctx context.Context, eventID string) (int, error)
	GetExpiredPendingOrders(ctx context.Context, olderThan time.Duration) ([]*Order, error)
	HasRecentOrders(ctx context.Context, eventID string, within time.Duration) (bool, error)
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

	res, err := r.db.Exec(ctx, query, status, id)
	if err != nil {
		return err
	}

	// ⚠️ Jika tidak ada baris yang ter-update (Order ID tidak ada di DB), lempar error!
	if res.RowsAffected() == 0 {
		return fmt.Errorf("order with id %s not found in database", id)
	}

	return nil
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

// GetExpiredPendingOrders mengambil semua order yang masih PENDING melewati batas waktu tertentu
func (r *orderRepository) GetExpiredPendingOrders(ctx context.Context, olderThan time.Duration) ([]*Order, error) {
	threshold := time.Now().Add(-olderThan)
	query := `
		SELECT id, user_id, event_id, quantity, total_price, status, created_at, confirmed_at
		FROM orders
		WHERE status = 'PENDING' AND created_at < $1
		ORDER BY created_at ASC
	`
	rows, err := r.db.Query(ctx, query, threshold)
	if err != nil {
		return nil, fmt.Errorf("failed to get expired pending orders: %w", err)
	}
	defer rows.Close()

	var orders []*Order
	for rows.Next() {
		var o Order
		if err := rows.Scan(
			&o.ID, &o.UserID, &o.EventID, &o.Quantity,
			&o.TotalPrice, &o.Status, &o.CreatedAt, &o.ConfirmedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan expired order: %w", err)
		}
		orders = append(orders, &o)
	}

	return orders, nil
}

// HasRecentOrders memeriksa apakah ada pesanan yang dibuat dalam jendela durasi tertentu
func (r *orderRepository) HasRecentOrders(ctx context.Context, eventID string, within time.Duration) (bool, error) {
	threshold := time.Now().Add(-within)
	query := `SELECT EXISTS(SELECT 1 FROM orders WHERE event_id = $1 AND created_at >= $2)`
	var exists bool
	err := r.db.QueryRow(ctx, query, eventID, threshold).Scan(&exists)
	if err != nil {
		return false, err
	}
	return exists, nil
}

// CreateOrderWithOutbox menyimpan pesanan dan event outbox dalam satu transaksi SQL ACID tunggal (US-15)
func (r *orderRepository) CreateOrderWithOutbox(ctx context.Context, o *Order, outbox *OutboxEvent) (*Order, *OutboxEvent, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to begin tx for order and outbox: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. Simpan order
	orderQuery := `
		INSERT INTO orders (user_id, event_id, quantity, total_price, status)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, user_id, event_id, quantity, total_price, status, created_at, confirmed_at
	`
	var createdOrder Order
	err = tx.QueryRow(ctx, orderQuery, o.UserID, o.EventID, o.Quantity, o.TotalPrice, o.Status).Scan(
		&createdOrder.ID, &createdOrder.UserID, &createdOrder.EventID, &createdOrder.Quantity,
		&createdOrder.TotalPrice, &createdOrder.Status, &createdOrder.CreatedAt, &createdOrder.ConfirmedAt,
	)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to insert order in tx: %w", err)
	}

	// 2. Simpan outbox event
	outboxQuery := `
		INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, status)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, aggregate_type, aggregate_id, event_type, payload, status, retry_count, created_at, processed_at
	`
	aggID := createdOrder.ID
	if outbox.AggregateID != "" {
		aggID = outbox.AggregateID
	}
	status := "PENDING"
	if outbox.Status != "" {
		status = outbox.Status
	}

	var createdOutbox OutboxEvent
	err = tx.QueryRow(ctx, outboxQuery, outbox.AggregateType, aggID, outbox.EventType, outbox.Payload, status).Scan(
		&createdOutbox.ID, &createdOutbox.AggregateType, &createdOutbox.AggregateID, &createdOutbox.EventType,
		&createdOutbox.Payload, &createdOutbox.Status, &createdOutbox.RetryCount, &createdOutbox.CreatedAt, &createdOutbox.ProcessedAt,
	)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to insert outbox event in tx: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, nil, fmt.Errorf("failed to commit order and outbox transaction: %w", err)
	}

	return &createdOrder, &createdOutbox, nil
}

// GetPendingOutboxEvents mengambil sejumlah event outbox yang belum terkirim ke message broker
func (r *orderRepository) GetPendingOutboxEvents(ctx context.Context, limit int) ([]*OutboxEvent, error) {
	if limit <= 0 {
		limit = 50
	}

	query := `
		SELECT id, aggregate_type, aggregate_id, event_type, payload, status, retry_count, created_at, processed_at
		FROM outbox_events
		WHERE status = 'PENDING'
		ORDER BY created_at ASC
		LIMIT $1
	`

	rows, err := r.db.Query(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query pending outbox events: %w", err)
	}
	defer rows.Close()

	var events []*OutboxEvent
	for rows.Next() {
		var e OutboxEvent
		if err := rows.Scan(
			&e.ID, &e.AggregateType, &e.AggregateID, &e.EventType,
			&e.Payload, &e.Status, &e.RetryCount, &e.CreatedAt, &e.ProcessedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan outbox event: %w", err)
		}
		events = append(events, &e)
	}

	return events, rows.Err()
}

// MarkOutboxEventPublished menandai bahwa event outbox sukses dikirimkan ke RabbitMQ
func (r *orderRepository) MarkOutboxEventPublished(ctx context.Context, id string) error {
	query := `
		UPDATE outbox_events
		SET status = 'PUBLISHED', processed_at = NOW()
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

// MarkOutboxEventFailed menaikkan counter percobaan pengiriman event dan menandai FAILED jika melebihi batas
func (r *orderRepository) MarkOutboxEventFailed(ctx context.Context, id string, maxRetries int) error {
	if maxRetries <= 0 {
		maxRetries = 3
	}
	query := `
		UPDATE outbox_events
		SET retry_count = retry_count + 1,
		    status = CASE WHEN retry_count + 1 >= $2 THEN 'FAILED' ELSE 'PENDING' END,
		    processed_at = CASE WHEN retry_count + 1 >= $2 THEN NOW() ELSE processed_at END
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query, id, maxRetries)
	return err
}

