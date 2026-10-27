package worker

import (
	"context"
	"log"
	"time"

	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/redisclient"
	"github.com/sejatidimedia/flash_sale_platform/internal/repository"
)

// OrderCanceller mendefinisikan antarmuka pembatalan pesanan yang kedaluwarsa (DRY)
type OrderCanceller interface {
	CancelExpiredOrders(ctx context.Context, expiryWindow time.Duration) (int, error)
}

type ReconciliationWorker struct {
	checkoutService OrderCanceller
	eventRepo       repository.EventRepository
	orderRepo       repository.OrderRepository
	redisClient     *redisclient.RedisClient
	interval        time.Duration
}

func NewReconciliationWorker(
	checkoutService OrderCanceller,
	eventRepo repository.EventRepository,
	orderRepo repository.OrderRepository,
	redisClient *redisclient.RedisClient,
	interval time.Duration,
) *ReconciliationWorker {
	if interval <= 0 {
		interval = 1 * time.Minute
	}
	return &ReconciliationWorker{
		checkoutService: checkoutService,
		eventRepo:       eventRepo,
		orderRepo:       orderRepo,
		redisClient:     redisClient,
		interval:        interval,
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
	// 0. Batalkan reservasi PENDING yang kedaluwarsa (> 10 menit), kembalikan stok, dan broadcast update via CheckoutService (DRY)
	if w.checkoutService != nil {
		cancelledCount, err := w.checkoutService.CancelExpiredOrders(ctx, 10*time.Minute)
		if err != nil {
			log.Printf("⚠️ [Reconciliation] Failed to cancel expired orders: %v", err)
		} else if cancelledCount > 0 {
			log.Printf("♻️ [Reconciliation] Cleaned up and released stock for %d expired orders", cancelledCount)
		}
	}

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

		// 4. Jika terjadi selisih (Data Drift), lakukan AUTO-CORRECTION secara aman!
		if cachedStock != expectedAvailableStock {
			// Jika cachedStock < expectedAvailableStock, ini bisa jadi karena order in-flight di goroutine/worker.
			// Cek apakah ada aktivitas transaksi dalam 2 menit terakhir:
			if cachedStock < expectedAvailableStock {
				hasRecent, recentErr := w.orderRepo.HasRecentOrders(ctx, event.ID, 2*time.Minute)
				if recentErr == nil && hasRecent {
					log.Printf("⏳ [Reconciliation] In-flight transactions active for Event '%s' (Redis: %d, DB: %d). Skipping upward correction to prevent overselling.",
						event.Name, cachedStock, expectedAvailableStock)
					continue
				}
			}

			log.Printf("🚨 [Reconciliation ALERT] Data Drift detected for Event '%s' (%s)!", event.Name, event.ID)
			log.Printf("👉 Redis Stock: %d | DB Expected Stock: %d (Total: %d, Sold: %d)",
				cachedStock, expectedAvailableStock, event.TotalStock, confirmedCount)

			// Auto-correct Redis counter
			if err := w.redisClient.SetStock(ctx, event.ID, expectedAvailableStock); err == nil {
				log.Printf("✅ [Reconciliation] Successfully auto-corrected Redis stock to %d!", expectedAvailableStock)
			}

			// Update juga kolom available_stock di DB agar sinkron
			_ = w.eventRepo.UpdateAvailableStock(ctx, event.ID, expectedAvailableStock)
		}
	}
}
