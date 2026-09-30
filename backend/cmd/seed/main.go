package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/sejatidimedia/flash_sale_platform/internal/config"
	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/database"
	"github.com/sejatidimedia/flash_sale_platform/internal/pkg/redisclient"
)

type EventSeed struct {
	Name        string
	Description string
	Category    string
	TotalStock  int
	Price       float64
	MaxPerUser  int
	Status      string
	StartOffset time.Duration
	EndOffset   time.Duration
}

func main() {
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	ctx := context.Background()

	// 1. Connect Postgres
	dbPool, err := database.NewPostgresPool(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to postgres: %v", err)
	}
	defer dbPool.Close()

	// 2. Connect Redis
	redisClient, err := redisclient.NewRedisClient(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to redis: %v", err)
	}
	defer redisClient.Client.Close()

	log.Println("🧹 Cleaning up old orders and test events...")

	// Delete old order logs, orders, and events
	_, err = dbPool.Exec(ctx, "DELETE FROM order_logs;")
	if err != nil {
		log.Printf("Warning deleting order_logs: %v", err)
	}
	_, err = dbPool.Exec(ctx, "DELETE FROM orders;")
	if err != nil {
		log.Printf("Warning deleting orders: %v", err)
	}
	_, err = dbPool.Exec(ctx, "DELETE FROM events;")
	if err != nil {
		log.Fatalf("Failed to delete old events: %v", err)
	}

	// Flush old redis event keys
	iter := redisClient.Client.Scan(ctx, 0, "stock:*", 0).Iterator()
	for iter.Next(ctx) {
		_ = redisClient.Client.Del(ctx, iter.Val())
	}
	iterQ := redisClient.Client.Scan(ctx, 0, "waiting_room:*", 0).Iterator()
	for iterQ.Next(ctx) {
		_ = redisClient.Client.Del(ctx, iterQ.Val())
	}

	now := time.Now()

	// Realistic Events Data across all categories
	seedEvents := []EventSeed{
		// 🎸 CONCERTS
		{
			Name:        "Coldplay: Music of the Spheres World Tour - Jakarta",
			Description: "Special stadium tour live at Gelora Bung Karno Stadium. Features sustainable light shows, acoustic hits, and immersive soundscapes.",
			Category:    "concerts",
			TotalStock:  150,
			Price:       1250000,
			MaxPerUser:  2,
			Status:      "active",
			StartOffset: -1 * time.Hour,
			EndOffset:   72 * time.Hour,
		},
		{
			Name:        "We The Fest 2026 - 3-Day Music & Arts Festival Pass",
			Description: "Annual summer festival in Jakarta featuring international headliners, indie discoveries, immersive art installations, and culinary experiences.",
			Category:    "concerts",
			TotalStock:  80,
			Price:       2100000,
			MaxPerUser:  4,
			Status:      "active",
			StartOffset: -2 * time.Hour,
			EndOffset:   120 * time.Hour,
		},
		{
			Name:        "Bruno Mars Live in Jakarta - VIP Festival",
			Description: "24K Magic world tour performance live at Jakarta International Stadium (JIS) with exclusive stage view and VIP festival access.",
			Category:    "concerts",
			TotalStock:  120,
			Price:       1750000,
			MaxPerUser:  2,
			Status:      "active",
			StartOffset: -30 * time.Minute,
			EndOffset:   48 * time.Hour,
		},

		// 🎾 SPORTS
		{
			Name:        "Indonesia Open 2026 - BWF World Tour Super 1000",
			Description: "Semifinal showdown at Istora Senayan. Watch world champion shuttlers compete for the coveted world tour championship title.",
			Category:    "sports",
			TotalStock:  100,
			Price:       650000,
			MaxPerUser:  4,
			Status:      "active",
			StartOffset: -1 * time.Hour,
			EndOffset:   96 * time.Hour,
		},
		{
			Name:        "FIFA World Cup Qualifiers: Indonesia vs Australia",
			Description: "Crucial round 3 Asian Qualifiers match live under the lights at Gelora Bung Karno Main Stadium with 70,000 passionate supporters.",
			Category:    "sports",
			TotalStock:  250,
			Price:       450000,
			MaxPerUser:  2,
			Status:      "active",
			StartOffset: -3 * time.Hour,
			EndOffset:   168 * time.Hour,
		},

		// 🎭 THEATRE
		{
			Name:        "The Phantom of the Opera - Broadway Musical Jakarta",
			Description: "Andrew Lloyd Webber's iconic masterpiece arrives at Teater Jakarta, Taman Ismail Marzuki with full live orchestra and stunning stage production.",
			Category:    "theatre",
			TotalStock:  75,
			Price:       950000,
			MaxPerUser:  2,
			Status:      "active",
			StartOffset: -1 * time.Hour,
			EndOffset:   144 * time.Hour,
		},
		{
			Name:        "Laskar Pelangi: The Musical Theatre Special",
			Description: "Award-winning stage adaptation at Ciputra Artpreneur Theater telling the inspirational journey of friendship, hope, and education.",
			Category:    "theatre",
			TotalStock:  90,
			Price:       550000,
			MaxPerUser:  4,
			Status:      "active",
			StartOffset: -2 * time.Hour,
			EndOffset:   120 * time.Hour,
		},

		// 😄 COMEDY
		{
			Name:        "Raditya Dika Stand-Up Comedy Tour: Cerita Dewasa",
			Description: "Live stand-up comedy special at Balai Kartini Convention Center. 120 minutes of fresh, unfiltered storytelling and hilarious observations.",
			Category:    "comedy",
			TotalStock:  120,
			Price:       350000,
			MaxPerUser:  2,
			Status:      "active",
			StartOffset: -1 * time.Hour,
			EndOffset:   72 * time.Hour,
		},
		{
			Name:        "International Stand-Up Comedy Festival - Live in Jakarta",
			Description: "Top regional and international stand-up comedians perform live at Tennis Indoor Senayan for a night of non-stop laughter.",
			Category:    "comedy",
			TotalStock:  100,
			Price:       400000,
			MaxPerUser:  4,
			Status:      "active",
			StartOffset: -2 * time.Hour,
			EndOffset:   96 * time.Hour,
		},
	}

	log.Printf("🌱 Seeding %d realistic events into PostgreSQL & Redis...", len(seedEvents))

	query := `
		INSERT INTO events (
			name, description, start_sale_at, end_sale_at,
			total_stock, available_stock, price, status,
			category, max_per_user
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id;
	`

	for i, ev := range seedEvents {
		startSale := now.Add(ev.StartOffset)
		endSale := now.Add(ev.EndOffset)

		var eventID string
		err := dbPool.QueryRow(
			ctx,
			query,
			ev.Name,
			ev.Description,
			startSale,
			endSale,
			ev.TotalStock,
			ev.TotalStock, // available_stock starts at total_stock
			ev.Price,
			ev.Status,
			ev.Category,
			ev.MaxPerUser,
		).Scan(&eventID)

		if err != nil {
			log.Fatalf("Failed to insert event %s: %v", ev.Name, err)
		}

		// Initialize Redis Stock Cache
		err = redisClient.SetStock(ctx, eventID, ev.TotalStock)
		if err != nil {
			log.Printf("Warning: failed to set redis stock for %s: %v", eventID, err)
		}

		fmt.Printf("[%d/%d] 🎟️ Seeded: %s (%s) | ID: %s | Quota: %d | IDR %.0f\n",
			i+1, len(seedEvents), ev.Name, ev.Category, eventID, ev.TotalStock, ev.Price)
	}

	log.Println("✅ Realistic dummy events seeded successfully in PostgreSQL and synchronized to Redis!")
}
