package graph

import (
	"github.com/sejatidimedia/flash_sale_platform/internal/repository"
	"github.com/sejatidimedia/flash_sale_platform/internal/service"
)

type Resolver struct {
	AuthService     service.AuthService
	EventService    service.EventService
	CheckoutService service.CheckoutService
	OrderRepo       repository.OrderRepository
}
