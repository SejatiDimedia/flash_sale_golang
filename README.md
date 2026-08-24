# ⚡ High-Concurrency Flash Sale & Ticketing Platform

[![Go Version](https://img.shields.io/badge/Go-1.21+-00ADD8?style=flat&logo=go)](https://golang.org/)
[![GraphQL](https://img.shields.io/badge/GraphQL-gqlgen-E10098?style=flat&logo=graphql)](https://gqlgen.com/)
[![Gin Framework](https://img.shields.io/badge/Router-Gin-008ECF?style=flat&logo=gin)](https://gin-gonic.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2016-336791?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Cache-Redis%207-DC382D?style=flat&logo=redis)](https://redis.io/)
[![RabbitMQ](https://img.shields.io/badge/Queue-RabbitMQ%203-FF6600?style=flat&logo=rabbitmq)](https://www.rabbitmq.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A robust, enterprise-grade flash sale backend platform built in **Go** engineered to handle massive concurrent traffic bursts (*Thundering Herd*), guarantee **zero overselling**, and maintain sub-millisecond stock-locking latencies using **Redis Lua Scripts**, **PostgreSQL connection pooling**, and **RabbitMQ asynchronous event-driven worker pools**.

---

## 🏗️ System Architecture

```
                                  [ Client / React Frontend ]
                                               │
                                 GraphQL Query / Mutation (HTTP)
                                               ▼
                              ┌──────────────────────────────────┐
                              │       Gin Web Server + gqlgen    │
                              │      (Delivery & Auth Layer)     │
                              └────────────────┬─────────────────┘
                                               │
                                               ▼
                              ┌──────────────────────────────────┐
                              │          Service Layer           │
                              │ (RBAC, Anti-Spam Rate Limiter)   │
                              └───────┬──────────────────┬───────┘
                                      │                  │
               1. Atomic Stock Decrement                 │ 2. Publish "order.pending"
                   via Redis Lua Script                  │    (Fast Response < 5ms)
                                      ▼                  ▼
                             ┌────────────────┐  ┌────────────────┐
                             │     Redis      │  │    RabbitMQ    │
                             │ (Stock Counter │  │ (Topic Exchange│
                             │  Rate Limiter) │  │  Buffer Queue) │
                             └────────────────┘  └───────┬────────┘
                                                         │
                                                         ▼
                                                ┌──────────────────┐
                                                │   Worker Pool    │
                                                │ (Go Goroutines)  │
                                                └────────┬─────────┘
                                                         │
                                                         ▼ 3. Batch / Async Transaction
                                                ┌──────────────────┐
                                                │    PostgreSQL    │
                                                │ (Source of Truth)│
                                                └──────────────────┘
```

---

## ✨ Key Engineering Highlights

* **🛡️ Zero-Oversell Stock Guarantee:** Utilizes Redis single-threaded execution combined with **atomic Lua Scripts** to evaluate and decrement available stock in memory before touching the database.
* **⚡ Sub-Millisecond Checkout Latency:** Decouples the critical checkout path (Redis stock lock) from non-critical paths (PostgreSQL persistence, notifications, invoices) via RabbitMQ.
* **🏊 Concurrency-Optimized Connection Pool:** High-throughput PostgreSQL connection pool management via `jackc/pgx/v5/pgxpool` with strict lifecycle and idle timeout tuning.
* **🚦 Anti-Scalping & Rate Limiting:** Sliding-window rate limiter per user/event and strict `max_per_user` validation to prevent bot attacks.
* **🔒 Clean Layered Architecture:** Clear boundary separation:
  * `Delivery Layer`: Gin Router, gqlgen GraphQL Schemas & Resolvers, JWT Auth Middleware.
  * `Service Layer`: Business logic, RBAC, input validation.
  * `Repository Layer`: Pure SQL queries with type-safe scans.
* **🔄 Resilient Worker Pool:** Fixed-size goroutine worker pool with **manual AMQP Acknowledgments (`msg.Ack`)** and graceful shutdown to prevent data loss.

---

## 🛠️ Tech Stack

| Component | Technology | Rationale |
|---|---|---|
| **Language** | **Go (Golang 1.21+)** | High-concurrency goroutines, minimal memory footprint |
| **HTTP Engine** | **Gin Framework** | Fast HTTP routing, middleware ecosystem, recovery |
| **API Paradigm** | **GraphQL (`gqlgen`)** | Schema-first code generation, strict type safety |
| **Primary Database** | **PostgreSQL 16** | Relational integrity, ACID compliance (Source of Truth) |
| **Cache & Lock** | **Redis 7** | In-memory atomic operations & distributed rate-limiting |
| **Message Broker** | **RabbitMQ 3** | Reliable AMQP async queuing, durable messages, manual ACK |
| **Migration** | **`golang-migrate`** | Versioned, repeatable, and rollback-ready database schema |
| **Authentication** | **JWT (`golang-jwt/v5`) & `bcrypt`** | Stateless authentication with cryptographic hashing |

---

## 🚀 Getting Started

### Prerequisites
* [Go 1.21+](https://go.dev/dl/)
* [Docker & Docker Compose](https://www.docker.com/)
* [`golang-migrate` CLI](https://github.com/golang-migrate/migrate)

### 1. Clone the Repository
```bash
git clone https://github.com/SejatiDimedia/flash_sale_golang.git
cd flash_sale_golang
```

### 2. Start Infrastructure (PostgreSQL, Redis, RabbitMQ)
```bash
docker compose up -d
```

Verify that all containers are healthy:
```bash
docker compose ps
```

### 3. Run Database Migrations
```bash
cd backend
migrate -path migrations -database "postgres://postgres:postgrespassword@localhost:5432/flash_sale_db?sslmode=disable" up
```

### 4. Setup Environment Variables
Create a `.env` file in the `backend/` directory:
```env
SERVER_PORT=8080
ENVIRONMENT=development

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgrespassword
DB_NAME=flash_sale_db
DB_SSLMODE=disable

REDIS_ADDR=localhost:6379
REDIS_PASSWORD=

RABBITMQ_URL=amqp://guest:guest@localhost:5672/

JWT_SECRET=supersecretflashsalekey12345
JWT_EXPIRATION_HOURS=24
```

### 5. Start Backend Server
```bash
go mod tidy
go run cmd/server/main.go
```

The server will be available at:
* **API & GraphQL Endpoint:** `http://localhost:8080/query`
* **Health Check:** `http://localhost:8080/health`
* **RabbitMQ Dashboard:** `http://localhost:15672` (User: `guest`, Pass: `guest`)

---

## 📖 GraphQL API Examples

### 1. Register User
```graphql
mutation {
  register(input: {
    name: "John Doe"
    email: "john@example.com"
    password: "securepassword123"
    role: "admin" # 'user' or 'admin'
  }) {
    token
    user {
      id
      name
      email
      role
    }
  }
}
```

### 2. Create Flash Sale Event (Admin Only)
*Set Header: `Authorization: Bearer <ADMIN_JWT_TOKEN>`*
```graphql
mutation {
  createEvent(input: {
    name: "Coldplay Live in Jakarta - Flash Sale"
    description: "Limited 100 VIP Tickets"
    startSaleAt: "2026-08-25T10:00:00Z"
    endSaleAt: "2026-08-25T12:00:00Z"
    totalStock: 100
    price: 1500000
    status: ACTIVE
    maxPerUser: 2
  }) {
    id
    name
    totalStock
    availableStock
    price
    status
    maxPerUser
  }
}
```

### 3. Flash Sale Checkout (Atomic Decrement)
*Set Header: `Authorization: Bearer <USER_JWT_TOKEN>`*
```graphql
mutation {
  purchaseTicket(eventId: "<EVENT_UUID>", quantity: 2) {
    id
    eventId
    quantity
    totalPrice
    status
    createdAt
  }
}
```

---

## 🗺️ Project Roadmap

- [x] **Phase 1: Project Scaffolding & Containerized Infrastructure**
- [x] **Phase 2: Database Migration & Clean Architecture Setup**
- [x] **Phase 3: JWT Authentication, Password Hashing & RBAC**
- [x] **Phase 4: Event Lifecycle & Management System**
- [x] **Phase 5: In-Memory Atomic Stock Lock & Anti-Scalping (Redis)**
- [ ] **Phase 6: Asynchronous Event-Driven Worker Pool (RabbitMQ)**
- [ ] **Phase 7: Real-Time Updates via GraphQL Subscriptions (WebSocket)**
- [ ] **Phase 8: High-Concurrency Load Testing (k6 / hey)**

---

## 📄 License
This project is open-source and licensed under the [MIT License](LICENSE).
# flash_sale_golang
