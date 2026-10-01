package midtrans

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/sejatidimedia/flash_sale_platform/internal/config"
)

type Client struct {
	ServerKey   string
	ClientKey   string
	Environment string
	BaseURL     string
	httpClient  *http.Client
}

func NewClient(cfg *config.Config) *Client {
	baseURL := "https://app.sandbox.midtrans.com/snap/v1"
	if strings.ToLower(cfg.MidtransEnvironment) == "production" {
		baseURL = "https://app.midtrans.com/snap/v1"
	}

	return &Client{
		ServerKey:   cfg.MidtransServerKey,
		ClientKey:   cfg.MidtransClientKey,
		Environment: cfg.MidtransEnvironment,
		BaseURL:     baseURL,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
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

func (c *Client) CreateSnapTransaction(ctx context.Context, req CreateSnapRequest) (*SnapResponse, error) {
	if c.ServerKey == "" {
		return nil, errors.New("midtrans server key is not configured")
	}

	endpoint := fmt.Sprintf("%s/transactions", c.BaseURL)

	reqBytes, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal snap request: %w", err)
	}

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
}
