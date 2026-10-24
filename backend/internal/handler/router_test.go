package handler_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sejatidimedia/flash_sale_platform/internal/config"
	"github.com/sejatidimedia/flash_sale_platform/internal/handler"
	"github.com/stretchr/testify/assert"
)

func TestSetupRouter_HealthCheck(t *testing.T) {
	cfg := &config.Config{
		Environment: "test",
	}

	router := handler.SetupRouter(handler.RouterDependencies{
		Config: cfg,
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/health", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string]string
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	assert.NoError(t, err)
	assert.Equal(t, "ok", resp["status"])
}
