package database

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sejatidimedia/flash_sale_platform/internal/config"
)

// NewPostgresPool membuat pool koneksi PostgreSQL
func NewPostgresPool(cfg *config.Config) (*pgxpool.Pool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	connString := cfg.GetDBConnectionString()

	poolConfig, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return nil, fmt.Errorf("unable to parse connection string: %w", err)
	}

	// Konfigurasi Pool untuk concurrency
	poolConfig.MaxConns = 50                      // Maksimal 50 koneksi aktif bersamaan
	poolConfig.MinConns = 5                       // Minimal 5 koneksi standby
	poolConfig.MaxConnLifetime = 1 * time.Hour    // Masa hidup koneksi
	poolConfig.MaxConnIdleTime = 30 * time.Minute // Idle timeout

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("unable to create connection pool: %w", err)
	}

	// Ping untuk memastikan database benar-benar bisa diakses
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping postgres: %w", err)
	}

	log.Println("🐘 Connected to PostgreSQL successfully with connection pool!")
	return pool, nil
}
