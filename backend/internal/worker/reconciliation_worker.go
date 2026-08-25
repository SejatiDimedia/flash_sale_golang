package worker

import (
	"context"
	"log"
	"time"

	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/redisclient"
	"github.com/sejatidimedia/flash_sale_platform/internal/repository"
)

type ReconciliationWorker struct {
	eventRepo   repository.EventRepository
	orderRepo   repository.OrderRepository
	redisClient *redisclient.RedisClient
	interval    time.Duration
}

func NewReconciliationWorker(
	eventRepo repository.EventRepository,
	orderRepo repository.OrderRepository,
	redisClient *redisclient.RedisClient,
	interval time.Duration,
) *ReconciliationWorker {
	if interval <= 0 {
		interval = 1 * time.Minute
	}
	return &ReconciliationWorker{
		eventRepo:   eventRepo,
		orderRepo:   orderRepo,
		redisClient: redisClient,
		interval:    interval,
	}
}

// Start menjalankan Reconciliation Worker di background
func (w *ReconciliationWorker) Start(ctx context.Context) {
	log.Printf("⚖️ Starting Background Reconciliation Worker (Interval: %v)...", w.interval)

	go func() {
		ticker := time.NewTicker(w.interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				log.Println("🛑 Reconciliation Worker stopped cleanly.")
				return
			case <-ticker.C:
				w.runAudit(ctx)
			}
		}
	}()
}

func (w *ReconciliationWorker) runAudit(ctx context.Context) {
	// 1. Ambil semua event yang aktif
	statusActive := "active"
	events, err := w.eventRepo.ListEvents(ctx, &statusActive)
	if err != nil {
		log.Printf("⚠️ [Reconciliation] Failed to list active events: %v", err)
		return
	}

	for _, event := range events {
		// 2. Hitung total tiket CONFIRMED di PostgreSQL (Ground Truth)
		confirmedCount, err := w.orderRepo.GetConfirmedTicketCount(ctx, event.ID)
		if err != nil {
			log.Printf("⚠️ [Reconciliation] Failed to get confirmed count for event %s: %v", event.ID, err)
			continue
		}

		expectedAvailableStock := event.TotalStock - confirmedCount
		if expectedAvailableStock < 0 {
			expectedAvailableStock = 0
		}

		// 3. Baca stok yang tercatat di Redis saat ini
		cachedStock, err := w.redisClient.GetStock(ctx, event.ID)
		if err != nil {
			continue
		}

		// 4. Jika terjadi selisih (Data Drift), lakukan AUTO-CORRECTION!
		if cachedStock != expectedAvailableStock {
			log.Printf("🚨 [Reconciliation ALERT] Data Drift detected for Event '%s' (%s)!", event.Name, event.ID)
			log.Printf("👉 Redis Stock: %d | DB Expected Stock: %d (Total: %d, Sold: %d)",
				cachedStock, expectedAvailableStock, event.TotalStock, confirmedCount)

			// Auto-correct Redis counter
			if err := w.redisClient.InitStock(ctx, event.ID, expectedAvailableStock); err == nil {
				log.Printf("✅ [Reconciliation] Successfully auto-corrected Redis stock to %d!", expectedAvailableStock)
			}

			// Update juga kolom available_stock di DB agar sinkron
			_ = w.eventRepo.UpdateAvailableStock(ctx, event.ID, expectedAvailableStock)
		}
	}
}
