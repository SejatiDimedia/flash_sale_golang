package midtrans

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/sejatidimedia/flash_sale_platform/internal/config"
	"github.com/sony/gobreaker"
)

type Client struct {
	ServerKey   string
	ClientKey   string
	Environment string
	BaseURL     string
	httpClient  *http.Client
	cb          *gobreaker.CircuitBreaker
}

func NewClient(cfg *config.Config) *Client {
	baseURL := "https://app.sandbox.midtrans.com/snap/v1"
	if strings.ToLower(cfg.MidtransEnvironment) == "production" {
		baseURL = "https://app.midtrans.com/snap/v1"
	}

	// 🛡️ Konfigurasi Circuit Breaker untuk mengisolasi kegagalan pihak ketiga (Payment Gateway)
	cbSettings := gobreaker.Settings{
		Name:        "MidtransSnapGateway",
		MaxRequests: 3,                // Jumlah request uji coba yang diizinkan saat status Half-Open
		Interval:    10 * time.Second, // Siklus reset penghitungan metrik saat status Closed
		Timeout:     5 * time.Second,  // Durasi status Open sebelum mencoba ke Half-Open
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			// Trip ke OPEN jika minimal ada 5 request dan rasio kegagalan >= 40%
			failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
			return counts.Requests >= 5 && failureRatio >= 0.4
		},
		OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
			log.Printf("⚡ [CircuitBreaker - %s] Transisi Status: %s -> %s", name, from, to)
		},
	}

	return &Client{
		ServerKey:   cfg.MidtransServerKey,
		ClientKey:   cfg.MidtransClientKey,
		Environment: cfg.MidtransEnvironment,
		BaseURL:     baseURL,
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
		cb: gobreaker.NewCircuitBreaker(cbSettings),
	}
}

// NewClientWithCustomHTTP membuat client dengan HTTP client dan circuit breaker kustom (berguna untuk testing mock)
func NewClientWithCustomHTTP(cfg *config.Config, httpClient *http.Client, cbSettings gobreaker.Settings) *Client {
	baseURL := "https://app.sandbox.midtrans.com/snap/v1"
	if strings.ToLower(cfg.MidtransEnvironment) == "production" {
		baseURL = "https://app.midtrans.com/snap/v1"
	}

	return &Client{
		ServerKey:   cfg.MidtransServerKey,
		ClientKey:   cfg.MidtransClientKey,
		Environment: cfg.MidtransEnvironment,
		BaseURL:     baseURL,
		httpClient:  httpClient,
		cb:          gobreaker.NewCircuitBreaker(cbSettings),
	}
}

type SnapTransactionDetails struct {
	OrderID     string `json:"order_id"`
	GrossAmount int64  `json:"gross_amount"`
}

type SnapCustomerDetails struct {
	FirstName string `json:"first_name"`
	Email     string `json:"email"`
}

type SnapItemDetails struct {
	ID       string `json:"id"`
	Price    int64  `json:"price"`
	Quantity int    `json:"quantity"`
	Name     string `json:"name"`
}

type CreateSnapRequest struct {
	TransactionDetails SnapTransactionDetails `json:"transaction_details"`
	CustomerDetails    SnapCustomerDetails    `json:"customer_details,omitempty"`
	ItemDetails        []SnapItemDetails      `json:"item_details,omitempty"`
}

type SnapResponse struct {
	Token         string   `json:"token"`
	RedirectURL   string   `json:"redirect_url"`
	ErrorMessages []string `json:"error_messages,omitempty"`
}

type NotificationPayload struct {
	TransactionTime   string `json:"transaction_time"`
	TransactionStatus string `json:"transaction_status"`
	TransactionID     string `json:"transaction_id"`
	StatusMessage     string `json:"status_message"`
	StatusCode        string `json:"status_code"`
	SignatureKey      string `json:"signature_key"`
	PaymentType       string `json:"payment_type"`
	OrderID           string `json:"order_id"`
	GrossAmount       string `json:"gross_amount"`
	FraudStatus       string `json:"fraud_status"`
	Currency          string `json:"currency"`
}

// CreateSnapTransaction membuat sesi pembayaran Snap dengan proteksi Circuit Breaker
func (c *Client) CreateSnapTransaction(ctx context.Context, req CreateSnapRequest) (*SnapResponse, error) {
	if c.ServerKey == "" {
		return nil, errors.New("midtrans server key is not configured")
	}

	endpoint := fmt.Sprintf("%s/transactions", c.BaseURL)

	reqBytes, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal snap request: %w", err)
	}

	// Bungkus pemanggilan HTTP eksternal ke dalam Circuit Breaker
	result, err := c.cb.Execute(func() (interface{}, error) {
		httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewBuffer(reqBytes))
		if err != nil {
			return nil, fmt.Errorf("failed to create http request: %w", err)
		}

		authHeader := "Basic " + base64.StdEncoding.EncodeToString([]byte(c.ServerKey+":"))
		httpReq.Header.Set("Authorization", authHeader)
		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("Accept", "application/json")

		resp, err := c.httpClient.Do(httpReq)
		if err != nil {
			return nil, fmt.Errorf("failed to execute snap request: %w", err)
		}
		defer resp.Body.Close()

		bodyBytes, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to read snap response body: %w", err)
		}

		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return nil, fmt.Errorf("midtrans error (status %d): %s", resp.StatusCode, string(bodyBytes))
		}

		var snapResp SnapResponse
		if err := json.Unmarshal(bodyBytes, &snapResp); err != nil {
			return nil, fmt.Errorf("failed to unmarshal snap response: %w", err)
		}

		return &snapResp, nil
	})

	if err != nil {
		if errors.Is(err, gobreaker.ErrOpenState) {
			return nil, errors.New("payment gateway is currently unavailable (circuit open), please try again shortly")
		}
		return nil, err
	}

	snapResp, ok := result.(*SnapResponse)
	if !ok || snapResp == nil {
		return nil, errors.New("invalid snap response")
	}

	return snapResp, nil
}
