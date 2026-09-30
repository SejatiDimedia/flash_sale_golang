package middleware

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const (
	RequestIDKey         contextKey = "RequestID"
	IdempotencyKeyHeader contextKey = "IdempotencyKey"
)

// RequestIDMiddleware menyisipkan unique UUID (Trace ID) dan Idempotency-Key ke setiap request
func RequestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		reqID := c.GetHeader("X-Request-ID")
		if reqID == "" {
			reqID = uuid.New().String()
		}

		// Pasang ke Header response agar client/frontend tahu Trace ID-nya
		c.Writer.Header().Set("X-Request-ID", reqID)

		// Suntikkan ke context.Context
		ctx := context.WithValue(c.Request.Context(), RequestIDKey, reqID)

		// Ambil Idempotency-Key jika disediakan client
		idempotencyKey := c.GetHeader("Idempotency-Key")
		if idempotencyKey != "" {
			ctx = context.WithValue(ctx, IdempotencyKeyHeader, idempotencyKey)
		}

		c.Request = c.Request.WithContext(ctx)

		c.Next()
	}
}

// GetRequestID mengambil Trace ID dari context
func GetRequestID(ctx context.Context) string {
	if val, ok := ctx.Value(RequestIDKey).(string); ok {
		return val
	}
	return "unknown"
}

// GetIdempotencyKey mengambil Idempotency-Key dari context
func GetIdempotencyKey(ctx context.Context) string {
	if val, ok := ctx.Value(IdempotencyKeyHeader).(string); ok {
		return val
	}
	return ""
}
