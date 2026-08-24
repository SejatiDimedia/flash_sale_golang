package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	ServerPort  string
	Environment string

	// Database
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string

	// Redis
	RedisAddr     string
	RedisPassword string

	// RabbitMQ
	RabbitMQURL string

	// JWT
	JWTSecret          string
	JWTExpirationHours string
}

func LoadConfig() (*Config, error) {
	// Load .env file if present (ignore error if not present, e.g., in production)
	_ = godotenv.Load()

	cfg := &Config{
		ServerPort:         getEnv("SERVER_PORT", "8080"),
		Environment:        getEnv("ENVIRONMENT", "development"),
		DBHost:             getEnv("DB_HOST", "localhost"),
		DBPort:             getEnv("DB_PORT", "5432"),
		DBUser:             getEnv("DB_USER", "postgres"),
		DBPassword:         getEnv("DB_PASSWORD", "postgrespassword"),
		DBName:             getEnv("DB_NAME", "flash_sale_db"),
		DBSSLMode:          getEnv("DB_SSLMODE", "disable"),
		RedisAddr:          getEnv("REDIS_ADDR", "localhost:6379"),
		RedisPassword:      getEnv("REDIS_PASSWORD", ""),
		RabbitMQURL:        getEnv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/"),
		JWTSecret:          getEnv("JWT_SECRET", "default_secret_key"),
		JWTExpirationHours: getEnv("JWT_EXPIRATION_HOURS", "24"),
	}

	return cfg, nil
}

func (c *Config) GetDBConnectionString() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=%s",
		c.DBUser, c.DBPassword, c.DBHost, c.DBPort, c.DBName, c.DBSSLMode)
}

func getEnv(key, defaultValue string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultValue
}
