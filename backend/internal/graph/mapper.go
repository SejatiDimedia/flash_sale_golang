package graph

import (
	"strings"
	"time"

	"github.com/sejatidimedia/flash_sale_platform/internal/graph/model"
	"github.com/sejatidimedia/flash_sale_platform/internal/repository"
)

func mapEventToGraphQL(e *repository.Event) *model.Event {
	if e == nil {
		return nil
	}
	status := model.EventStatus(strings.ToUpper(e.Status))

	return &model.Event{
		ID:             e.ID,
		Name:           e.Name,
		Description:    e.Description,
		StartSaleAt:    e.StartSaleAt.Format(time.RFC3339),
		EndSaleAt:      e.EndSaleAt.Format(time.RFC3339),
		TotalStock:     e.TotalStock,
		AvailableStock: e.AvailableStock,
		Price:          e.Price,
		Status:         status,
		MaxPerUser:     e.MaxPerUser,
		CreatedAt:      e.CreatedAt.Format(time.RFC3339),
		UpdatedAt:      e.UpdatedAt.Format(time.RFC3339),
	}
}

func mapOrderToGraphQL(o *repository.Order) *model.Order {
	if o == nil {
		return nil
	}
	status := model.OrderStatus(strings.ToUpper(o.Status))

	var confirmedAt *string
	if o.ConfirmedAt != nil {
		t := o.ConfirmedAt.Format(time.RFC3339)
		confirmedAt = &t
	}

	return &model.Order{
		ID:          o.ID,
		UserID:      o.UserID,
		EventID:     o.EventID,
		Quantity:    o.Quantity,
		TotalPrice:  o.TotalPrice,
		Status:      status,
		CreatedAt:   o.CreatedAt.Format(time.RFC3339),
		ConfirmedAt: confirmedAt,
	}
}
