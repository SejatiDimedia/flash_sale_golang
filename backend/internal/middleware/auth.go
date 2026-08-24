package middleware

import (
	"context"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/sejatidimedia/flash_sale_platform/internal/service"
)

type contextKey string

const (
	UserContextKey contextKey = "currentUser"
)

// AuthMiddleware memeriksa header Authorization dan menyematkan User ke context
func AuthMiddleware(authService service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")

		// Jika tidak ada header Authorization, request tetap lanjut (sebagai guest/unauthenticated)
		if authHeader == "" {
			c.Next()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.Next()
			return
		}

		tokenString := parts[1]
		claims, err := authService.ValidateToken(tokenString)
		if err != nil {
			// Token tidak valid/expired, abaikan dan lanjut sebagai unauthenticated
			c.Next()
			return
		}

		// Masukkan claims user ke dalam context Go standar (agar terbaca di GraphQL Resolver)
		ctx := context.WithValue(c.Request.Context(), UserContextKey, claims)
		c.Request = c.Request.WithContext(ctx)

		c.Next()
	}
}

// GetUserFromContext helper untuk mengambil data user yang sedang login di resolver
func GetUserFromContext(ctx context.Context) *service.JWTClaims {
	user, ok := ctx.Value(UserContextKey).(*service.JWTClaims)
	if !ok {
		return nil
	}
	return user
}
