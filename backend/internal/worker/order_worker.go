package worker

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/rabbitmq"
	"github.com/sejatidimedia/flash_sale_platform/internal/repository"
)

// OrderMessagePayload adalah struktur data yang dikirim lewat RabbitMQ
type OrderMessagePayload struct {
	OrderID    string  `json:"order_id"`
	UserID     string  `json:"user_id"`
	EventID    string  `json:"event_id"`
	Quantity   int     `json:"quantity"`
	TotalPrice float64 `json:"total_price"`
}

type OrderWorkerPool struct {
	rabbitClient *rabbitmq.RabbitMQClient
	orderRepo    repository.OrderRepository
	eventRepo    repository.EventRepository
	numWorkers   int
	wg           sync.WaitGroup
}

func NewOrderWorkerPool(
	rabbitClient *rabbitmq.RabbitMQClient,
	orderRepo repository.OrderRepository,
	eventRepo repository.EventRepository,
	numWorkers int,
) *OrderWorkerPool {
	if numWorkers <= 0 {
		numWorkers = 10
	}
	return &OrderWorkerPool{
		rabbitClient: rabbitClient,
		orderRepo:    orderRepo,
		eventRepo:    eventRepo,
		numWorkers:   numWorkers,
	}
}

// Start menyalakan Goroutines worker pool
func (p *OrderWorkerPool) Start(ctx context.Context) error {
	// Fair dispatch: batasi antrian per worker
	err := p.rabbitClient.Channel.Qos(
		p.numWorkers*2, // prefetch count
		0,
		false,
	)
	if err != nil {
		return err
	}

	msgs, err := p.rabbitClient.Channel.Consume(
		rabbitmq.OrderPendingQueue,
		"",    // consumer tag
		false, // autoAck = FALSE (Kita wajib Manual ACK demi keandalan)
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return err
	}

	log.Printf("👷 Starting %d Order Workers listening to queue '%s'...", p.numWorkers, rabbitmq.OrderPendingQueue)

	for i := 1; i <= p.numWorkers; i++ {
		p.wg.Add(1)
		go p.worker(ctx, i, msgs)
	}

	return nil
}

func (p *OrderWorkerPool) worker(ctx context.Context, workerID int, msgs <-chan amqp.Delivery) {
	defer p.wg.Done()

	for {
		select {
		case <-ctx.Done():
			log.Printf("[Worker %d] Shutting down gracefully...", workerID)
			return
		case msg, ok := <-msgs:
			if !ok {
				log.Printf("[Worker %d] Message channel closed", workerID)
				return
			}

			p.processMessage(workerID, msg)
		}
	}
}

func (p *OrderWorkerPool) processMessage(workerID int, msg amqp.Delivery) {
	var payload OrderMessagePayload
	if err := json.Unmarshal(msg.Body, &payload); err != nil {
		log.Printf("❌ [Worker %d] Failed to unmarshal message: %v", workerID, err)
		_ = msg.Nack(false, false)
		return
	}

	log.Printf("🔄 [Worker %d] Processing Order %s (UserID: %s, EventID: %s, Qty: %d)",
		workerID, payload.OrderID, payload.UserID, payload.EventID, payload.Quantity)

	// Simulasi pemrosesan async
	time.Sleep(30 * time.Millisecond)

	// Update status order di PostgreSQL menjadi CONFIRMED
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := p.orderRepo.UpdateOrderStatus(ctx, payload.OrderID, "CONFIRMED")
	if err != nil {
		log.Printf("❌ [Worker %d] Failed to confirm order %s: %v. Requeuing...", workerID, payload.OrderID, err)
		_ = msg.Nack(false, true) // Requeue jika DB error sementara
		return
	}

	// Manual ACK: konfirmasi bahwa order sukses diproses
	_ = msg.Ack(false)
	log.Printf("✅ [Worker %d] Order %s CONFIRMED successfully!", workerID, payload.OrderID)
}

func (p *OrderWorkerPool) Stop() {
	p.wg.Wait()
	log.Println("🛑 All Order Workers stopped cleanly.")
}
