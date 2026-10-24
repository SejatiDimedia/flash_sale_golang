package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/midtrans"
	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/rabbitmq"
	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/redisclient"
	"github.com/sejatidimedia/flash_sale_platform/internal/repository"
	"github.com/sejatidimedia/flash_sale_platform/internal/worker"
)

type MidtransHandler struct {
	midtransClient *midtrans.Client
	orderRepo      repository.OrderRepository
	redisClient    *redisclient.RedisClient
	rabbitClient   *rabbitmq.RabbitMQClient
}

func NewMidtransHandler(
	midtransClient *midtrans.Client,
	orderRepo repository.OrderRepository,
	redisClient *redisclient.RedisClient,
	rabbitClient *rabbitmq.RabbitMQClient,
) *MidtransHandler {
	return &MidtransHandler{
		midtransClient: midtransClient,
		orderRepo:      orderRepo,
		redisClient:    redisClient,
		rabbitClient:   rabbitClient,
	}
}

// CreateSnapToken menangani pembuatan token transaksi Midtrans Snap
func (h *MidtransHandler) CreateSnapToken(c *gin.Context) {
	var req struct {
		OrderID    string  `json:"order_id" binding:"required"`
		EventID    string  `json:"event_id"`
		EventName  string  `json:"event_name"`
		Quantity   int     `json:"quantity"`
		TotalPrice float64 `json:"total_price" binding:"required"`
		UserName   string  `json:"user_name"`
		UserEmail  string  `json:"user_email"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	snapReq := midtrans.CreateSnapRequest{
		TransactionDetails: midtrans.SnapTransactionDetails{
			OrderID:     req.OrderID,
			GrossAmount: int64(req.TotalPrice),
		},
		CustomerDetails: midtrans.SnapCustomerDetails{
			FirstName: req.UserName,
			Email:     req.UserEmail,
		},
	}

	if req.EventName != "" && req.Quantity > 0 {
		pricePerItem := int64(req.TotalPrice) / int64(req.Quantity)
		snapReq.ItemDetails = []midtrans.SnapItemDetails{
			{
				ID:       req.EventID,
				Price:    pricePerItem,
				Quantity: req.Quantity,
				Name:     req.EventName,
			},
		}
	}

	snapResp, err := h.midtransClient.CreateSnapTransaction(c.Request.Context(), snapReq)
	if err != nil {
		log.Printf("❌ Failed to create Snap transaction: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, snapResp)
}

// Webhook menangani callback notifikasi server-to-server dari Midtrans
func (h *MidtransHandler) Webhook(c *gin.Context) {
	var notif midtrans.NotificationPayload
	if err := c.ShouldBindJSON(&notif); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	log.Printf("📢 [Midtrans Webhook] OrderID: %s, Status: %s, PaymentType: %s",
		notif.OrderID, notif.TransactionStatus, notif.PaymentType)

	// Settlement atau capture menandakan pembayaran berhasil
	if notif.TransactionStatus == "settlement" || notif.TransactionStatus == "capture" {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		_ = h.orderRepo.UpdateOrderStatus(ctx, notif.OrderID, "CONFIRMED")
		_ = h.orderRepo.CreateOrderLog(ctx, notif.OrderID, "MIDTRANS_PAYMENT_SETTLED",
			fmt.Sprintf(`{"payment_type":"%s","transaction_id":"%s","gross_amount":"%s"}`,
				notif.PaymentType, notif.TransactionID, notif.GrossAmount))

		// Broadcast via Redis Pub/Sub
		order, _ := h.orderRepo.GetOrderByID(ctx, notif.OrderID)
		if order != nil {
			if orderBytes, err := json.Marshal(order); err == nil {
				_ = h.redisClient.PublishMessage(ctx, fmt.Sprintf("order_status:%s", notif.OrderID), string(orderBytes))
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// ConfirmPayment menangani konfirmasi langsung pembayaran Midtrans (simulator atau direct callback)
func (h *MidtransHandler) ConfirmPayment(c *gin.Context) {
	var req struct {
		OrderID       string `json:"order_id" binding:"required"`
		PaymentType   string `json:"payment_type"`
		TransactionID string `json:"transaction_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	order, err := h.orderRepo.GetOrderByID(ctx, req.OrderID)
	if err != nil || order == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	if order.Status == "CONFIRMED" {
		c.JSON(http.StatusOK, gin.H{"status": "CONFIRMED", "order": order})
		return
	}

	// 1. Update status order menjadi CONFIRMED di PostgreSQL
	if err := h.orderRepo.UpdateOrderStatus(ctx, req.OrderID, "CONFIRMED"); err != nil {
		log.Printf("❌ Failed to update order status to CONFIRMED: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to confirm order"})
		return
	}

	paymentType := req.PaymentType
	if paymentType == "" {
		paymentType = "midtrans_snap"
	}
	txID := req.TransactionID
	if txID == "" {
		txID = fmt.Sprintf("TX-MID-%d", time.Now().Unix())
	}

	// 2. Audit Log
	_ = h.orderRepo.CreateOrderLog(ctx, req.OrderID, "MIDTRANS_PAYMENT_CONFIRMED",
		fmt.Sprintf(`{"payment_type":"%s","transaction_id":"%s","status":"CONFIRMED"}`,
			paymentType, txID))

	// 3. Broadcast Real-Time via Redis Pub/Sub
	order.Status = "CONFIRMED"
	if orderBytes, err := json.Marshal(order); err == nil {
		_ = h.redisClient.PublishMessage(ctx, fmt.Sprintf("order_status:%s", req.OrderID), string(orderBytes))
	}

	// 4. Asynchronous event ke RabbitMQ
	payload := worker.OrderMessagePayload{
		OrderID:    order.ID,
		UserID:     order.UserID,
		EventID:    order.EventID,
		Quantity:   order.Quantity,
		TotalPrice: order.TotalPrice,
	}
	_ = h.rabbitClient.PublishEvent(ctx, rabbitmq.OrderConfirmedKey, payload)

	log.Printf("🎉 [Midtrans Payment Confirmed] Order %s successfully CONFIRMED! PaymentType: %s",
		order.ID, paymentType)

	c.JSON(http.StatusOK, gin.H{"status": "CONFIRMED", "order": order})
}
