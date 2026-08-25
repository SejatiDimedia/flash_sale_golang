package rabbitmq

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
	"github.com/sejatidimedia/flash_sale_platform/internal/config"
)

const (
	OrderExchange     = "order_events"
	OrderPendingQueue = "order_processing"
	OrderPendingKey   = "order.pending"
	OrderConfirmedKey = "order.confirmed"

	// 💀 Dead-Letter Queue (DLQ) Constants
	OrderDLXExchange = "order_events_dlx"
	OrderDLQQueue    = "order_processing_dlq"
	OrderDLQKey      = "order.dlq"
)

type RabbitMQClient struct {
	Conn    *amqp.Connection
	Channel *amqp.Channel
}

func NewRabbitMQClient(cfg *config.Config) (*RabbitMQClient, error) {
	conn, err := amqp.Dial(cfg.RabbitMQURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to rabbitmq: %w", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to open rabbitmq channel: %w", err)
	}

	// 1. Declare Topic Exchange Utama
	err = ch.ExchangeDeclare(
		OrderExchange,
		"topic",
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to declare exchange: %w", err)
	}

	// 2. Declare Dead-Letter Exchange (DLX)
	err = ch.ExchangeDeclare(
		OrderDLXExchange,
		"direct",
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to declare DLX exchange: %w", err)
	}

	// 3. Declare Dead-Letter Queue (DLQ)
	dlq, err := ch.QueueDeclare(
		OrderDLQQueue,
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to declare DLQ queue: %w", err)
	}

	// 4. Bind DLQ ke DLX
	err = ch.QueueBind(
		dlq.Name,
		OrderDLQKey,
		OrderDLXExchange,
		false,
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to bind DLQ: %w", err)
	}

	// 5. Declare Queue Utama dengan konfigurasi Dead-Letter Routing
	queueArgs := amqp.Table{
		"x-dead-letter-exchange":    OrderDLXExchange,
		"x-dead-letter-routing-key": OrderDLQKey,
	}

	q, err := ch.QueueDeclare(
		OrderPendingQueue,
		true,
		false,
		false,
		false,
		queueArgs,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to declare queue: %w", err)
	}

	// 6. Bind Queue Utama ke Exchange Utama
	err = ch.QueueBind(
		q.Name,
		OrderPendingKey,
		OrderExchange,
		false,
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to bind main queue: %w", err)
	}

	log.Println("🐰 Connected to RabbitMQ successfully with Main Queue & DLQ declared!")
	return &RabbitMQClient{Conn: conn, Channel: ch}, nil
}

// PublishEvent mengirim pesan ke Exchange utama
func (r *RabbitMQClient) PublishEvent(ctx context.Context, routingKey string, payload interface{}) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal event payload: %w", err)
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	return r.Channel.PublishWithContext(
		ctxTimeout,
		OrderExchange,
		routingKey,
		false,
		false,
		amqp.Publishing{
			ContentType:  "application/json",
			DeliveryMode: amqp.Persistent,
			Timestamp:    time.Now(),
			Body:         body,
		},
	)
}

// PublishToDLQ mengirim pesan gagal ke DLQ
func (r *RabbitMQClient) PublishToDLQ(ctx context.Context, payload interface{}, reason string) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	return r.Channel.PublishWithContext(
		ctxTimeout,
		OrderDLXExchange,
		OrderDLQKey,
		false,
		false,
		amqp.Publishing{
			ContentType:  "application/json",
			DeliveryMode: amqp.Persistent,
			Timestamp:    time.Now(),
			Headers: amqp.Table{
				"x-failure-reason": reason,
				"x-failed-at":      time.Now().Format(time.RFC3339),
			},
			Body: body,
		},
	)
}

func (r *RabbitMQClient) Close() {
	if r.Channel != nil {
		r.Channel.Close()
	}
	if r.Conn != nil {
		r.Conn.Close()
	}
}
