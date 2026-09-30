# ⚡ High-Concurrency Flash Sale & Event Ticketing Platform

[![Go Version](https://img.shields.io/badge/Go-1.25+-00ADD8?style=for-the-badge&logo=go)](https://golang.org/)
[![GraphQL](https://img.shields.io/badge/GraphQL-gqlgen-E10098?style=for-the-badge&logo=graphql)](https://gqlgen.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis)](https://redis.io/)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-3-FF6600?style=for-the-badge&logo=rabbitmq)](https://www.rabbitmq.com/)
[![Prometheus](https://img.shields.io/badge/Prometheus-Monitoring-E6522C?style=for-the-badge&logo=prometheus)](https://prometheus.io/)
[![Grafana](https://img.shields.io/badge/Grafana-Dashboard-F46800?style=for-the-badge&logo=grafana)](https://grafana.com/)
[![CI](https://img.shields.io/badge/CI-GitHub_Actions-2088FF?style=for-the-badge&logo=githubactions)](.github/workflows/ci.yml)

Platform flash sale dan tiket event terdistribusi berstandar enterprise yang dibangun dengan **Go** dan **React**, dirancang khusus untuk mengatasi lonjakan trafik masif (*Thundering Herd*), menjamin **Zero-Overselling**, dan mempertahankan konsistensi data yang ketat.

---

## 🏛️ Diagram Arsitektur Sistem (Mermaid)

```mermaid
flowchart TD
    subgraph ClientLayer ["Client Layer (React 18 + Vite)"]
        UI["🖥️ Web Client / Ticket Catalog"]
        WR["⏳ Virtual Waiting Room (Live Queue Radar)"]
        CO["💳 Express Checkout Modal"]
    end

    subgraph APILayer ["API & Gateway Layer (Go / Gin)"]
        GW["🌐 Gin HTTP & GraphQL Server (:8080)"]
        AUTH["🔑 JWT Auth & RBAC (Admin / User)"]
        IDEM["🔒 Idempotency-Key Mutex Guard"]
        PROM["📊 Prometheus Metrics Exporter (/metrics)"]
    end

    subgraph FastPath ["Fast-Path In-Memory Cache (Redis 7)"]
        LUA["⚡ Atomic Lua Script (DecrStockAtomic)"]
        ZSET["📋 Waiting Room Queue (Redis ZSET FIFO)"]
        PASS["🎫 Single-Use Checkout Pass (TTL 5m)"]
        PUBSUB["📢 Pub/Sub Live Stock Updates"]
    end

    subgraph BrokerLayer ["Asynchronous Message Broker (RabbitMQ)"]
        EX["🔀 Topic Exchange: order_events"]
        MQ["📥 Main Queue: order_processing"]
        DLQ["💀 Dead-Letter Queue: order_processing_dlq"]
    end

    subgraph WorkerLayer ["Background Processing & Reliability"]
        POOL["👷 Order Worker Pool (10 Concurrent Goroutines)"]
        RECON["⚖️ Auto-Reconciliation Worker (Anti-Drift Guard)"]
    end

    subgraph DatabaseLayer ["Persistence & Ground Truth (PostgreSQL 16)"]
        DB[("🐘 PostgreSQL Connection Pool")]
        REL_DEC["📉 Relative Decrement: WHERE available_stock >= $1"]
        AUDIT["📜 Immutable Order & Event Audit Logs"]
    end

    subgraph MonitoringLayer ["Observability Stack"]
        PROMETHEUS["🔥 Prometheus Scraper (:9090)"]
        GRAFANA["📈 Grafana Live Dashboard (:3000)"]
    end

    %% Flow Connections
    UI -->|GraphQL Queries / Mutations| GW
    GW --> AUTH
    AUTH --> IDEM
    IDEM --> LUA
    LUA -->|Stock Reserved| DB
    DB --> REL_DEC
    REL_DEC -->|Publish Order| EX
    EX --> MQ
    MQ --> POOL
    POOL -->|Manual ACK / Write DB| DB
    POOL -->|Max Retries Exceeded| DLQ
    POOL -->|Broadcast Status| PUBSUB
    PUBSUB -->|Real-Time Push| WR
    RECON -.->|Audit Drift (Grace Period)| DB
    RECON -.->|Sync Counter| LUA
    GW --> PROM
    PROM --> PROMETHEUS
    PROMETHEUS --> GRAFANA
```

---

## 🛡️ Mekanisme Inti Pencegahan Overselling (*Dual-Layer Protection*)

Platform ini menerapkan arsitektur proteksi dua lapis (*defense-in-depth*) untuk memastikan stok tidak akan pernah negatif dan tidak ada penjualan tiket melebihi kapasitas fisik:

1. **Lapisan Pertama (Fast-Path In-Memory Lua Script):**
   - Operasi pengecekan ketersediaan dan pemotongan stok dieksekusi secara 100% atomik di dalam engine Redis menggunakan skrip Lua (`DecrStockAtomic`).
   - Mencegah *race condition* pada ribuan goroutine paralel sebelum request menyentuh database.
2. **Lapisan Kedua (Database ACID Relative Decrement & Guardrail):**
   - Pada lapisan PostgreSQL, pemotongan stok menggunakan klausa SQL kondisional atomik:
     ```sql
     UPDATE events 
     SET available_stock = available_stock - $1, updated_at = NOW() 
     WHERE id = $2 AND available_stock >= $1
     ```
   - Jika kuota habis di tingkat basis data, sistem otomatis melakukan **Atomic Rollback** ke Redis (`IncrStock`), membatalkan order (`CANCELLED`), dan menolak transaksi dengan aman.
3. **Idempotency Key Mutex Guard:**
   - Mencegah pesanan ganda akibat klik berulang pengguna atau *network retry* menggunakan header `Idempotency-Key` yang diproteksi dengan Redis `SetNX` (TTL 24 jam).
4. **Zero-Stock-Leak Rollback:**
   - Jika terjadi kegagalan jaringan saat mengirim pesan ke RabbitMQ, kuota stok di Redis dan PostgreSQL otomatis dipulihkan kembali ke nilai semula.
5. **Reconciliation Worker dengan In-Flight Grace Period:**
   - Worker rekonsiliasi berkala mengaudit data drift antara cache Redis dan basis data PostgreSQL.
   - Dilengkapi proteksi transaksi *in-flight* sehingga tidak akan menaikkan stok Redis saat ada pesanan aktif yang sedang diproses.

---

## 📊 Hasil Uji Beban Nyata (k6 Benchmark on Apple M1 Pro)

> [!NOTE]
> Semua metrik di bawah ini berasal dari **eksekusi riil** menggunakan `k6` pada mesin **Apple MacBook Pro (Apple M1 Pro 10-Core CPU, 16GB RAM, macOS Darwin 25.6.0)**. Dokumentasi teknis lengkap dan cara mereproduksi dapat dibaca di [docs/benchmarks.md](docs/benchmarks.md).

| Skenario Pengujian | Virtual Users (VUs) | Total Transaksi | Throughput | Latensi Median | Latensi p(95) | HTTP Error Rate | Penjualan Sukses | Overselling |
|---|---|---|---|---|---|---|---|---|
| **1. Ramp-Up (Beban Bertahap)** | 0 ➔ 200 VUs | 2,433 | 138.6 req/s | 276 ms | 1,145 ms | **0.00%** | 500 / 500 tiket | **0 (0%)** |
| **2. Sudden Spike (Thundering Herd)** | 10 ➔ 300 VUs | 1,503 | 119.4 req/s | 2,468 ms | 4,170 ms | **0.00%** | 500 / 500 tiket | **0 (0%)** |
| **3. Flash Sale Blitz (Limited Stock War)** | 500 VUs serentak | 2,000 | 134.9 req/s | 4,545 ms | 6,887 ms | **0.00%** | 100 / 100 tiket | **0 (0%)** |

### Verifikasi Ground Truth Pasca Blitz Test di PostgreSQL:
```text
  status   | count | sum 
-----------+-------+-----
 CONFIRMED |   100 | 100

 total_stock | available_stock 
-------------+-----------------
         100 |               0
```
**Hasil:** 100 tiket terjual, 1.900 permintaan ditolak *sold out*, 0 tiket bocor, dan sisa stok di database tepat bernilai 0.

---

## 📈 Observabilitas & Monitoring (Prometheus & Grafana)

Sistem telah dilengkapi dengan integrasi observabilitas lengkap yang siap dijalankan melalui Docker Compose:

1. **Prometheus:** Berjalan di `http://localhost:9090` (Scraping endpoint `/metrics` setiap 2 detik).
   - Metrik yang dipantau: `flash_sale_http_requests_total`, `flash_sale_http_request_duration_seconds`, `flash_sale_remaining_stock`, `flash_sale_waiting_room_queue_depth`.
2. **Grafana Dashboard:** Berjalan di `http://localhost:3000` (Kredensial default: `admin` / `admin`).
   - Ter-provisioning otomatis: Dashboard **Flash Sale Platform - Real-time Performance & Reliability**.

---

## 🧪 Menjalankan Pengujian (Testing Suite)

Panduan detail pengujian dapat dilihat di [docs/testing.md](docs/testing.md).

### 1. Menjalankan Unit Tests (Table-Driven)
```bash
cd backend
go test -v ./internal/service/... ./internal/graph/...
```

### 2. Menjalankan Integration Tests dengan Race Detector (`-race`)
```bash
cd backend
go test -v -race tests/integration_test.go
```

### 3. Menjalankan Frontend Component Tests & E2E
```bash
cd frontend
# Unit & Component test (Vitest)
npm test -- --run

# End-to-End full user journey (Playwright)
npx playwright test
```

### 4. Menjalankan Skenario Benchmark k6
```bash
# Jalankan seluruh suite uji beban
./loadtest/run_benchmarks.sh
```

---

## 🚀 Panduan Menjalankan Sistem Secara Lokal

### 1. Jalankan Seluruh Container Pendukung
```bash
docker-compose up -d postgres redis rabbitmq prometheus grafana
```

### 2. Jalankan Migrasi Database
```bash
cd backend
migrate -path migrations -database "postgres://postgres:postgres@localhost:5432/flash_sale_db?sslmode=disable" up
```

### 3. Jalankan Backend Server
```bash
cd backend
DB_NAME=flash_sale_db DB_USER=postgres DB_PASSWORD=postgres DB_HOST=localhost DB_PORT=5432 \
REDIS_ADDR=localhost:6379 RABBITMQ_URL=amqp://guest:guest@localhost:5672/ SERVER_PORT=8080 \
go run cmd/server/main.go
```
* **API Endpoint:** `http://localhost:8080/query`
* **Metrics:** `http://localhost:8080/metrics`
* **Prometheus:** `http://localhost:9090`
* **Grafana:** `http://localhost:3000`
* **RabbitMQ UI:** `http://localhost:15672` (`guest` / `guest`)

### 4. Jalankan Frontend
```bash
cd frontend
npm install
npm run dev
```
Buka browser di `http://localhost:5173`.

---

## 📄 Lisensi
Didistribusikan di bawah lisensi MIT.
