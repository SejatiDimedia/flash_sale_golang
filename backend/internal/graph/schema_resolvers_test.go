package graph_test

import (
	"context"
	"strings"
	"testing"

	"github.com/sejatidimedia/flash_sale_platform/internal/graph"
	"github.com/sejatidimedia/flash_sale_platform/internal/graph/model"
	"github.com/sejatidimedia/flash_sale_platform/internal/middleware"
	"github.com/sejatidimedia/flash_sale_platform/internal/service"
)

// ============================================================================
// GRAPHQL RESOLVERS TEST: OTORISASI & VALIDASI INPUT (CLEAN ERRORS)
// ============================================================================

func TestResolver_Authorization_RBAC(t *testing.T) {
	// Setup resolver dengan dependencies kosong / nil untuk menguji gatekeeper authorization di resolver layer
	resolver := &graph.Resolver{}
	mutation := resolver.Mutation()
	query := resolver.Query()

	ctxGuest := context.Background()
	ctxUser := context.WithValue(ctxGuest, middleware.UserContextKey, &service.JWTClaims{
		UserID: "usr-regular-123",
		Email:  "user@example.com",
		Role:   "user",
	})

	t.Run("Guest cannot purchase ticket", func(t *testing.T) {
		_, err := mutation.PurchaseTicket(ctxGuest, "ev-1", 1)
		if err == nil || !strings.Contains(err.Error(), "unauthorized") {
			t.Errorf("Expected unauthorized error, got %v", err)
		}
	})

	t.Run("Guest cannot join waiting room", func(t *testing.T) {
		_, err := mutation.JoinWaitingRoom(ctxGuest, "ev-1")
		if err == nil || !strings.Contains(err.Error(), "unauthorized") {
			t.Errorf("Expected unauthorized error, got %v", err)
		}
	})

	t.Run("Guest cannot view my orders", func(t *testing.T) {
		_, err := query.MyOrders(ctxGuest)
		if err == nil || !strings.Contains(err.Error(), "unauthorized") {
			t.Errorf("Expected unauthorized error, got %v", err)
		}
	})

	t.Run("Guest cannot view me", func(t *testing.T) {
		_, err := query.Me(ctxGuest)
		if err == nil || !strings.Contains(err.Error(), "unauthorized") {
			t.Errorf("Expected unauthorized error, got %v", err)
		}
	})

	t.Run("Regular user cannot admit users from waiting room (Admin only)", func(t *testing.T) {
		_, err := mutation.AdmitUsers(ctxUser, "ev-1", 50)
		if err == nil || !strings.Contains(err.Error(), "forbidden") {
			t.Errorf("Expected forbidden error for non-admin, got %v", err)
		}
	})

	t.Run("Regular user cannot set gate mode (Admin only)", func(t *testing.T) {
		_, err := mutation.SetGateMode(ctxUser, "ev-1", "MANUAL")
		if err == nil || !strings.Contains(err.Error(), "forbidden") {
			t.Errorf("Expected forbidden error for non-admin, got %v", err)
		}
	})

	t.Run("Regular user cannot view all admin orders", func(t *testing.T) {
		_, err := query.Orders(ctxUser, nil)
		if err == nil || !strings.Contains(err.Error(), "forbidden") {
			t.Errorf("Expected forbidden error for non-admin, got %v", err)
		}
	})

	t.Run("Regular user cannot view admin order logs", func(t *testing.T) {
		_, err := query.OrderLogs(ctxUser, "order-123")
		if err == nil || !strings.Contains(err.Error(), "forbidden") {
			t.Errorf("Expected forbidden error for non-admin, got %v", err)
		}
	})
}

func TestResolver_InputValidation_DateFormats(t *testing.T) {
	resolver := &graph.Resolver{}
	mutation := resolver.Mutation()

	ctxAdmin := context.WithValue(context.Background(), middleware.UserContextKey, &service.JWTClaims{
		UserID: "admin-123",
		Email:  "admin@example.com",
		Role:   "admin",
	})

	t.Run("Invalid startSaleAt RFC3339 format returns clean error", func(t *testing.T) {
		input := model.CreateEventInput{
			Name:        "Test Event",
			StartSaleAt: "invalid-date-string",
			EndSaleAt:   "2026-10-01T10:00:00Z",
			TotalStock:  100,
			Price:       50000,
		}
		_, err := mutation.CreateEvent(ctxAdmin, input)
		if err == nil || !strings.Contains(err.Error(), "invalid startSaleAt format") {
			t.Errorf("Expected invalid date error, got %v", err)
		}
	})

	t.Run("Invalid endSaleAt RFC3339 format returns clean error", func(t *testing.T) {
		input := model.CreateEventInput{
			Name:        "Test Event",
			StartSaleAt: "2026-10-01T10:00:00Z",
			EndSaleAt:   "not-a-timestamp",
			TotalStock:  100,
			Price:       50000,
		}
		_, err := mutation.CreateEvent(ctxAdmin, input)
		if err == nil || !strings.Contains(err.Error(), "invalid endSaleAt format") {
			t.Errorf("Expected invalid date error, got %v", err)
		}
	})
}

func TestResolver_HealthCheck(t *testing.T) {
	resolver := &graph.Resolver{}
	query := resolver.Query()

	res, err := query.HealthCheck(context.Background())
	if err != nil {
		t.Fatalf("HealthCheck failed: %v", err)
	}
	if !strings.Contains(res, "running smoothly") {
		t.Errorf("Unexpected healthCheck response: %s", res)
	}
}
