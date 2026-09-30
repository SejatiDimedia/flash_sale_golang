package metrics

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// HTTP Metrics
	HttpRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "flash_sale_http_requests_total",
			Help: "Total number of HTTP requests processed by endpoint and status code",
		},
		[]string{"method", "path", "status"},
	)

	HttpRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "flash_sale_http_request_duration_seconds",
			Help:    "HTTP request latency distributions in seconds",
			Buckets: []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5},
		},
		[]string{"method", "path"},
	)

	// Business & Flash Sale Metrics
	RemainingStockGauge = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "flash_sale_remaining_stock",
			Help: "Current remaining ticket stock for an event",
		},
		[]string{"event_id"},
	)

	QueueDepthGauge = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "flash_sale_waiting_room_queue_depth",
			Help: "Current number of users waiting in the virtual queue for an event",
		},
		[]string{"event_id"},
	)

	OrdersProcessedTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "flash_sale_orders_total",
			Help: "Total count of orders created partitioned by status (PENDING, CONFIRMED, FAILED, CANCELLED)",
		},
		[]string{"status"},
	)

	SoldOutRejectionsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "flash_sale_sold_out_rejections_total",
			Help: "Total number of requests rejected due to insufficient stock (Zero-Oversell enforcement)",
		},
		[]string{"event_id"},
	)
)

// PrometheusMiddleware merekam request rate dan latency setiap request HTTP
func PrometheusMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.FullPath()
		if path == "" {
			path = c.Request.URL.Path
		}

		c.Next()

		duration := time.Since(start).Seconds()
		status := strconv.Itoa(c.Writer.Status())

		HttpRequestsTotal.WithLabelValues(c.Request.Method, path, status).Inc()
		HttpRequestDuration.WithLabelValues(c.Request.Method, path).Observe(duration)
	}
}

// UpdateEventStockMetric mengupdate metric stock gauge di Prometheus
func UpdateEventStockMetric(eventID string, stock int) {
	RemainingStockGauge.WithLabelValues(eventID).Set(float64(stock))
}

// UpdateQueueDepthMetric mengupdate metric panjang antrean di Prometheus
func UpdateQueueDepthMetric(eventID string, depth int64) {
	QueueDepthGauge.WithLabelValues(eventID).Set(float64(depth))
}
