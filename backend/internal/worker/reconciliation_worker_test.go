package worker_test

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/redisclient"
	"github.com/sejatidimedia/flash_sale_platform/internal/repository"
	"github.com/sejatidimedia/flash_sale_platform/internal/worker"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockOrderCanceller memverifikasi delegasi DRY ke CheckoutService
type mockOrderCanceller struct {
	calledTimes   int
	cancelledRet  int
	cancelledErr  error
}

func (m *mockOrderCanceller) CancelExpiredOrders(ctx context.Context, expiryWindow time.Duration) (int, error) {
	m.calledTimes++
	return m.cancelledRet, m.cancelledErr
}

// mockEventRepoReconciliation memalsukan repositori event untuk audit data drift
type mockEventRepoReconciliation struct {
	activeEvents  []*repository.Event
	updatedStocks map[string]int
}

func (m *mockEventRepoReconciliation) CreateEvent(ctx context.Context, event *repository.Event) (*repository.Event, error) {
	return event, nil
}
func (m *mockEventRepoReconciliation) UpdateEvent(ctx context.Context, event *repository.Event) (*repository.Event, error) {
	return event, nil
}
func (m *mockEventRepoReconciliation) GetEventByID(ctx context.Context, id string) (*repository.Event, error) {
	return nil, nil
}
func (m *mockEventRepoReconciliation) ListEvents(ctx context.Context, status *string) ([]*repository.Event, error) {
	return m.activeEvents, nil
}
func (m *mockEventRepoReconciliation) UpdateAvailableStock(ctx context.Context, id string, newStock int) error {
	if m.updatedStocks == nil {
		m.updatedStocks = make(map[string]int)
	}
	m.updatedStocks[id] = newStock
	return nil
}
func (m *mockEventRepoReconciliation) DeductAvailableStock(ctx context.Context, id string, qty int) error {
	return nil
}
func (m *mockEventRepoReconciliation) RestoreAvailableStock(ctx context.Context, id string, qty int) error {
	return nil
}
func (m *mockEventRepoReconciliation) Ping(ctx context.Context) error {
	return nil
}

// mockOrderRepoReconciliation memalsukan Ground Truth perhitungan tiket di DB
type mockOrderRepoReconciliation struct {
	confirmedCount int
	hasRecent      bool
}

func (m *mockOrderRepoReconciliation) CreateOrder(ctx context.Context, order *repository.Order) (*repository.Order, error) {
	return order, nil
}
func (m *mockOrderRepoReconciliation) CreateOrderWithOutbox(ctx context.Context, order *repository.Order, outbox *repository.OutboxEvent) (*repository.Order, *repository.OutboxEvent, error) {
	return order, outbox, nil
}
func (m *mockOrderRepoReconciliation) GetPendingOutboxEvents(ctx context.Context, limit int) ([]*repository.OutboxEvent, error) {
	return nil, nil
}
func (m *mockOrderRepoReconciliation) MarkOutboxEventPublished(ctx context.Context, id string) error {
	return nil
}
func (m *mockOrderRepoReconciliation) MarkOutboxEventFailed(ctx context.Context, id string, maxRetries int) error {
	return nil
}
func (m *mockOrderRepoReconciliation) GetOrderByID(ctx context.Context, id string) (*repository.Order, error) {
	return nil, nil
}
func (m *mockOrderRepoReconciliation) GetOrdersByUserID(ctx context.Context, userID string) ([]*repository.Order, error) {
	return nil, nil
}
func (m *mockOrderRepoReconciliation) GetAllOrders(ctx context.Context, eventID *string) ([]*repository.Order, error) {
	return nil, nil
}
func (m *mockOrderRepoReconciliation) UpdateOrderStatus(ctx context.Context, id string, status string) error {
	return nil
}
func (m *mockOrderRepoReconciliation) GetUserPurchasedCount(ctx context.Context, userID, eventID string) (int, error) {
	return 0, nil
}
func (m *mockOrderRepoReconciliation) CreateOrderLog(ctx context.Context, orderID, eventType, payloadJSON string) error {
	return nil
}
func (m *mockOrderRepoReconciliation) GetOrderLogsByOrderID(ctx context.Context, orderID string) ([]*repository.OrderLog, error) {
	return nil, nil
}
func (m *mockOrderRepoReconciliation) GetConfirmedTicketCount(ctx context.Context, eventID string) (int, error) {
	return m.confirmedCount, nil
}
func (m *mockOrderRepoReconciliation) GetExpiredPendingOrders(ctx context.Context, olderThan time.Duration) ([]*repository.Order, error) {
	return nil, nil
}
func (m *mockOrderRepoReconciliation) HasRecentOrders(ctx context.Context, eventID string, within time.Duration) (bool, error) {
	return m.hasRecent, nil
}

func TestReconciliationWorker_DelegatesToOrderCanceller(t *testing.T) {
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	rClient := &redisclient.RedisClient{Client: rdb}

	mockCanceller := &mockOrderCanceller{cancelledRet: 3}
	mockEvent := &mockEventRepoReconciliation{}
	mockOrder := &mockOrderRepoReconciliation{}

	workerInstance := worker.NewReconciliationWorker(mockCanceller, mockEvent, mockOrder, rClient, 50*time.Millisecond)

	ctx, cancel := context.WithCancel(context.Background())
	workerInstance.Start(ctx)

	// Biarkan worker berjalan 1 tick
	time.Sleep(80 * time.Millisecond)
	cancel()

	// Pastikan CancelExpiredOrders dipanggil oleh worker (DRY terpenuhi)
	assert.GreaterOrEqual(t, mockCanceller.calledTimes, 1)
}

func TestReconciliationWorker_AutoCorrectsDataDrift_WhenNoRecentOrders(t *testing.T) {
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	rClient := &redisclient.RedisClient{Client: rdb}
	ctx := context.Background()

	eventID := "ev-concert"
	// Total stok = 100, Terkonfirmasi terjual di DB = 30 -> Stok seharusnya = 70
	// Tapi di Redis secara anomali tercatat 60 (Data Drift)
	_ = rClient.SetStock(ctx, eventID, 60)

	mockCanceller := &mockOrderCanceller{}
	mockEvent := &mockEventRepoReconciliation{
		activeEvents: []*repository.Event{
			{
				ID:         eventID,
				Name:       "Rock Fest",
				TotalStock: 100,
			},
		},
	}
	mockOrder := &mockOrderRepoReconciliation{
		confirmedCount: 30,
		hasRecent:      false, // Tidak ada transaksi dalam 2 menit terakhir (tenang)
	}

	workerInstance := worker.NewReconciliationWorker(mockCanceller, mockEvent, mockOrder, rClient, 50*time.Millisecond)

	workerCtx, cancel := context.WithCancel(context.Background())
	workerInstance.Start(workerCtx)
	time.Sleep(80 * time.Millisecond)
	cancel()

	// Pastikan stok di Redis dikoreksi otomatis ke 70 (Ground Truth)
	correctedStock, err := rClient.GetStock(ctx, eventID)
	require.NoError(t, err)
	assert.Equal(t, 70, correctedStock)
	assert.Equal(t, 70, mockEvent.updatedStocks[eventID])
}

func TestReconciliationWorker_InFlightGuard_PreventsOverselling(t *testing.T) {
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	rClient := &redisclient.RedisClient{Client: rdb}
	ctx := context.Background()

	eventID := "ev-concert"
	// Total stok = 100, Terkonfirmasi di DB = 20.
	// Di Redis tercatat 50 (karena 30 tiket sedang in-flight di tangan user yang checkout).
	_ = rClient.SetStock(ctx, eventID, 50)

	mockCanceller := &mockOrderCanceller{}
	mockEvent := &mockEventRepoReconciliation{
		activeEvents: []*repository.Event{
			{
				ID:         eventID,
				Name:       "Rock Fest",
				TotalStock: 100,
			},
		},
	}
	mockOrder := &mockOrderRepoReconciliation{
		confirmedCount: 20,
		hasRecent:      true, // Sedang ADA transaksi baru dalam 2 menit terakhir!
	}

	workerInstance := worker.NewReconciliationWorker(mockCanceller, mockEvent, mockOrder, rClient, 50*time.Millisecond)

	workerCtx, cancel := context.WithCancel(context.Background())
	workerInstance.Start(workerCtx)
	time.Sleep(80 * time.Millisecond)
	cancel()

	// In-Flight Guard harus MENAHAN koreksi: stok Redis TETAP 50 agar 30 tiket tidak dijual ganda!
	stock, err := rClient.GetStock(ctx, eventID)
	require.NoError(t, err)
	assert.Equal(t, 50, stock)
}
