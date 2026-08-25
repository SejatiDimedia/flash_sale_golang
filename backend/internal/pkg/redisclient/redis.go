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

// InitStock menginisialisasi jumlah stok di Redis HANYA JIKA key belum ada (Atomic SETNX)
func (r *RedisClient) InitStock(ctx context.Context, eventID string, stock int) error {
	key := fmt.Sprintf("stock:%s", eventID)
	return r.Client.SetNX(ctx, key, stock, 0).Err() // SetNX menjamin tidak ada overwrite!
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

// ==========================================
// 🎟️ VIRTUAL WAITING ROOM (REDIS SORTED SET)
// ==========================================

// JoinWaitingRoom memasukkan user ke antrian (FIFO berdasarkan timestamp milidetik)
func (r *RedisClient) JoinWaitingRoom(ctx context.Context, eventID, userID string) (int64, error) {
	queueKey := fmt.Sprintf("waiting_room:%s", eventID)
	nowScore := float64(time.Now().UnixMilli())

	// ZADD: Masukkan user dengan score waktu sekarang
	err := r.Client.ZAdd(ctx, queueKey, redis.Z{
		Score:  nowScore,
		Member: userID,
	}).Err()
	if err != nil {
		return 0, fmt.Errorf("failed to join waiting room: %w", err)
	}

	// ZRANK: Ambil posisi urutan user di antrian (0-indexed, jadi kita +1)
	rank, err := r.Client.ZRank(ctx, queueKey, userID).Result()
	if err != nil {
		return 0, fmt.Errorf("failed to get queue rank: %w", err)
	}

	return rank + 1, nil // Urutan antrian dimulai dari 1
}

// GetTotalInQueue menghitung berapa total orang yang sedang mengantre di waiting room
func (r *RedisClient) GetTotalInQueue(ctx context.Context, eventID string) (int64, error) {
	queueKey := fmt.Sprintf("waiting_room:%s", eventID)
	return r.Client.ZCard(ctx, queueKey).Result()
}

// GetQueuePosition memeriksa nomor antrian dan total orang di antrian
func (r *RedisClient) GetQueuePosition(ctx context.Context, eventID, userID string) (int64, int64, error) {
	queueKey := fmt.Sprintf("waiting_room:%s", eventID)

	// Hitung total orang di antrian terlebih dahulu
	totalInQueue, err := r.Client.ZCard(ctx, queueKey).Result()
	if err != nil {
		return 0, 0, err
	}

	rank, err := r.Client.ZRank(ctx, queueKey, userID).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return 0, totalInQueue, nil // User belum antre, tapi total antrian diketahui!
		}
		return 0, totalInQueue, err
	}

	return rank + 1, totalInQueue, nil
}

// GrantCheckoutPass memberikan izin checkout untuk user yang sudah lolos antrian (berlaku 5 menit)
func (r *RedisClient) GrantCheckoutPass(ctx context.Context, eventID, userID string, ttl time.Duration) error {
	passKey := fmt.Sprintf("checkout_pass:%s:%s", eventID, userID)
	queueKey := fmt.Sprintf("waiting_room:%s", eventID)

	// Simpan pass token di Redis
	if err := r.Client.Set(ctx, passKey, "ALLOWED", ttl).Err(); err != nil {
		return err
	}

	// Hapus user dari antrian karena sudah lolos ke meja checkout
	return r.Client.ZRem(ctx, queueKey, userID).Err()
}

// HasCheckoutPass memeriksa apakah user memiliki izin sah untuk checkout
func (r *RedisClient) HasCheckoutPass(ctx context.Context, eventID, userID string) (bool, error) {
	passKey := fmt.Sprintf("checkout_pass:%s:%s", eventID, userID)
	val, err := r.Client.Get(ctx, passKey).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return false, nil // Tidak punya pass
		}
		return false, err
	}
	return val == "ALLOWED", nil
}

// AdmitNextBatch meloloskan N user terdepan dari antrian
func (r *RedisClient) AdmitNextBatch(ctx context.Context, eventID string, batchSize int64, passTTL time.Duration) ([]string, error) {
	queueKey := fmt.Sprintf("waiting_room:%s", eventID)

	// Ambil batchSize user dengan score terlama (terdepan)
	userIDs, err := r.Client.ZRange(ctx, queueKey, 0, batchSize-1).Result()
	if err != nil {
		return nil, err
	}

	for _, uID := range userIDs {
		_ = r.GrantCheckoutPass(ctx, eventID, uID, passTTL)
	}

	return userIDs, nil
}
