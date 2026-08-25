# 📌 Flash Sale Platform — Master Progress Tracker & Full Roadmap

**Terakhir Diperbarui:** 25 Agustus 2026  
**Status Keseluruhan:** Fase 1 — Step 6 Selesai & Terverifikasi (6/20 Steps Terlaksana)

---

## 🗺️ Roadmap Lengkap Seluruh Fase Project

```
[ Fase 1: Core MVP ] ──► [ Fase 2: Real-time UX ] ──► [ Fase 3: Hardening & Load Test ] ──► [ Fase 4: Frontend & CI/CD ]
 (Step 1 - 7)                 (Step 8 - 11)                 (Step 12 - 15)                       (Step 16 - 20)
```

---

## 🚀 FASE 1: Core MVP Backend (Backend Inti & Async Pipeline)

### ✅ Step 1: Scaffolding & Containerized Infrastructure (SELESAI)
- [x] Go module initialized: `github.com/sejatidimedia/flash_sale_platform`
- [x] Clean Architecture folder structure (`cmd`, `internal/{config,graph,repository,service,worker,middleware,pkg}`)
- [x] Docker Compose: PostgreSQL 16 (`:5432`), Redis 7 (`:6379`), RabbitMQ 3 (`:5672`, `:15672`)
- [x] Gin Framework + gqlgen GraphQL engine setup di `backend/cmd/server/main.go`
- [x] `.env`, `.env.example`, `.gitignore`, dan `README.md` portfolio

### ✅ Step 2: Database Schema & Migration (SELESAI)
- [x] Database migration dengan `golang-migrate` (`000001_init_schema.up.sql` & `.down.sql`)
- [x] Tabel PostgreSQL terbuat: `users`, `events`, `orders`, `order_logs`

### ✅ Step 3: Authentication (Register & Login + JWT) (SELESAI)
- [x] PostgreSQL Connection Pool (`pgxpool`) dengan optimasi high-concurrency
- [x] User Repository (`user_repository.go`)
- [x] Auth Service (`auth_service.go`): Password hashing **bcrypt** + **JWT token** 24 jam
- [x] Auth Middleware (`middleware/auth.go`): Ekstraksi token dari header & inject claims ke `context.Context`
- [x] GraphQL Mutation `register`, `login`, dan Protected Query `me` (Teruji via curl & Postman)

### ✅ Step 4: CRUD Event (Admin & Public) (SELESAI)
- [x] Event Repository (`event_repository.go`) & Event Service (`event_service.go`)
- [x] Proteksi RBAC: Hanya role `admin` yang bisa `createEvent` dan `updateEvent`
- [x] Public Query `events` dan `event(id)`
- [x] Mapper data bersih di `mapper.go` (Teruji create event Coldplay)

### ✅ Step 5: Redis In-Memory Stock & Atomic Checkout (SELESAI)
- [x] Redis Client Wrapper (`internal/pkg/redisclient/redis.go`)
- [x] **Redis Lua Script (`DecrStockAtomic`)** untuk garansi 100% **Zero-Oversell**
- [x] Anti-Spam Rate Limiter (sliding-window di Redis)
- [x] Anti-Scalping (`max_per_user` validation) — Teruji menolak pembelian saat kuota habis
- [x] Order Repository (`order_repository.go`) & Checkout Service (`checkout_service.go`)
- [x] Mutation `purchaseTicket` & Query `myOrders`

### ✅ Step 6: RabbitMQ Asynchronous Worker Pool (SELESAI & TERVERIFIKASI)
- [x] RabbitMQ Client Wrapper (`internal/pkg/rabbitmq/rabbitmq.go`) dengan Topic Exchange `order_events` dan Queue `order_processing`
- [x] Integrasi `CheckoutService` untuk mem-publish event `order.pending`
- [x] **Order Worker Pool (10 goroutines paralel)** dengan **Manual ACK (`msg.Ack`)** di `internal/worker/order_worker.go`
- [x] **Graceful Shutdown** di `backend/cmd/server/main.go` menggunakan `signal.Notify` & `http.Server.Shutdown`
- [x] **Verifikasi:** Log Worker berhasil memproses order `PENDING` ➡️ `CONFIRMED` di background via Postman!

### 🔜 Step 7: Order Query & Admin Overview (SEDANG BERJALAN)
- [x] Tambah method `GetAllOrders` & `CreateOrderLog` di `order_repository.go`
- [x] Worker otomatis mencatat audit trail log ke tabel `order_logs`
- [ ] Query `orders(eventId: ID)` khusus admin untuk memantau seluruh transaksi
- [ ] Uji coba query `orders` via Postman

---

## ⚡ FASE 2: Real-Time UX & Concurrency (WebSockets & Waiting Room)

### 🔜 Step 8: Setup GraphQL Subscriptions (WebSocket Transport)
- [ ] Pasang transport WebSocket di Gin & gqlgen (`transport.Websocket`)
- [ ] Hubungkan Redis Pub/Sub untuk broadcast channel antar-goroutine

### 🔜 Step 9: Live Stock Update Broadcast (`stockUpdated`)
- [ ] Buat GraphQL Subscription: `stockUpdated(eventId: ID!): Event!`
- [ ] Publish update stok ke Redis Pub/Sub setiap kali terjadi checkout sukses

### 🔜 Step 10: Live Order Status Push (`orderStatusChanged`)
- [ ] Buat GraphQL Subscription: `orderStatusChanged(orderId: ID!): Order!`
- [ ] Worker RabbitMQ me-relay notifikasi saat status berubah dari `PENDING` ➡️ `CONFIRMED`

### 🔜 Step 11: Waiting Room & Virtual Queue (Anti-Thundering Herd)
- [ ] Implementasi Redis Sorted Set (`ZADD` / `ZRANK`) untuk antrian user sebelum flash sale dimulai
- [ ] Berikan nomor antrian real-time ke user saat memasuki *Waiting Room*

---

## 🛡️ FASE 3: System Hardening, Fault Tolerance & Load Testing

### 🔜 Step 12: Dead-Letter Queue (DLQ) & Auto-Retry
- [ ] Setup DLQ exchange & queue di RabbitMQ (`order_processing_dlq`)
- [ ] Mekanisme retry otomatis 3x dengan backoff delay jika database gagal menyimpan order

### 🔜 Step 13: Background Reconciliation Job (Audit Consistency)
- [ ] Buat cron worker Go (`time.Ticker`) yang berjalan setiap 1–5 menit
- [ ] Sinkronisasi otomatis selisih stok antara Redis counter vs PostgreSQL table untuk mencegah data drift

### 🔜 Step 14: Structured Logging & Metrics
- [ ] Pasang structured logger (Zap / Zerolog) dengan trace ID per request
- [ ] Metrik latency p95 / p99 dan throughput per detik

### 🔜 Step 15: Concurrency & Load Testing dengan `k6`
- [ ] Buat script load test `k6` mensimulasikan **2.000 Virtual Users** berebut 100 tiket secara bersamaan
- [ ] Verifikasi otomatis: **Tepat 100 order `CONFIRMED`, stok akhir = 0, dan ZERO OVERSELL!**

---

## 🎨 FASE 4: Frontend React, Dashboard & CI/CD Deployment

### 🔜 Step 16: Setup Frontend React + TanStack Query + Vite
- [ ] Scaffolding React dengan Vite & Tailwind CSS
- [ ] Setup TanStack Query + `graphql-request` untuk Query & Mutation
- [ ] Setup `graphql-ws` untuk Subscription WebSocket real-time

### 🔜 Step 17: User Interface (Flash Sale Live Experience)
- [ ] Halaman Katalog Event dengan Countdown Timer Flash Sale
- [ ] Halaman Waiting Room & Live Queue Position
- [ ] Tombol Checkout Cepat dengan Optimistic UI update

### 🔜 Step 18: Admin Dashboard (Live Sales Analytics)
- [ ] Tabel transaksi real-time menggunakan **TanStack Table** (Sorting, Filtering, Pagination)
- [ ] Grafik penjualan tiket live & log antrian

### 🔜 Step 19: CI/CD Pipeline (GitHub Actions)
- [ ] Buat `.github/workflows/backend-ci.yml`: Linter (`golangci-lint`), Unit Test, dan Integration Test otomatis
- [ ] Test race condition otomatis saat pull request

### 🔜 Step 20: Cloud Deployment & Live Demo
- [ ] Deploy backend ke Railway / Render / Fly.io
- [ ] Deploy frontend ke Vercel
- [ ] Demo video & dokumentasi arsitektur final untuk portfolio
