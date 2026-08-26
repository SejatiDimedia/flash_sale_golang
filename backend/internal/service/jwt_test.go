package service_test

import (
	"testing"

	"github.com/sejatidimedia/flash_sale_platform/internal/config"
	"github.com/sejatidimedia/flash_sale_platform/internal/service"
)

func TestJWTTokenValidation(t *testing.T) {
	cfg := &config.Config{
		JWTSecret:          "test-super-secret-key-1234567890",
		JWTExpirationHours: "2",
	}

	authSvc := service.NewAuthService(nil, cfg)

	// Test 1: Invalid garbage token should fail
	claims, err := authSvc.ValidateToken("invalid.token.structure")
	if err == nil || claims != nil {
		t.Errorf("expected error for invalid token, got claims: %+v", claims)
	}

	// Test 2: Empty token string should fail
	claims, err = authSvc.ValidateToken("")
	if err == nil || claims != nil {
		t.Errorf("expected error for empty token string, got claims: %+v", claims)
	}
}
