package middleware

import (
	"fmt"
	"log"
	"math"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/redisclient"
)

// clientBucket mencatat saldo token dan waktu isi ulang terakhir untuk sebuah client (IP/User)
type clientBucket struct {
	tokens     float64
	lastRefill time.Time
}

// inMemoryLimiter adalah jaring pengaman darurat (fallback limiter) jika Redis mengalami gangguan.
// Menggunakan algoritma Token Bucket langsung di dalam memori RAM proses Go.
type inMemoryLimiter struct {
	mu         sync.Mutex
	clients    map[string]*clientBucket
	limit      int
	window     time.Duration
	refillRate float64 // laju token per detik
	capacity   float64 // kapasitas penampungan maksimum
}

func newInMemoryLimiter(limit int, window time.Duration) *inMemoryLimiter {
	refillRate := float64(limit) / window.Seconds()
	if refillRate <= 0 {
		refillRate = 1
	}

	l := &inMemoryLimiter{
		clients:    make(map[string]*clientBucket),
		limit:      limit,
		window:     window,
		refillRate: refillRate,
		capacity:   float64(limit),
	}

	// Background sweeper: otomatis membersihkan entri klien yang sudah tidak aktif (> 2 menit)
	// agar tidak terjadi kebocoran memori (memory leak) di RAM
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		for range ticker.C {
			l.mu.Lock()
			cutoff := time.Now().Add(-2 * time.Minute)
			for id, b := range l.clients {
				if b.lastRefill.Before(cutoff) {
					delete(l.clients, id)
				}
			}
			l.mu.Unlock()
		}
	}()

	return l
}

// Allow memeriksa dan mengurangi kuota token di memori lokal
func (l *inMemoryLimiter) Allow(identifier string) (bool, int64) {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	bucket, exists := l.clients[identifier]
	if !exists {
		// Client baru: beri kuota penuh lalu kurangi 1 token untuk request saat ini
		bucket = &clientBucket{
			tokens:     l.capacity - 1,
			lastRefill: now,
		}
		l.clients[identifier] = bucket
		return true, int64(bucket.tokens)
	}

	// Refill token berdasarkan durasi waktu yang berlalu sejak request terakhir
	elapsed := now.Sub(bucket.lastRefill).Seconds()
	bucket.tokens = math.Min(l.capacity, bucket.tokens+(elapsed*l.refillRate))
	bucket.lastRefill = now

	// Jika masih ada minimal 1 token, izinkan request
	if bucket.tokens >= 1.0 {
		bucket.tokens -= 1.0
		return true, int64(bucket.tokens)
	}

	// Kuota habis di memori
	return false, 0
}

// RateLimiterMiddleware membatasi laju request per IP atau per User ID (jika terautentikasi)
// dengan arsitektur HYBRID:
// 1. Jalur Utama: Terdistribusi via Redis Sliding Window Lua script.
// 2. Jalur Darurat (Fallback): In-Memory Token Bucket jika Redis mengalami gangguan atau timeout.
func RateLimiterMiddleware(redisClient *redisclient.RedisClient, limit int, window time.Duration) gin.HandlerFunc {
	fallbackLimiter := newInMemoryLimiter(limit, window)

	return func(c *gin.Context) {
		// 1. Bypass untuk pre-flight request dan endpoint pemantauan kesehatan / metrik
		if c.Request.Method == "OPTIONS" || c.Request.URL.Path == "/health" || c.Request.URL.Path == "/metrics" {
			c.Next()
			return
		}

		// 2. Identifikasi Client: Utamakan UserID jika terautentikasi, fallback ke ClientIP
		identifier := "ip:" + c.ClientIP()
		if user := GetUserFromContext(c.Request.Context()); user != nil && user.UserID != "" {
			identifier = "user:" + user.UserID
		}

		var allowed bool
		var remaining int64
		isFallback := false

		// 3. Cek kuota via Redis (Jalur Utama Terdistribusi)
		if redisClient != nil {
			key := fmt.Sprintf("ratelimit:%s", identifier)
			var err error
			allowed, remaining, err = redisClient.AllowRateLimit(c.Request.Context(), key, limit, window)
			if err != nil {
				// ⚠️ REDIS GANGGUAN: Aktifkan In-Memory Fallback agar bot TIDAK TEMBUS!
				log.Printf("⚠️ [RateLimiter] Redis error (%v). Mengaktifkan In-Memory Fallback untuk %s", err, identifier)
				allowed, remaining = fallbackLimiter.Allow(identifier)
				isFallback = true
			}
		} else {
			// Redis client tidak terpasang (misal mode standalone atau testing)
			allowed, remaining = fallbackLimiter.Allow(identifier)
			isFallback = true
		}

		// 4. Set Headers standar IETF RateLimit
		c.Header("X-RateLimit-Limit", strconv.Itoa(limit))
		c.Header("X-RateLimit-Remaining", strconv.FormatInt(remaining, 10))
		if isFallback {
			c.Header("X-RateLimit-Fallback", "in-memory")
		}

		// 5. Tangani jika kuota habis (Blokir bot / spammer)
		if !allowed {
			retrySeconds := int(window.Seconds())
			if retrySeconds <= 0 {
				retrySeconds = 1
			}
			c.Header("Retry-After", strconv.Itoa(retrySeconds))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":               "rate limit exceeded: too many requests, please slow down",
				"retry_after_seconds": retrySeconds,
			})
			return
		}

		c.Next()
	}
}
