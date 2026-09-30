package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/rabbitmq"
	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/redisclient"
	"github.com/sejatidimedia/flash_sale_platform/internal/repository"
)

const MaxRetryAttempts = 3

type OrderMessagePayload struct {
	OrderID    string  `json:"order_id"`
	UserID     string  `json:"user_id"`
	EventID    string  `json:"event_id"`
	Quantity   int     `json:"quantity"`
	TotalPrice float64 `json:"total_price"`
	RetryCount int     `json:"retry_count,omitempty"`
}

type OrderWorkerPool struct {
	rabbitClient *rabbitmq.RabbitMQClient
	redisClient  *redisclient.RedisClient
	orderRepo    repository.OrderRepository
	eventRepo    repository.EventRepository
	numWorkers   int
	wg           sync.WaitGroup
}

func NewOrderWorkerPool(
	rabbitClient *rabbitmq.RabbitMQClient,
	redisClient *redisclient.RedisClient,
	orderRepo repository.OrderRepository,
	eventRepo repository.EventRepository,
	numWorkers int,
) *OrderWorkerPool {
	if numWorkers <= 0 {
		numWorkers = 10
	}
	return &OrderWorkerPool{
		rabbitClient: rabbitClient,
		redisClient:  redisClient,
		orderRepo:    orderRepo,
		eventRepo:    eventRepo,
		numWorkers:   numWorkers,
	}
}

func (p *OrderWorkerPool) Start(ctx context.Context) error {
	err := p.rabbitClient.Channel.Qos(
		p.numWorkers*2,
		0,
		false,
	)
	if err != nil {
		return err
	}

	msgs, err := p.rabbitClient.Channel.Consume(
		rabbitmq.OrderPendingQueue,
		"",
		false, // manual ACK
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return err
	}

	log.Printf("👷 Starting %d Order Workers listening to queue '%s' (Max Retries: %d)...",
		p.numWorkers, rabbitmq.OrderPendingQueue, MaxRetryAttempts)

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
		log.Printf("❌ [Worker %d] Failed to unmarshal message: %v (Routing to DLQ)", workerID, err)
		_ = p.rabbitClient.PublishToDLQ(context.Background(), string(msg.Body), "JSON error: "+err.Error())
		_ = msg.Ack(false)
		return
	}

	log.Printf("🔄 [Worker %d] Processing Order %s (Attempt %d/%d) (UserID: %s, EventID: %s, Qty: %d)",
		workerID, payload.OrderID, payload.RetryCount+1, MaxRetryAttempts, payload.UserID, payload.EventID, payload.Quantity)

	time.Sleep(30 * time.Millisecond)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 0. Idempotency Check: Jika order sudah CONFIRMED, jangan proses ulang (cegah duplikasi)
	existingOrder, err := p.orderRepo.GetOrderByID(ctx, payload.OrderID)
	if err == nil && existingOrder != nil && existingOrder.Status == "CONFIRMED" {
		log.Printf("ℹ️ [Worker %d] Order %s is already CONFIRMED (Idempotent bypass). Acknowledging.", workerID, payload.OrderID)
		_ = msg.Ack(false)
		return
	}

	// 1. Update status order menjadi CONFIRMED di PostgreSQL
	err = p.orderRepo.UpdateOrderStatus(ctx, payload.OrderID, "CONFIRMED")
	if err != nil {
		payload.RetryCount++
		failReason := fmt.Sprintf("DB update failed: %v", err)

		if payload.RetryCount < MaxRetryAttempts {
			backoff := time.Duration(payload.RetryCount) * time.Second
			log.Printf("⚠️ [Worker %d] Order %s failed (Attempt %d). Retrying in %v...",
				workerID, payload.OrderID, payload.RetryCount, backoff)

			time.Sleep(backoff)
			_ = p.rabbitClient.PublishEvent(ctx, rabbitmq.OrderPendingKey, payload)
			_ = msg.Ack(false)
			return
		}

		// 💀 BATAS RETRY HABIS: Kirim ke DLQ
		log.Printf("💀 [Worker %d] Order %s reached MAX RETRIES (%d). Moving to DEAD-LETTER QUEUE (%s)!",
			workerID, payload.OrderID, MaxRetryAttempts, rabbitmq.OrderDLQQueue)

		_ = p.rabbitClient.PublishToDLQ(ctx, payload, failReason)
		_ = p.orderRepo.CreateOrderLog(ctx, payload.OrderID, "ORDER_DLQ_ROUTED",
			fmt.Sprintf(`{"reason":"%s","attempts":%d}`, failReason, payload.RetryCount))

		_ = msg.Ack(false)
		return
	}

	// 2. Catat Audit Log
	logPayload := fmt.Sprintf(`{"status":"CONFIRMED","worker_id":%d,"quantity":%d,"total_price":%.2f,"attempts":%d}`,
		workerID, payload.Quantity, payload.TotalPrice, payload.RetryCount+1)
	_ = p.orderRepo.CreateOrderLog(ctx, payload.OrderID, "ORDER_CONFIRMED", logPayload)

	// 3. Broadcast Real-Time via Redis Pub/Sub
	order, _ := p.orderRepo.GetOrderByID(ctx, payload.OrderID)
	if order != nil {
		if orderBytes, err := json.Marshal(order); err == nil {
			pubCtx, pubCancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer pubCancel()
			_ = p.redisClient.PublishMessage(pubCtx, fmt.Sprintf("order_status:%s", payload.OrderID), string(orderBytes))
		}
	}

	// 4. Manual ACK
	_ = msg.Ack(false)
	log.Printf("✅ [Worker %d] Order %s CONFIRMED, Logged & Broadcasted successfully!", workerID, payload.OrderID)
}

func (p *OrderWorkerPool) Stop() {
	p.wg.Wait()
	log.Println("🛑 All Order Workers stopped cleanly.")
}
