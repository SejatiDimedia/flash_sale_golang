package handler

import (
	"net/http"
	"time"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/extension"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sejatidimedia/flash_sale_platform/internal/config"
	"github.com/sejatidimedia/flash_sale_platform/internal/graph"
	"github.com/sejatidimedia/flash_sale_platform/internal/middleware"
	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/metrics"
	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/redisclient"
	"github.com/sejatidimedia/flash_sale_platform/internal/repository"
	"github.com/sejatidimedia/flash_sale_platform/internal/service"
)

type RouterDependencies struct {
	Config          *config.Config
	AuthService     service.AuthService
	EventService    service.EventService
	CheckoutService service.CheckoutService
	OrderRepo       repository.OrderRepository
	EventRepo       repository.EventRepository
	RedisClient     *redisclient.RedisClient
	MidtransHandler *MidtransHandler
}

// SetupRouter mengonfigurasi middleware, GraphQL transports, dan seluruh HTTP endpoint
func SetupRouter(deps RouterDependencies) *gin.Engine {
	if deps.Config.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()

	// 🌐 CORS Middleware
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, X-Request-ID")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// 🔍 Pasang Request ID (Trace ID), Auth Middleware, & Prometheus Metrics
	r.Use(middleware.RequestIDMiddleware())
	r.Use(middleware.AuthMiddleware(deps.AuthService))
	r.Use(metrics.PrometheusMiddleware())
	// 🛡️ Pasang Distributed Rate Limiter (Anti-Bot & Flooding Guard: batas 30 req/detik per IP atau User)
	r.Use(middleware.RateLimiterMiddleware(deps.RedisClient, 30, time.Second))


	// 🏥 Health & Observability Endpoints
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	r.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// ⚡ GraphQL Endpoints (Playground, Query, Mutation & WebSocket Subscription)
	gqlHandler := newGraphQLHandler(deps)
	r.GET("/", playgroundHandler())
	r.POST("/query", gqlHandler)
	r.GET("/query", gqlHandler)

	// 💳 Midtrans Payment REST Endpoints Group
	if deps.MidtransHandler != nil {
		midtransGroup := r.Group("/api/midtrans")
		{
			midtransGroup.POST("/snap-token", deps.MidtransHandler.CreateSnapToken)
			midtransGroup.POST("/webhook", deps.MidtransHandler.Webhook)
			midtransGroup.POST("/confirm-payment", deps.MidtransHandler.ConfirmPayment)
		}
	}

	return r
}

func newGraphQLHandler(deps RouterDependencies) gin.HandlerFunc {
	srv := handler.New(
		graph.NewExecutableSchema(
			graph.Config{
				Resolvers: &graph.Resolver{
					AuthService:     deps.AuthService,
					EventService:    deps.EventService,
					CheckoutService: deps.CheckoutService,
					OrderRepo:       deps.OrderRepo,
					EventRepo:       deps.EventRepo,
					RedisClient:     deps.RedisClient,
				},
			},
		),
	)

	// Aktifkan Transports: POST, GET, dan WebSocket Subscription
	srv.AddTransport(transport.POST{})
	srv.AddTransport(transport.GET{})
	srv.AddTransport(transport.Websocket{
		KeepAlivePingInterval: 10 * time.Second,
	})
	srv.Use(extension.Introspection{})

	return func(c *gin.Context) {
		srv.ServeHTTP(c.Writer, c.Request)
	}
}

func playgroundHandler() gin.HandlerFunc {
	h := playground.Handler("GraphQL Playground", "/query")
	return func(c *gin.Context) {
		h.ServeHTTP(c.Writer, c.Request)
	}
}
