package redisclient

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/sejatidimedia/flash_sale_platform/internal/config"
)

type RedisClient struct {
	Client *redis.Client
}

func NewRedisClient(cfg *config.Config) (*RedisClient, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
		DB:       0, // Default DB
		PoolSize: 50,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to redis: %w", err)
	}

	log.Println("⚡ Connected to Redis successfully!")
	return &RedisClient{Client: rdb}, nil
}

// InitStock menginisialisasi jumlah stok di Redis saat event aktif
func (r *RedisClient) InitStock(ctx context.Context, eventID string, stock int) error {
	key := fmt.Sprintf("stock:%s", eventID)
	return r.Client.Set(ctx, key, stock, 0).Err() // 0 = no expiration
}

// GetStock mengambil sisa stok terkini dari Redis
func (r *RedisClient) GetStock(ctx context.Context, eventID string) (int, error) {
	key := fmt.Sprintf("stock:%s", eventID)
	val, err := r.Client.Get(ctx, key).Int()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return 0, nil // Key belum ada
		}
		return 0, err
	}
	return val, nil
}

// DecrStockAtomic mengurangi stok secara atomik menggunakan Lua Script.
// Menjamin tidak ada race condition dan stok tidak bisa negatif.
func (r *RedisClient) DecrStockAtomic(ctx context.Context, eventID string, quantity int) (int, error) {
	key := fmt.Sprintf("stock:%s", eventID)

	// Lua Script dijalankan secara 100% atomik di dalam engine Redis
	luaScript := `
		local current = redis.call('GET', KEYS[1])
		if not current then
			return -1 -- Stock belum diinisialisasi
		end
		local stock = tonumber(current)
		local qty = tonumber(ARGV[1])
		if stock < qty then
			return -2 -- Stok tidak mencukupi (Habis)
		end
		local remaining = redis.call('DECRBY', KEYS[1], qty)
		return remaining
	`

	res, err := r.Client.Eval(ctx, luaScript, []string{key}, quantity).Int()
	if err != nil {
		return 0, fmt.Errorf("redis lua error: %w", err)
	}

	if res == -1 {
		return 0, errors.New("event stock is not initialized in cache")
	}
	if res == -2 {
		return 0, errors.New("sold out: insufficient stock available")
	}

	return res, nil
}

// IncrStock mengembalikan stok (rollback) jika proses transaksi gagal
func (r *RedisClient) IncrStock(ctx context.Context, eventID string, quantity int) error {
	key := fmt.Sprintf("stock:%s", eventID)
	return r.Client.IncrBy(ctx, key, int64(quantity)).Err()
}

// CheckRateLimit membatasi jumlah request checkout per user dalam jangka waktu tertentu
func (r *RedisClient) CheckRateLimit(ctx context.Context, userID, eventID string, limit int, window time.Duration) (bool, error) {
	key := fmt.Sprintf("rate_limit:%s:%s", userID, eventID)

	count, err := r.Client.Incr(ctx, key).Result()
	if err != nil {
		return false, err
	}

	// Jika ini request pertama, pasang waktu expired (TTL)
	if count == 1 {
		r.Client.Expire(ctx, key, window)
	}

	// Jika jumlah request melebihi limit, tolak
	if count > int64(limit) {
		return false, nil // Rate limit exceeded
	}

	return true, nil // Allowed
}

// PublishMessage mengirim pesan JSON ke Redis Pub/Sub channel
func (r *RedisClient) PublishMessage(ctx context.Context, channel string, message interface{}) error {
	return r.Client.Publish(ctx, channel, message).Err()
}

// SubscribeChannel membuka langganan ke Redis Pub/Sub channel
func (r *RedisClient) SubscribeChannel(ctx context.Context, channel string) *redis.PubSub {
	return r.Client.Subscribe(ctx, channel)
}
