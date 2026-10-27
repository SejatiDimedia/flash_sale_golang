package redisclient

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockPinger mensimulasikan latensi atau error dari PostgreSQL
type mockPinger struct {
	delay time.Duration
	err   error
}

func (m *mockPinger) Ping(ctx context.Context) error {
	if m.delay > 0 {
		time.Sleep(m.delay)
	}
	return m.err
}

// TestCalculateAdaptiveBatch menguji 4 zona latensi sistem untuk Adaptive Concurrency Control
func TestCalculateAdaptiveBatch(t *testing.T) {
	baseBatch := int64(50)

	t.Run("Zona Optimal (Latency < 20ms): Kapasitas dinaikkan 1.5x", func(t *testing.T) {
		batch, status, scale := CalculateAdaptiveBatch(baseBatch, 10*time.Millisecond, false)
		assert.Equal(t, int64(75), batch)
		assert.Equal(t, StatusOptimal, status)
		assert.Equal(t, 1.5, scale)
	})

	t.Run("Zona Nominal (20ms <= Latency <= 50ms): Kapasitas standar 1.0x", func(t *testing.T) {
		batch, status, scale := CalculateAdaptiveBatch(baseBatch, 35*time.Millisecond, false)
		assert.Equal(t, int64(50), batch)
		assert.Equal(t, StatusNominal, status)
		assert.Equal(t, 1.0, scale)
	})

	t.Run("Zona Degraded (50ms < Latency <= 100ms): Kapasitas dipotong 50%", func(t *testing.T) {
		batch, status, scale := CalculateAdaptiveBatch(baseBatch, 70*time.Millisecond, false)
		assert.Equal(t, int64(25), batch)
		assert.Equal(t, StatusDegraded, status)
		assert.Equal(t, 0.5, scale)
	})

	t.Run("Zona Critical (Latency > 100ms): Proteksi darurat ke batas minimum", func(t *testing.T) {
		batch, status, _ := CalculateAdaptiveBatch(baseBatch, 150*time.Millisecond, false)
		assert.Equal(t, int64(10), batch)
		assert.Equal(t, StatusCritical, status)
	})

	t.Run("Zona Critical (Database Error): Emergency throttle", func(t *testing.T) {
		batch, status, _ := CalculateAdaptiveBatch(baseBatch, 5*time.Millisecond, true)
		assert.Equal(t, int64(10), batch)
		assert.Equal(t, StatusCritical, status)
	})
}

// TestAdmitNextBatchAdaptive memverifikasi integrasi penuh antrean Redis dengan penyesuaian adaptif
func TestAdmitNextBatchAdaptive(t *testing.T) {
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	client := &RedisClient{Client: rdb}
	ctx := context.Background()
	eventID := "ev-flash-sale"

	// Masukkan 100 user ke dalam Waiting Room (ZSET)
	for i := 1; i <= 100; i++ {
		uID := fmt.Sprintf("user-%03d", i)
		_, err := client.JoinWaitingRoom(ctx, eventID, uID)
		require.NoError(t, err)
	}

	t.Run("Kondisi Database Sehat (Optimal) meloloskan 75 user", func(t *testing.T) {
		pinger := &mockPinger{delay: 2 * time.Millisecond, err: nil}
		res, err := client.AdmitNextBatchAdaptive(ctx, eventID, 50, 5*time.Minute, pinger)
		require.NoError(t, err)

		assert.Equal(t, StatusOptimal, res.HealthStatus)
		assert.Equal(t, int64(75), res.AdaptedBatchSize)
		assert.Len(t, res.AdmittedUsers, 75)

		// Verifikasi bahwa user pertama (user-001) sah memiliki checkout pass
		hasPass, err := client.HasCheckoutPass(ctx, eventID, "user-001")
		require.NoError(t, err)
		assert.True(t, hasPass)

		// Verifikasi bahwa user di luar batch (user-080) belum memiliki checkout pass
		hasPassNotYet, err := client.HasCheckoutPass(ctx, eventID, "user-080")
		require.NoError(t, err)
		assert.False(t, hasPassNotYet)
	})

	t.Run("Kondisi Database Tertekan (Degraded) membatasi batch size", func(t *testing.T) {
		pinger := &mockPinger{delay: 60 * time.Millisecond, err: nil}
		res, err := client.AdmitNextBatchAdaptive(ctx, eventID, 50, 5*time.Minute, pinger)
		require.NoError(t, err)

		assert.Equal(t, StatusDegraded, res.HealthStatus)
		assert.Equal(t, int64(25), res.AdaptedBatchSize)
		// Dari sisa 25 user (user-076 s/d user-100), semuanya terambil
		assert.Len(t, res.AdmittedUsers, 25)
	})

	t.Run("Kondisi Database Error (Critical) throttle ke minimum", func(t *testing.T) {
		// Isi 20 user baru
		for i := 101; i <= 120; i++ {
			_, _ = client.JoinWaitingRoom(ctx, eventID, fmt.Sprintf("user-%d", i))
		}

		pinger := &mockPinger{delay: 0, err: errors.New("db connection failure")}
		res, err := client.AdmitNextBatchAdaptive(ctx, eventID, 50, 5*time.Minute, pinger)
		require.NoError(t, err)

		assert.Equal(t, StatusCritical, res.HealthStatus)
		assert.Equal(t, int64(10), res.AdaptedBatchSize)
		assert.Len(t, res.AdmittedUsers, 10)
	})
}
