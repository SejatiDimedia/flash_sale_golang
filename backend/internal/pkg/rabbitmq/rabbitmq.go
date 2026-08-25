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

	// 1. Declare Topic Exchange (Durable)
	err = ch.ExchangeDeclare(
		OrderExchange, // name
		"topic",       // type
		true,          // durable
		false,         // auto-deleted
		false,         // internal
		false,         // no-wait
		nil,           // arguments
	)
	if err != nil {
		return nil, fmt.Errorf("failed to declare exchange: %w", err)
	}

	// 2. Declare Queue untuk Order Processing
	q, err := ch.QueueDeclare(
		OrderPendingQueue, // name
		true,              // durable
		false,             // delete when unused
		false,             // exclusive
		false,             // no-wait
		nil,               // arguments
	)
	if err != nil {
		return nil, fmt.Errorf("failed to declare queue: %w", err)
	}

	// 3. Bind Queue ke Exchange dengan Routing Key "order.pending"
	err = ch.QueueBind(
		q.Name,
		OrderPendingKey,
		OrderExchange,
		false,
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to bind queue: %w", err)
	}

	log.Println("🐰 Connected to RabbitMQ successfully with Exchange & Queue declared!")
	return &RabbitMQClient{Conn: conn, Channel: ch}, nil
}

// PublishEvent mengirim pesan ke RabbitMQ Exchange
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
		false, // mandatory
		false, // immediate
		amqp.Publishing{
			ContentType:  "application/json",
			DeliveryMode: amqp.Persistent, // Pesan disimpan di disk agar tahan crash
			Timestamp:    time.Now(),
			Body:         body,
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
