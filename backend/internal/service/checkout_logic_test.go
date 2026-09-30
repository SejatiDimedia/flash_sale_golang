package service_test

import (
	"errors"
	"testing"
	"time"
)

// ============================================================================
// 1. UNIT TEST: PERHITUNGAN HARGA & VALIDASI KUANTITAS TIKET (TABLE-DRIVEN)
// ============================================================================

func calculateTotalPrice(price float64, quantity int) (float64, error) {
	if quantity <= 0 {
		return 0, errors.New("quantity must be at least 1")
	}
	if price < 0 {
		return 0, errors.New("price cannot be negative")
	}
	return price * float64(quantity), nil
}

func TestCalculateTotalPrice(t *testing.T) {
	tests := []struct {
		name          string
		price         float64
		quantity      int
		expectedTotal float64
		expectErr     bool
	}{
		{
			name:          "Valid standard ticket price",
			price:         150000.0,
			quantity:      2,
			expectedTotal: 300000.0,
			expectErr:     false,
		},
		{
			name:          "Single VIP ticket",
			price:         1250000.50,
			quantity:      1,
			expectedTotal: 1250000.50,
			expectErr:     false,
		},
		{
			name:          "Free community ticket (price 0)",
			price:         0.0,
			quantity:      4,
			expectedTotal: 0.0,
			expectErr:     false,
		},
		{
			name:          "Invalid quantity 0",
			price:         100000.0,
			quantity:      0,
			expectedTotal: 0,
			expectErr:     true,
		},
		{
			name:          "Invalid negative quantity",
			price:         100000.0,
			quantity:      -5,
			expectedTotal: 0,
			expectErr:     true,
		},
		{
			name:          "Invalid negative price",
			price:         -50000.0,
			quantity:      2,
			expectedTotal: 0,
			expectErr:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			total, err := calculateTotalPrice(tt.price, tt.quantity)
			if (err != nil) != tt.expectErr {
				t.Fatalf("expected error: %v, got: %v", tt.expectErr, err)
			}
			if !tt.expectErr && total != tt.expectedTotal {
				t.Errorf("expected total %.2f, got %.2f", tt.expectedTotal, total)
			}
		})
	}
}

// ============================================================================
// 2. UNIT TEST: LOGIKA STOK & BATAS KUOTA PER USER (ANTI-SCALPING) (TABLE-DRIVEN)
// ============================================================================

func validatePurchaseQuota(currentPurchased, requestedQty, maxPerUser int) error {
	if requestedQty <= 0 {
		return errors.New("quantity must be at least 1")
	}
	if maxPerUser <= 0 {
		maxPerUser = 1
	}
	if currentPurchased+requestedQty > maxPerUser {
		return errors.New("purchase exceeds maximum quota limit per user")
	}
	return nil
}

func TestValidatePurchaseQuota(t *testing.T) {
	tests := []struct {
		name             string
		currentPurchased int
		requestedQty     int
		maxPerUser       int
		expectErr        bool
	}{
		{
			name:             "First purchase within limit (1 of 2)",
			currentPurchased: 0,
			requestedQty:     1,
			maxPerUser:       2,
			expectErr:        false,
		},
		{
			name:             "Exact limit reached (2 of 2)",
			currentPurchased: 0,
			requestedQty:     2,
			maxPerUser:       2,
			expectErr:        false,
		},
		{
			name:             "Second purchase within limit (1 existing + 1 new <= 2)",
			currentPurchased: 1,
			requestedQty:     1,
			maxPerUser:       2,
			expectErr:        false,
		},
		{
			name:             "Exceeds limit on first purchase (3 requested > 2 max)",
			currentPurchased: 0,
			requestedQty:     3,
			maxPerUser:       2,
			expectErr:        true,
		},
		{
			name:             "Exceeds limit on subsequent purchase (1 existing + 2 new > 2 max)",
			currentPurchased: 1,
			requestedQty:     2,
			maxPerUser:       2,
			expectErr:        true,
		},
		{
			name:             "User already has max quota (2 existing + 1 new > 2 max)",
			currentPurchased: 2,
			requestedQty:     1,
			maxPerUser:       2,
			expectErr:        true,
		},
		{
			name:             "Strict 1 ticket per user limit (Anti-Scalper)",
			currentPurchased: 1,
			requestedQty:     1,
			maxPerUser:       1,
			expectErr:        true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validatePurchaseQuota(tt.currentPurchased, tt.requestedQty, tt.maxPerUser)
			if (err != nil) != tt.expectErr {
				t.Fatalf("expected error: %v, got: %v", tt.expectErr, err)
			}
		})
	}
}

// ============================================================================
// 3. UNIT TEST: VALIDASI STATUS EVENT (TABLE-DRIVEN)
// ============================================================================

func validateEventStatus(status string) error {
	switch status {
	case "active":
		return nil
	case "draft":
		return errors.New("event is still in draft mode")
	case "scheduled":
		return errors.New("flash sale has not started yet")
	case "closed":
		return errors.New("flash sale is already closed")
	default:
		return errors.New("invalid event status")
	}
}

func TestValidateEventStatus(t *testing.T) {
	tests := []struct {
		name      string
		status    string
		expectErr bool
	}{
		{
			name:      "Event is Active and ready for purchase",
			status:    "active",
			expectErr: false,
		},
		{
			name:      "Event is still in Draft",
			status:    "draft",
			expectErr: true,
		},
		{
			name:      "Event is Scheduled for future",
			status:    "scheduled",
			expectErr: true,
		},
		{
			name:      "Event is Closed / Finished",
			status:    "closed",
			expectErr: true,
		},
		{
			name:      "Unknown arbitrary status",
			status:    "archived",
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateEventStatus(tt.status)
			if (err != nil) != tt.expectErr {
				t.Fatalf("expected error: %v, got: %v", tt.expectErr, err)
			}
		})
	}
}

// ============================================================================
// 4. UNIT TEST: LOGIKA ANTREAN WAITING ROOM & ESTIMASI WAKTU TUNGGU
// ============================================================================

func calculateQueueMetrics(rank int64, totalInQueue int64, secondsPerUser int) (estWaitSec int, isAllowed bool) {
	if rank <= 0 {
		return 0, false
	}
	// Estimasi waktu tunggu: rank * secondsPerUser
	estWaitSec = int(rank) * secondsPerUser
	return estWaitSec, false
}

func TestWaitingRoomQueueMetrics(t *testing.T) {
	tests := []struct {
		name            string
		rank            int64
		totalInQueue    int64
		secondsPerUser  int
		expectedWaitSec int
	}{
		{
			name:            "Front of queue (Position 1)",
			rank:            1,
			totalInQueue:    50,
			secondsPerUser:  2,
			expectedWaitSec: 2,
		},
		{
			name:            "Middle of queue (Position 25)",
			rank:            25,
			totalInQueue:    100,
			secondsPerUser:  2,
			expectedWaitSec: 50,
		},
		{
			name:            "Large surge (Position 500)",
			rank:            500,
			totalInQueue:    2000,
			secondsPerUser:  1,
			expectedWaitSec: 500,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			estWait, _ := calculateQueueMetrics(tt.rank, tt.totalInQueue, tt.secondsPerUser)
			if estWait != tt.expectedWaitSec {
				t.Errorf("expected wait %d sec, got %d sec", tt.expectedWaitSec, estWait)
			}
		})
	}
}

// ============================================================================
// 5. UNIT TEST: LOGIKA KEDALUWARSA RESERVASI (RESERVATION EXPIRATION)
// ============================================================================

func isReservationExpired(createdAt time.Time, ttl time.Duration, currentTime time.Time) bool {
	expiresAt := createdAt.Add(ttl)
	return currentTime.After(expiresAt)
}

func TestReservationExpiration(t *testing.T) {
	baseTime := time.Date(2026, 9, 30, 12, 0, 0, 0, time.UTC)
	ttl := 10 * time.Minute

	tests := []struct {
		name        string
		createdAt   time.Time
		currentTime time.Time
		wantExpired bool
	}{
		{
			name:        "Fresh reservation (1 minute after creation)",
			createdAt:   baseTime,
			currentTime: baseTime.Add(1 * time.Minute),
			wantExpired: false,
		},
		{
			name:        "Reservation halfway through TTL (5 minutes)",
			createdAt:   baseTime,
			currentTime: baseTime.Add(5 * time.Minute),
			wantExpired: false,
		},
		{
			name:        "Reservation exactly at TTL boundary (10 minutes)",
			createdAt:   baseTime,
			currentTime: baseTime.Add(10 * time.Minute),
			wantExpired: false, // After evaluates strictly >
		},
		{
			name:        "Reservation expired by 1 second (10 minutes 1 second)",
			createdAt:   baseTime,
			currentTime: baseTime.Add(10*time.Minute + 1*time.Second),
			wantExpired: true,
		},
		{
			name:        "Reservation severely expired (30 minutes later)",
			createdAt:   baseTime,
			currentTime: baseTime.Add(30 * time.Minute),
			wantExpired: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isReservationExpired(tt.createdAt, ttl, tt.currentTime)
			if got != tt.wantExpired {
				t.Errorf("isReservationExpired() = %v, want %v", got, tt.wantExpired)
			}
		})
	}
}
