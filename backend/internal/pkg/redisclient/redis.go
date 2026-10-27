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

// SetStock memperbarui jumlah stok di Redis secara langsung (digunakan untuk rekonsiliasi data drift)
func (r *RedisClient) SetStock(ctx context.Context, eventID string, stock int) error {
	key := fmt.Sprintf("stock:%s", eventID)
	return r.Client.Set(ctx, key, stock, 0).Err()
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

// SystemHealthStatus melambangkan kondisi beban database downstream
type SystemHealthStatus string

const (
	StatusOptimal  SystemHealthStatus = "OPTIMAL"  // Latency < 20ms: DB sangat lega, scale-up batch size (1.5x)
	StatusNominal  SystemHealthStatus = "NOMINAL"  // 20ms <= Latency <= 50ms: DB normal, gunakan base batch size
	StatusDegraded SystemHealthStatus = "DEGRADED" // 50ms < Latency <= 100ms: DB mulai tertekan, kurangi batch size (50%)
	StatusCritical SystemHealthStatus = "CRITICAL" // Latency > 100ms atau DB Error: Proteksi darurat, throttle ke batas minimum
)

// AdaptiveBatchResult merangkum hasil penyesuaian dinamis gerbang antrean
type AdaptiveBatchResult struct {
	AdmittedUsers     []string           `json:"admitted_users"`
	OriginalBatchSize int64              `json:"original_batch_size"`
	AdaptedBatchSize  int64              `json:"adapted_batch_size"`
	DownstreamLatency time.Duration      `json:"downstream_latency"`
	HealthStatus      SystemHealthStatus `json:"health_status"`
	ScaleFactor       float64            `json:"scale_factor"`
}

// DBPinger merepresentasikan komponen downstream (seperti PostgreSQL pool atau repository) yang dapat di-ping
type DBPinger interface {
	Ping(ctx context.Context) error
}

// CalculateAdaptiveBatch menghitung ukuran batch dinamis berdasarkan latensi dan error status downstream (US-13)
func CalculateAdaptiveBatch(baseBatch int64, latency time.Duration, hasError bool) (int64, SystemHealthStatus, float64) {
	if baseBatch <= 0 {
		baseBatch = 50
	}

	minBatch := int64(10)
	if baseBatch < minBatch {
		minBatch = baseBatch
	}
	maxBatch := baseBatch * 2

	if hasError || latency > 100*time.Millisecond {
		scaleFactor := float64(minBatch) / float64(baseBatch)
		return minBatch, StatusCritical, scaleFactor
	}

	if latency > 50*time.Millisecond {
		adapted := baseBatch / 2
		if adapted < minBatch {
			adapted = minBatch
		}
		scaleFactor := float64(adapted) / float64(baseBatch)
		return adapted, StatusDegraded, scaleFactor
	}

	if latency > 20*time.Millisecond {
		return baseBatch, StatusNominal, 1.0
	}

	// Latency <= 20ms: Kondisi optimal, tingkatkan throughput antrean (150% kapasitas)
	adapted := int64(float64(baseBatch) * 1.5)
	if adapted > maxBatch {
		adapted = maxBatch
	}
	scaleFactor := float64(adapted) / float64(baseBatch)
	return adapted, StatusOptimal, scaleFactor
}

// AdmitNextBatchAdaptive meloloskan user dengan ukuran batch yang disesuaikan secara dinamis
// berdasarkan kesehatan dan latensi database (Adaptive Concurrency Control).
func (r *RedisClient) AdmitNextBatchAdaptive(
	ctx context.Context,
	eventID string,
	baseBatch int64,
	passTTL time.Duration,
	pinger DBPinger,
) (*AdaptiveBatchResult, error) {
	var latency time.Duration
	var hasError bool

	if pinger != nil {
		start := time.Now()
		pingCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
		err := pinger.Ping(pingCtx)
		cancel()
		latency = time.Since(start)
		if err != nil {
			hasError = true
		}
	} else {
		// Jika pinger tidak diberikan, asumsikan nominal latency
		latency = 30 * time.Millisecond
	}

	adaptedBatch, healthStatus, scaleFactor := CalculateAdaptiveBatch(baseBatch, latency, hasError)

	admittedUsers, err := r.AdmitNextBatch(ctx, eventID, adaptedBatch, passTTL)
	if err != nil {
		return nil, err
	}

	return &AdaptiveBatchResult{
		AdmittedUsers:     admittedUsers,
		OriginalBatchSize: baseBatch,
		AdaptedBatchSize:  adaptedBatch,
		DownstreamLatency: latency,
		HealthStatus:      healthStatus,
		ScaleFactor:       scaleFactor,
	}, nil
}


// SetGateMode menyimpan mode Waiting Room untuk suatu event ("AUTO" atau "MANUAL")
func (r *RedisClient) SetGateMode(ctx context.Context, eventID, mode string) error {
	key := fmt.Sprintf("waiting_room:gate_mode:%s", eventID)
	// Jika beralih ke MANUAL, bersihkan pass lama agar antrian benar-benar tertahan
	if mode == "MANUAL" {
		_ = r.ClearCheckoutPasses(ctx, eventID)
	}
	return r.Client.Set(ctx, key, mode, 0).Err()
}

// DeleteCheckoutPass menghapus pass checkout user setelah berhasil transaksi (Single-Use Token)
func (r *RedisClient) DeleteCheckoutPass(ctx context.Context, eventID, userID string) error {
	passKey := fmt.Sprintf("checkout_pass:%s:%s", eventID, userID)
	return r.Client.Del(ctx, passKey).Err()
}

// ClearCheckoutPasses menghapus semua checkout pass aktif untuk event tertentu
func (r *RedisClient) ClearCheckoutPasses(ctx context.Context, eventID string) error {
	pattern := fmt.Sprintf("checkout_pass:%s:*", eventID)
	iter := r.Client.Scan(ctx, 0, pattern, 0).Iterator()
	for iter.Next(ctx) {
		_ = r.Client.Del(ctx, iter.Val()).Err()
	}
	return iter.Err()
}

// GetGateMode mengambil mode Waiting Room untuk suatu event (Default: "AUTO")
func (r *RedisClient) GetGateMode(ctx context.Context, eventID string) (string, error) {
	key := fmt.Sprintf("waiting_room:gate_mode:%s", eventID)
	val, err := r.Client.Get(ctx, key).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return "AUTO", nil // Default ke AUTO agar pengalaman booking lancar
		}
		return "AUTO", err
	}
	return val, nil
}

// ==========================================
// 🔑 IDEMPOTENCY KEY MANAGEMENT (REDIS)
// ==========================================

// AcquireIdempotencyLock mencoba mengunci idempotency key dengan status "PROCESSING".
// Mengembalikan true jika lock berhasil didapat (request pertama), false jika key sudah ada.
func (r *RedisClient) AcquireIdempotencyLock(ctx context.Context, userID, key string, ttl time.Duration) (bool, error) {
	redisKey := fmt.Sprintf("idempotency:%s:%s", userID, key)
	return r.Client.SetNX(ctx, redisKey, "PROCESSING", ttl).Result()
}

// GetIdempotencyValue mengambil nilai atau status idempotency key
func (r *RedisClient) GetIdempotencyValue(ctx context.Context, userID, key string) (string, error) {
	redisKey := fmt.Sprintf("idempotency:%s:%s", userID, key)
	val, err := r.Client.Get(ctx, redisKey).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return "", nil
		}
		return "", err
	}
	return val, nil
}

// SaveIdempotencyResult menyimpan hasil akhir order (order ID) ke idempotency key
func (r *RedisClient) SaveIdempotencyResult(ctx context.Context, userID, key, orderID string, ttl time.Duration) error {
	redisKey := fmt.Sprintf("idempotency:%s:%s", userID, key)
	return r.Client.Set(ctx, redisKey, orderID, ttl).Err()
}

// ReleaseIdempotencyLock menghapus lock idempotency jika proses gagal di tengah jalan
func (r *RedisClient) ReleaseIdempotencyLock(ctx context.Context, userID, key string) error {
	redisKey := fmt.Sprintf("idempotency:%s:%s", userID, key)
	return r.Client.Del(ctx, redisKey).Err()
}

// ==========================================
// 🛡️ DISTRIBUTED RATE LIMITER (SLIDING WINDOW)
// ==========================================

// rateLimiterScript adalah skrip Lua atomik untuk algoritma Sliding Window Log berbasis Redis Sorted Set (ZSET).
// Menghilangkan race condition antar-instance backend saat menghitung kuota request dalam window waktu.
var rateLimiterScript = redis.NewScript(`
	local key = KEYS[1]
	local now = tonumber(ARGV[1])
	local window = tonumber(ARGV[2])
	local limit = tonumber(ARGV[3])
	local clearBefore = now - window

	-- 1. Hapus catatan request yang sudah kadaluwarsa di luar window
	redis.call('ZREMRANGEBYSCORE', key, '-inf', clearBefore)

	-- 2. Hitung jumlah request aktif dalam window saat ini
	local currentRequests = redis.call('ZCARD', key)

	-- 3. Jika masih di bawah batas limit, izinkan dan tambahkan timestamp request ini
	if currentRequests < limit then
		redis.call('ZADD', key, now, now)
		redis.call('PEXPIRE', key, window)
		return {1, limit - currentRequests - 1}
	else
		return {0, 0}
	end
`)

// AllowRateLimit mengecek apakah request diizinkan berdasarkan Sliding Window Log di Redis.
// Mengembalikan:
// - allowed (bool): true jika request diizinkan, false jika melebihi batas.
// - remaining (int64): sisa kuota request yang tersisa di dalam window saat ini.
// - err (error): kegagalan koneksi ke Redis (bisa dijadikan acuan untuk fail-open).
func (r *RedisClient) AllowRateLimit(ctx context.Context, key string, limit int, window time.Duration) (bool, int64, error) {
	if r == nil || r.Client == nil {
		return true, int64(limit), nil // Fail-open jika redis client tidak terpasang
	}

	nowMs := time.Now().UnixNano() / int64(time.Millisecond)
	windowMs := window.Milliseconds()

	res, err := rateLimiterScript.Run(ctx, r.Client, []string{key}, nowMs, windowMs, limit).Slice()
	if err != nil {
		return true, 0, fmt.Errorf("rate limiter redis error: %w", err)
	}

	allowedInt, _ := res[0].(int64)
	remaining, _ := res[1].(int64)

	return allowedInt == 1, remaining, nil
}

