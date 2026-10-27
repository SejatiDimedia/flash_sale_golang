package midtrans_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/sejatidimedia/flash_sale_platform/internal/config"
	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/midtrans"
	"github.com/sony/gobreaker"
	"github.com/stretchr/testify/assert"
)

func TestCircuitBreaker_TripsToOpen_WhenDownstreamFails(t *testing.T) {
	var httpHitCount int64

	// Mock server yang sengaja merespons 500 Internal Server Error (simulasi Midtrans bermasalah)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt64(&httpHitCount, 1)
		http.Error(w, "internal payment error", http.StatusInternalServerError)
	}))
	defer server.Close()

	cfg := &config.Config{
		MidtransServerKey: "SB-Mid-server-test-key",
	}

	// Buat Circuit Breaker yang siap trip setelah 5 kegagalan
	cbSettings := gobreaker.Settings{
		Name:     "TestMidtransGateway",
		Timeout:  2 * time.Second,
		Interval: 10 * time.Second,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			return counts.ConsecutiveFailures >= 5
		},
	}

	client := midtrans.NewClientWithCustomHTTP(cfg, server.Client(), cbSettings)
	client.BaseURL = server.URL

	req := midtrans.CreateSnapRequest{
		TransactionDetails: midtrans.SnapTransactionDetails{
			OrderID:     "ORD-TEST-123",
			GrossAmount: 100000,
		},
	}

	ctx := context.Background()

	// 1. Eksekusi 5 kali kegagalan berturut-turut untuk memicu Circuit Breaker menjadi OPEN
	for i := 1; i <= 5; i++ {
		_, err := client.CreateSnapTransaction(ctx, req)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "midtrans error")
	}

	assert.Equal(t, int64(5), atomic.LoadInt64(&httpHitCount), "Server harus menerima tepat 5 request")

	// 2. Request ke-6: Circuit Breaker SEKARANG HARUS DALAM STATUS OPEN!
	// Request ini harus langsung ditolak seketika (Fail-Fast) tanpa menyentuh jaringan HTTP!
	_, err := client.CreateSnapTransaction(ctx, req)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "circuit open", "Request ke-6 harus gagal karena status Circuit Breaker OPEN")

	// 3. Verifikasi bahwa request ke-6 TIDAK PERNAH sampai ke server HTTP
	assert.Equal(t, int64(5), atomic.LoadInt64(&httpHitCount), "Server HTTP tidak boleh menerima request ke-6 karena sudah diputus oleh Circuit Breaker!")
}
