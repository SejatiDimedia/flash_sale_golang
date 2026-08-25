# 📌 Flash Sale Platform — Master Progress Tracker & Full Roadmap

**Terakhir Diperbarui:** 25 Agustus 2026  
**Status Keseluruhan:** Fase 2 — Step 8, 9 & 10 Selesai & Terverifikasi (10/20 Steps Terlaksana)

---

## 🗺️ Roadmap Lengkap Seluruh Fase Project

```
[ Fase 1: Core MVP (SELESAI) ] ──► [ Fase 2: Real-time UX (SEDANG BERJALAN) ] ──► [ Fase 3: Hardening ] ──► [ Fase 4: Frontend ]
 (Step 1 - 7)                            (Step 8 - 11)                              (Step 12 - 15)            (Step 16 - 20)
```

---

## 🚀 FASE 1: Core MVP Backend (SELESAI 100% 🏆)

- [x] **Step 1:** Scaffolding & Containerized Infrastructure (Postgres, Redis, RabbitMQ)
- [x] **Step 2:** Database Schema & Migration (`golang-migrate`)
- [x] **Step 3:** Authentication (Register & Login + JWT + bcrypt)
- [x] **Step 4:** CRUD Event (Admin RBAC & Public)
- [x] **Step 5:** Redis In-Memory Stock & Atomic Checkout (Lua Script Zero-Oversell)
- [x] **Step 6:** RabbitMQ Asynchronous Worker Pool (Manual ACK + Graceful Shutdown)
- [x] **Step 7:** Order Query & Audit Trail Logging (`order_logs`)

---

## ⚡ FASE 2: Real-Time UX & Concurrency (WebSockets & Waiting Room)

### ✅ Step 8: Setup GraphQL Subscriptions (WebSocket Transport) (SELESAI)
- [x] Pasang transport WebSocket di Gin & gqlgen (`transport.Websocket`)
- [x] Helper Redis Pub/Sub di `internal/pkg/redisclient/redis.go` (`PublishMessage`, `SubscribeChannel`)
- [x] `type Subscription` di `schema.graphqls` & resolvers Go

### ✅ Step 9: Live Stock Update Broadcast (`stockUpdated`) (SELESAI & TERVERIFIKASI)
- [x] Subscription `stockUpdated(eventId: ID!): Event!`
- [x] Broadcast sisa stok via Redis Pub/Sub setiap kali ada tiket terbeli di `checkout_service.go`
- [x] **Verifikasi:** Angka stok di Playground / Dashboard otomatis berkurang secara live via WebSocket!

### ✅ Step 10: Live Order Status Push (`orderStatusChanged`) (SELESAI & TERVERIFIKASI)
- [x] Subscription `orderStatusChanged(orderId: ID!): Order!`
- [x] Worker RabbitMQ mem-broadcast event ke Redis Pub/Sub saat order berubah menjadi `CONFIRMED`
- [x] Client menerima push status perubahan order secara real-time

### 🔜 Step 11: Waiting Room & Virtual Queue (Anti-Thundering Herd) (UP NEXT)
- [ ] Implementasi Redis Sorted Set (`ZADD` / `ZRANK`) untuk antrian user sebelum flash sale dimulai
- [ ] Endpoint `joinWaitingRoom(eventId: ID!)` & `getQueueStatus(eventId: ID!)`
- [ ] Admission Worker untuk meloloskan batch user masuk ke checkout

---

## 🛡️ FASE 3: System Hardening, Fault Tolerance & Load Testing

- [ ] **Step 12:** Dead-Letter Queue (DLQ) & Auto-Retry di RabbitMQ
- [ ] **Step 13:** Background Reconciliation Job (Audit Konsistensi Stok Redis vs DB)
- [ ] **Step 14:** Structured Logging & Metrics
- [ ] **Step 15:** Concurrency & Load Testing dengan `k6` (Simulasi 2.000 Virtual Users berebut tiket)

---

## 🎨 FASE 4: Frontend React, Dashboard & CI/CD Deployment

- [ ] **Step 16:** Setup Frontend React + TanStack Query + Vite
- [ ] **Step 17:** User Interface (Flash Sale Live Experience & Real-Time Countdown)
- [ ] **Step 18:** Admin Dashboard (Live Sales Analytics & Queue Monitor)
- [ ] **Step 19:** CI/CD Pipeline (GitHub Actions)
- [ ] **Step 20:** Cloud Deployment & Live Demo
