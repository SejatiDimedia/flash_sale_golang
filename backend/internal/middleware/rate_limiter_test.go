package middleware_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sejatidimedia/flash_sale_platform/internal/config"
	"github.com/sejatidimedia/flash_sale_platform/internal/middleware"
	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/redisclient"
	"github.com/stretchr/testify/assert"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestRateLimiterMiddleware_InMemoryFallback_WhenNilRedis(t *testing.T) {
	r := gin.New()
	limit := 3
	r.Use(middleware.RateLimiterMiddleware(nil, limit, 1*time.Second))
	r.GET("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	testIP := "10.0.0.1:9999"

	// 3 request pertama harus berhasil lewat in-memory fallback
	for i := 1; i <= limit; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/test", nil)
		req.RemoteAddr = testIP
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code, "Request %d harus berhasil", i)
		assert.Equal(t, "in-memory", w.Header().Get("X-RateLimit-Fallback"))
		assert.Equal(t, "3", w.Header().Get("X-RateLimit-Limit"))
	}

	// Request ke-4 harus diblokir oleh In-Memory Fallback (HTTP 429)
	wBlocked := httptest.NewRecorder()
	reqBlocked, _ := http.NewRequest(http.MethodGet, "/test", nil)
	reqBlocked.RemoteAddr = testIP
	r.ServeHTTP(wBlocked, reqBlocked)

	assert.Equal(t, http.StatusTooManyRequests, wBlocked.Code, "Request ke-4 harus diblokir oleh In-Memory Fallback")
	assert.Equal(t, "in-memory", wBlocked.Header().Get("X-RateLimit-Fallback"))
	assert.Contains(t, wBlocked.Body.String(), "rate limit exceeded")
}

func TestRateLimiterMiddleware_BypassHealthAndMetrics(t *testing.T) {
	r := gin.New()
	r.Use(middleware.RateLimiterMiddleware(nil, 1, time.Second))
	r.GET("/health", func(c *gin.Context) {
		c.String(http.StatusOK, "healthy")
	})

	for i := 0; i < 5; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/health", nil)
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	}
}

func TestRateLimiterMiddleware_WithLiveRedis(t *testing.T) {
	cfg := &config.Config{
		RedisAddr:     "localhost:6379",
		RedisPassword: "",
	}
	client, err := redisclient.NewRedisClient(cfg)
	if err != nil {
		t.Skip("Redis is not available locally, skipping live integration test")
		return
	}

	testIP := "192.168.1.100"
	limit := 3
	window := 1 * time.Second

	r := gin.New()
	r.Use(middleware.RateLimiterMiddleware(client, limit, window))
	r.GET("/api/action", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "success"})
	})

	// Bersihkan key sebelum test
	_ = client.Client.Del(context.Background(), "ratelimit:ip:"+testIP).Err()

	// 3 request pertama harus berhasil (200 OK)
	for i := 1; i <= limit; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/api/action", nil)
		req.RemoteAddr = testIP + ":12345"
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code, "Request %d harus berhasil", i)
		assert.Equal(t, "3", w.Header().Get("X-RateLimit-Limit"))
	}

	// Request ke-4 harus ditolak dengan HTTP 429 Too Many Requests
	wBlocked := httptest.NewRecorder()
	reqBlocked, _ := http.NewRequest(http.MethodGet, "/api/action", nil)
	reqBlocked.RemoteAddr = testIP + ":12345"
	r.ServeHTTP(wBlocked, reqBlocked)

	assert.Equal(t, http.StatusTooManyRequests, wBlocked.Code, "Request ke-4 harus diblokir oleh Rate Limiter")
	assert.Equal(t, "1", wBlocked.Header().Get("Retry-After"))
	assert.Contains(t, wBlocked.Body.String(), "rate limit exceeded")
}
