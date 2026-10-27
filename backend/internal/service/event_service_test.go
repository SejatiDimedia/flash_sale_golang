package service_test

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/sejatidimedia/flash_sale_platform/internal/repository"
	"github.com/sejatidimedia/flash_sale_platform/internal/service"
	"github.com/stretchr/testify/assert"
)

// mockEventRepo mencatat berapa kali database dipanggil untuk menguji efisiensi singleflight
type mockEventRepo struct {
	getByIDCallCount int64
	mockEvent        *repository.Event
	mockEvents       []*repository.Event
	simulateDelay    time.Duration
}

func (m *mockEventRepo) CreateEvent(ctx context.Context, event *repository.Event) (*repository.Event, error) {
	return event, nil
}

func (m *mockEventRepo) UpdateEvent(ctx context.Context, event *repository.Event) (*repository.Event, error) {
	return event, nil
}

func (m *mockEventRepo) GetEventByID(ctx context.Context, id string) (*repository.Event, error) {
	atomic.AddInt64(&m.getByIDCallCount, 1)
	if m.simulateDelay > 0 {
		time.Sleep(m.simulateDelay)
	}
	return m.mockEvent, nil
}

func (m *mockEventRepo) ListEvents(ctx context.Context, status *string) ([]*repository.Event, error) {
	return m.mockEvents, nil
}

func (m *mockEventRepo) UpdateAvailableStock(ctx context.Context, id string, newStock int) error {
	return nil
}

func (m *mockEventRepo) DeductAvailableStock(ctx context.Context, id string, qty int) error {
	return nil
}

func (m *mockEventRepo) RestoreAvailableStock(ctx context.Context, id string, qty int) error {
	return nil
}

// TestEventService_Singleflight_PreventsCacheStampede memverifikasi bahwa ketika 50 goroutine
// memanggil GetEventByID secara bersamaan, database HANYA dipanggil 1 KALI oleh singleflight.Group!
func TestEventService_Singleflight_PreventsCacheStampede(t *testing.T) {
	mockRepo := &mockEventRepo{
		simulateDelay: 50 * time.Millisecond, // Simulasikan latensi query DB
		mockEvent: &repository.Event{
			ID:             "ev-concert-001",
			Name:           "Coldplay Music of the Spheres Jakarta",
			TotalStock:     100,
			AvailableStock: 100,
			Price:          2500000,
			Status:         "active",
		},
	}

	// Gunakan EventService tanpa Redis (cache miss paksa untuk menguji query database bersamaan)
	svc := service.NewEventService(mockRepo, nil)

	const concurrentCallers = 50
	var wg sync.WaitGroup
	wg.Add(concurrentCallers)

	startSignal := make(chan struct{})

	for i := 0; i < concurrentCallers; i++ {
		go func() {
			defer wg.Done()
			// Tunggu sinyal mulai agar semua 50 goroutine menembak tepat di milidetik yang sama
			<-startSignal

			ev, err := svc.GetEventByID(context.Background(), "ev-concert-001")
			assert.NoError(t, err)
			assert.NotNil(t, ev)
			assert.Equal(t, "ev-concert-001", ev.ID)
			assert.Equal(t, "Coldplay Music of the Spheres Jakarta", ev.Name)
		}()
	}

	// Lepaskan 50 goroutine secara serentak
	close(startSignal)
	wg.Wait()

	// 🎯 PEMBUKTIAN SINGLEFLIGHT:
	// Meskipun ada 50 pemanggil simultan, database hanya dipanggil 1 kali!
	callCount := atomic.LoadInt64(&mockRepo.getByIDCallCount)
	t.Logf("🚀 Total concurrent callers: %d | Total Database Calls: %d", concurrentCallers, callCount)
	assert.Equal(t, int64(1), callCount, "Singleflight harus menekan 50 panggilan bersamaan menjadi tepat 1 panggilan ke database")
}
