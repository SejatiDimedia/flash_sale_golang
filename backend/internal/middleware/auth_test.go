package middleware_test

import (
	"context"
	"testing"

	"github.com/sejatidimedia/flash_sale_platform/internal/middleware"
	"github.com/sejatidimedia/flash_sale_platform/internal/service"
)

func TestGetUserFromContext(t *testing.T) {
	// Case 1: Empty context (unauthenticated guest)
	ctx := context.Background()
	if user := middleware.GetUserFromContext(ctx); user != nil {
		t.Errorf("expected nil user from empty context, got %+v", user)
	}

	// Case 2: Populated context (authenticated user)
	expectedClaims := &service.JWTClaims{
		UserID: "usr-test-123",
		Email:  "john@example.com",
		Role:   "admin",
	}
	ctxWithUser := context.WithValue(ctx, middleware.UserContextKey, expectedClaims)
	user := middleware.GetUserFromContext(ctxWithUser)

	if user == nil {
		t.Fatalf("expected valid user claims, got nil")
	}
	if user.UserID != expectedClaims.UserID {
		t.Errorf("expected user ID %s, got %s", expectedClaims.UserID, user.UserID)
	}
	if user.Role != expectedClaims.Role {
		t.Errorf("expected role %s, got %s", expectedClaims.Role, user.Role)
	}
}
