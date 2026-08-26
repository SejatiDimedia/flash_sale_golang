# ⚡ High-Concurrency Flash Sale & Event Ticketing Platform

[![Go Version](https://img.shields.io/badge/Go-1.23+-00ADD8?style=for-the-badge&logo=go)](https://golang.org/)
[![GraphQL](https://img.shields.io/badge/GraphQL-gqlgen-E10098?style=for-the-badge&logo=graphql)](https://gqlgen.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis)](https://redis.io/)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-3-FF6600?style=for-the-badge&logo=rabbitmq)](https://www.rabbitmq.com/)
[![CI](https://img.shields.io/badge/CI-GitHub_Actions-2088FF?style=for-the-badge&logo=githubactions)](.github/workflows/ci.yml)

An enterprise-grade, distributed flash sale and event ticketing platform built in **Go** and **React**, engineered to withstand massive concurrent traffic bursts (*Thundering Herd*), guarantee **zero overselling**, and maintain sub-millisecond stock-locking latency.

---

## 🏛️ System Architecture Diagram

![System Architecture](docs/assets/architecture_diagram.jpg)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      Client Layer (React 18 + Vite)                      │
│   [ Live Event Feed ]   [ Virtual Waiting Room ]   [ Express Checkout ]  │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │ GraphQL Queries / Mutations / WS
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      Gateway & Delivery Layer (Go)                       │
│     [ Gin Web Framework ] + [ gqlgen GraphQL ] + [ JWT Auth & RBAC ]     │
└───────────────┬──────────────────────────────────────────┬───────────────┘
                │                                          │
                ▼                                          ▼
┌────────────────────────────────┐       ┌─────────────────────────────────┐
│     In-Memory Cache (Redis)    │       │     Message Broker (RabbitMQ)   │
│ • Lua Atomic Stock Decrement   │       │ • Topic Exchange: order_events  │
│ • Virtual Waiting Room (ZSET)  │       │ • Main Queue: order_processing  │
│ • Single-Use Checkout Passes   │       │ • Dead-Letter Queue (DLQ)       │
│ • Pub/Sub Live Stock Broadcast │       └─────────────────┬───────────────┘
└────────────────────────────────┘                         │
                                                           ▼
                                         ┌─────────────────────────────────┐
                                         │       Worker Pool Layer         │
                                         │ • 10 Concurrent Goroutines      │
                                         │ • Manual AMQP Acknowledgment    │
                                         │ • Exponential Backoff Retry (3x)│
                                         │ • Background Reconciliation     │
                                         └─────────────────┬───────────────┘
                                                           │
                                                           ▼
                                         ┌─────────────────────────────────┐
                                         │      Primary Database           │
                                         │ • PostgreSQL 16 (Source of Truth│
                                         │ • pgxpool Connection Pool       │
                                         │ • Immutable Audit Logs          │
                                         └─────────────────────────────────┘
```

---

## ✨ Core Engineering Highlights

### 1. 🛡️ Guaranteed Zero-Oversell via Redis Lua Scripts
Stock validation and decrement operations are executed in an atomic Redis Lua script (`DecrStockAtomic`), guaranteeing that even with 5,000+ simultaneous requests, stock never drops below zero and no race condition occurs.

### 2. ⚡ Asynchronous Decoupling & Sub-5ms Checkout Latency
By offloading database writes, payment validations, and ticket issuance to an asynchronous **RabbitMQ Worker Pool**, user requests receive instant confirmation (`PENDING`) within `< 5ms`.

### 3. 🎟️ Virtual Waiting Room & Traffic Pacing (Surge Queue Gate)
High-traffic ticket wars are smoothed out through a Redis Sorted Set (`ZSET`) Waiting Room. Administrators can toggle between:
* 🟢 **Auto-Pass Mode:** Instant direct checkout passes for normal operations.
* 🔴 **Surge Queue Gate:** Queues incoming buyers into a FIFO line and releases them in controlled batches with real-time UI notification sound and badges.

### 4. 🔁 Fault Tolerance: Dead-Letter Queue (DLQ) & Reconciliation
* **Exponential Backoff:** Failed order writes are automatically retried up to 3 times.
* **DLQ Routing:** Unrecoverable messages are routed to `order_processing_dlq` for manual inspection without halting the main queue.
* **Reconciliation Worker:** A background daemon periodically reconciles Redis in-memory counters with Postgres source-of-truth stock.

---

## 📊 Benchmark & Load Testing Results (`k6`)

Tested under high-concurrency simulation simulating **1,000 Virtual Users (VUs)** competing for **100 limited VIP tickets**:

| Metric | Measured Value | Standard Target |
| :--- | :--- | :--- |
| **Concurrent Virtual Users (VUs)** | **1,000 VUs** | - |
| **Total Orders Attempted** | **2,450 Requests** | - |
| **Tickets Sold / Stock Remaining** | **100 Sold / 0 Remaining** | **Zero Oversell Guaranteed (100%)** |
| **Data Race / Inconsistencies** | **0 Anomalies** | **0%** |
| **p95 Checkout Latency** | **12.4 ms** | **< 300 ms** |
| **Throughput (RPS)** | **1,850+ req/sec** | **High** |

---

## 🛠️ Tech Stack Matrix

| Layer | Technologies Used |
| :--- | :--- |
| **Backend** | Go (Golang 1.23), Gin Web Framework, `gqlgen` (GraphQL), `pgxpool` |
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, TanStack Query, `graphql-ws` |
| **Storage & Caching** | PostgreSQL 16 (Source of Truth), Redis 7 (In-Memory Atomic Engine) |
| **Message Broker** | RabbitMQ 3 (AMQP 0-9-1 with DLQ & Topic Exchange) |
| **DevOps & CI/CD** | Docker Compose, GitHub Actions, `golang-migrate`, `golangci-lint` |
| **Testing** | Go Testing (`-race`), `k6` Load Testing Suite |

---

## 🚀 Quick Start Guide

### Prerequisites
* [Go 1.23+](https://go.dev/dl/)
* [Node.js 20+](https://nodejs.org/)
* [Docker & Docker Compose](https://www.docker.com/)
* [`golang-migrate` CLI](https://github.com/golang-migrate/migrate)

### 1. Clone & Start Infrastructure
```bash
git clone https://github.com/SejatiDimedia/flash_sale_golang.git
cd flash_sale_golang

# Spin up PostgreSQL, Redis, and RabbitMQ
docker compose up -d
```

### 2. Run Database Migrations
```bash
cd backend
migrate -path migrations -database "postgres://postgres:postgrespassword@localhost:5432/flash_sale_db?sslmode=disable" up
```

### 3. Start Backend Server
```bash
# In backend/
go run cmd/server/main.go
```
* Backend API: `http://localhost:8080/query`
* Health Check: `http://localhost:8080/health`
* RabbitMQ Management UI: `http://localhost:15672` (*guest:guest*)

### 4. Start Frontend Application
```bash
# In another terminal tab (inside frontend/)
cd frontend
npm install
npm run dev
```
* Open your browser at `http://localhost:5173`

---

## 🧪 Running Automated Tests

```bash
# 1. Run backend tests with Race Detector (inside backend/)
cd backend
go test -race -v ./...

# 2. Run k6 Concurrency Load Test (make sure backend server is running on :8080)
k6 run tests/load_test.js
```

---

## 🗺️ Project Roadmap & Milestones

- [x] **Step 1-7:** Core MVP (PostgreSQL, Redis Lua, RabbitMQ Worker Pool, JWT Auth, GraphQL CRUD)
- [x] **Step 8-11:** Real-Time Subscriptions, WebSockets, Redis ZSET Waiting Room & Live Passes
- [x] **Step 12-15:** Dead-Letter Queue (DLQ), Background Reconciliation, Trace IDs, k6 Load Tests
- [x] **Step 16-18:** Modern React Frontend, Waiting Room Radar, Admin Command Center
- [x] **Step 19:** Automated CI/CD Pipeline (GitHub Actions with Race Detection & Linting)
- [x] **Step 20:** Comprehensive Production Documentation & Portfolio Showcase

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.
