package worker

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/sejatidimedia/flash_sale_platform/internal/repository"
)

// EventPublisher merepresentasikan antarmuka pengirim pesan ke broker (RabbitMQ)
type EventPublisher interface {
	PublishEvent(ctx context.Context, routingKey string, payload interface{}) error
}

// OutboxWorker bertugas membaca event outbox dari database dan meneruskannya ke RabbitMQ.
// Pola ini mengeliminasi Dual-Write Problem dan menjamin At-Least-Once Delivery (US-15).
type OutboxWorker struct {
	orderRepo    repository.OrderRepository
	publisher    EventPublisher
	pollInterval time.Duration
	batchSize    int
	maxRetries   int
	wg           sync.WaitGroup
}

func NewOutboxWorker(
	orderRepo repository.OrderRepository,
	publisher EventPublisher,
	pollInterval time.Duration,
	batchSize int,
) *OutboxWorker {
	if pollInterval <= 0 {
		pollInterval = 1 * time.Second
	}
	if batchSize <= 0 {
		batchSize = 50
	}
	return &OutboxWorker{
		orderRepo:    orderRepo,
		publisher:    publisher,
		pollInterval: pollInterval,
		batchSize:    batchSize,
		maxRetries:   3,
	}
}

// Start menjalankan Outbox Relay Worker di background
func (w *OutboxWorker) Start(ctx context.Context) {
	log.Printf("📦 Starting Background Outbox Relay Worker (Poll Interval: %v, Batch: %d)...", w.pollInterval, w.batchSize)

	w.wg.Add(1)
	go func() {
		defer w.wg.Done()
		ticker := time.NewTicker(w.pollInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				log.Println("🛑 Outbox Relay Worker stopping cleanly...")
				return
			case <-ticker.C:
				w.ProcessPendingEvents(ctx)
			}
		}
	}()
}

// Wait menunggu worker menyelesaikan tugas sebelum shutdown
func (w *OutboxWorker) Wait() {
	w.wg.Wait()
}

// ProcessPendingEvents memproses satu batch event outbox berstatus PENDING
func (w *OutboxWorker) ProcessPendingEvents(ctx context.Context) int {
	events, err := w.orderRepo.GetPendingOutboxEvents(ctx, w.batchSize)
	if err != nil {
		log.Printf("⚠️ [Outbox Relay] Failed to fetch pending outbox events: %v", err)
		return 0
	}

	if len(events) == 0 {
		return 0
	}

	publishedCount := 0
	for _, event := range events {
		var payloadData interface{}
		if err := json.Unmarshal([]byte(event.Payload), &payloadData); err != nil {
			payloadData = event.Payload
		}

		// Teruskan pesan ke Message Broker RabbitMQ
		pubErr := w.publisher.PublishEvent(ctx, event.EventType, payloadData)
		if pubErr != nil {
			log.Printf("❌ [Outbox Relay] Failed to publish event %s (%s): %v", event.ID, event.EventType, pubErr)
			_ = w.orderRepo.MarkOutboxEventFailed(ctx, event.ID, w.maxRetries)
			continue
		}

		// Tandai status event menjadi PUBLISHED di PostgreSQL
		if err := w.orderRepo.MarkOutboxEventPublished(ctx, event.ID); err != nil {
			log.Printf("⚠️ [Outbox Relay] Published event %s but failed to mark status: %v", event.ID, err)
		} else {
			publishedCount++
		}
	}

	if publishedCount > 0 {
		log.Printf("📦 [Outbox Relay] Successfully published and marked %d events to RabbitMQ", publishedCount)
	}

	return publishedCount
}
