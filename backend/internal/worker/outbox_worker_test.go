package worker_test

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/sejatidimedia/flash_sale_platform/internal/repository"
	"github.com/sejatidimedia/flash_sale_platform/internal/worker"
	"github.com/stretchr/testify/assert"
)

// mockPublisher mencatat pengiriman event ke RabbitMQ
type mockPublisher struct {
	mu        sync.Mutex
	published map[string][]interface{}
	err       error
}

func newMockPublisher() *mockPublisher {
	return &mockPublisher{
		published: make(map[string][]interface{}),
	}
}

func (m *mockPublisher) PublishEvent(ctx context.Context, routingKey string, payload interface{}) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.err != nil {
		return m.err
	}
	m.published[routingKey] = append(m.published[routingKey], payload)
	return nil
}

// mockOrderRepoOutbox memalsukan operasi outbox di database
type mockOrderRepoOutbox struct {
	mu             sync.Mutex
	pendingEvents  []*repository.OutboxEvent
	publishedIDs   []string
	failedIDs      []string
}

func (m *mockOrderRepoOutbox) CreateOrder(ctx context.Context, order *repository.Order) (*repository.Order, error) {
	return order, nil
}

func (m *mockOrderRepoOutbox) CreateOrderWithOutbox(ctx context.Context, order *repository.Order, outbox *repository.OutboxEvent) (*repository.Order, *repository.OutboxEvent, error) {
	return order, outbox, nil
}

func (m *mockOrderRepoOutbox) GetPendingOutboxEvents(ctx context.Context, limit int) ([]*repository.OutboxEvent, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var res []*repository.OutboxEvent
	for _, e := range m.pendingEvents {
		if e.Status == "PENDING" {
			res = append(res, e)
			if len(res) >= limit {
				break
			}
		}
	}
	return res, nil
}

func (m *mockOrderRepoOutbox) MarkOutboxEventPublished(ctx context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.publishedIDs = append(m.publishedIDs, id)
	for _, e := range m.pendingEvents {
		if e.ID == id {
			e.Status = "PUBLISHED"
		}
	}
	return nil
}

func (m *mockOrderRepoOutbox) MarkOutboxEventFailed(ctx context.Context, id string, maxRetries int) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.failedIDs = append(m.failedIDs, id)
	for _, e := range m.pendingEvents {
		if e.ID == id {
			e.RetryCount++
			if e.RetryCount >= maxRetries {
				e.Status = "FAILED"
			}
		}
	}
	return nil
}

func (m *mockOrderRepoOutbox) GetOrderByID(ctx context.Context, id string) (*repository.Order, error) {
	return nil, nil
}
func (m *mockOrderRepoOutbox) GetOrdersByUserID(ctx context.Context, userID string) ([]*repository.Order, error) {
	return nil, nil
}
func (m *mockOrderRepoOutbox) GetAllOrders(ctx context.Context, eventID *string) ([]*repository.Order, error) {
	return nil, nil
}
func (m *mockOrderRepoOutbox) UpdateOrderStatus(ctx context.Context, id string, status string) error {
	return nil
}
func (m *mockOrderRepoOutbox) GetUserPurchasedCount(ctx context.Context, userID, eventID string) (int, error) {
	return 0, nil
}
func (m *mockOrderRepoOutbox) CreateOrderLog(ctx context.Context, orderID, eventType, payloadJSON string) error {
	return nil
}
func (m *mockOrderRepoOutbox) GetOrderLogsByOrderID(ctx context.Context, orderID string) ([]*repository.OrderLog, error) {
	return nil, nil
}
func (m *mockOrderRepoOutbox) GetConfirmedTicketCount(ctx context.Context, eventID string) (int, error) {
	return 0, nil
}
func (m *mockOrderRepoOutbox) GetExpiredPendingOrders(ctx context.Context, olderThan time.Duration) ([]*repository.Order, error) {
	return nil, nil
}
func (m *mockOrderRepoOutbox) HasRecentOrders(ctx context.Context, eventID string, within time.Duration) (bool, error) {
	return false, nil
}

func TestOutboxWorker_SuccessfulPublish(t *testing.T) {
	ctx := context.Background()
	mockRepo := &mockOrderRepoOutbox{
		pendingEvents: []*repository.OutboxEvent{
			{
				ID:            "evt-001",
				AggregateType: "ORDER",
				AggregateID:   "ord-001",
				EventType:     "order.pending",
				Payload:       `{"order_id":"ord-001","quantity":2,"total_price":200000}`,
				Status:        "PENDING",
			},
			{
				ID:            "evt-002",
				AggregateType: "ORDER",
				AggregateID:   "ord-002",
				EventType:     "order.pending",
				Payload:       `{"order_id":"ord-002","quantity":1,"total_price":100000}`,
				Status:        "PENDING",
			},
		},
	}

	publisher := newMockPublisher()
	outboxWorker := worker.NewOutboxWorker(mockRepo, publisher, 100*time.Millisecond, 10)

	publishedCount := outboxWorker.ProcessPendingEvents(ctx)
	assert.Equal(t, 2, publishedCount)

	// Pastikan kedua event terkirim ke routing key 'order.pending'
	assert.Len(t, publisher.published["order.pending"], 2)

	// Pastikan status di database berubah menjadi PUBLISHED
	mockRepo.mu.Lock()
	assert.Equal(t, []string{"evt-001", "evt-002"}, mockRepo.publishedIDs)
	assert.Empty(t, mockRepo.failedIDs)
	mockRepo.mu.Unlock()
}

func TestOutboxWorker_FailedPublish_IncrementsRetry(t *testing.T) {
	ctx := context.Background()
	mockRepo := &mockOrderRepoOutbox{
		pendingEvents: []*repository.OutboxEvent{
			{
				ID:            "evt-err-01",
				AggregateType: "ORDER",
				AggregateID:   "ord-err-01",
				EventType:     "order.pending",
				Payload:       `{"order_id":"ord-err-01"}`,
				Status:        "PENDING",
				RetryCount:    0,
			},
		},
	}

	publisher := newMockPublisher()
	publisher.err = errors.New("rabbitmq connection lost")

	outboxWorker := worker.NewOutboxWorker(mockRepo, publisher, 100*time.Millisecond, 10)

	publishedCount := outboxWorker.ProcessPendingEvents(ctx)
	assert.Equal(t, 0, publishedCount)

	// Pastikan dicatat gagal
	mockRepo.mu.Lock()
	assert.Empty(t, mockRepo.publishedIDs)
	assert.Equal(t, []string{"evt-err-01"}, mockRepo.failedIDs)
	assert.Equal(t, 1, mockRepo.pendingEvents[0].RetryCount)
	mockRepo.mu.Unlock()
}

func TestOutboxWorker_GracefulShutdown(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	mockRepo := &mockOrderRepoOutbox{}
	publisher := newMockPublisher()

	outboxWorker := worker.NewOutboxWorker(mockRepo, publisher, 20*time.Millisecond, 10)
	outboxWorker.Start(ctx)

	// Biarkan berjalan sejenak lalu matikan context
	time.Sleep(50 * time.Millisecond)
	cancel()

	done := make(chan struct{})
	go func() {
		outboxWorker.Wait()
		close(done)
	}()

	select {
	case <-done:
		// Berhasil berhenti dengan bersih
	case <-time.After(2 * time.Second):
		t.Fatal("OutboxWorker did not stop in time (Graceful Shutdown failed)")
	}
}
