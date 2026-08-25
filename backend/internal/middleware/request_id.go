package middleware

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const RequestIDKey contextKey = "RequestID"

// RequestIDMiddleware menyisipkan unique UUID (Trace ID) ke setiap request
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
