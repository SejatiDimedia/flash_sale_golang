# 📌 Flash Sale Platform — Master Progress Tracker & Full Roadmap

**Terakhir Diperbarui:** 25 Agustus 2026  
**Status Keseluruhan:** 🎉 FASE 1 & FASE 2 SELESAI 100% (11/20 Steps Terlaksana)

---

## 🗺️ Roadmap Lengkap Seluruh Fase Project

```
[ Fase 1: Core MVP (SELESAI) ] ──► [ Fase 2: Real-time UX (SELESAI) ] ──► [ Fase 3: Hardening ] ──► [ Fase 4: Frontend ]
 (Step 1 - 7)                            (Step 8 - 11)                         (Step 12 - 15)            (Step 16 - 20)
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

## ⚡ FASE 2: Real-Time UX & Concurrency (SELESAI 100% 🏆)

- [x] **Step 8:** Setup GraphQL Subscriptions (WebSocket Transport di Gin + gqlgen)
- [x] **Step 9:** Live Stock Update Broadcast (`stockUpdated`) via Redis Pub/Sub
- [x] **Step 10:** Live Order Status Push (`orderStatusChanged`) dari RabbitMQ Worker
- [x] **Step 11:** Waiting Room & Virtual Queue (Redis Sorted Set `ZADD`/`ZRANK`, Admission Gate `admitUsers`, Checkout Pass Token)
- [x] **Verifikasi:** Sistem antrian virtual teruji menolak checkout langsung saat antrian aktif, dan meloloskan user saat tiket pass diberikan!

---

## 🛡️ FASE 3: System Hardening, Fault Tolerance & Load Testing (UP NEXT)

### 🔜 Step 12: Dead-Letter Queue (DLQ) & Auto-Retry di RabbitMQ
- [ ] Setup DLQ exchange `order_events_dlx` dan queue `order_processing_dlq` di RabbitMQ
- [ ] Mekanisme auto-retry 3x dengan exponential backoff jika database mengalami transient error

### 🔜 Step 13: Background Reconciliation Job (Audit Consistency)
- [ ] Buat cron worker Go (`time.Ticker`) yang berjalan otomatis setiap 1–5 menit
- [ ] Sinkronisasi otomatis selisih stok antara Redis counter vs PostgreSQL table untuk mencegah data drift

### 🔜 Step 14: Structured Logging & Request Tracing
- [ ] Pasang structured logger dengan Trace ID per request
- [ ] Pencatatan metrik latency p95 / p99 dan throughput transaksi per detik

### 🔜 Step 15: Concurrency & Load Testing dengan `k6`
- [ ] Buat script load test `k6` mensimulasikan **2.000 Virtual Users** berebut 100 tiket secara bersamaan
- [ ] Verifikasi otomatis: **Tepat 100 order `CONFIRMED`, stok akhir = 0, dan ZERO OVERSELL!**

---

## 🎨 FASE 4: Frontend React, Dashboard & CI/CD Deployment

- [ ] **Step 16:** Setup Frontend React + TanStack Query + Vite + Tailwind CSS
- [ ] **Step 17:** User Interface (Flash Sale Live Experience & Real-Time Countdown)
- [ ] **Step 18:** Admin Dashboard (Live Sales Analytics & Queue Monitor)
- [ ] **Step 19:** CI/CD Pipeline (GitHub Actions: Linter & Race Condition Test)
- [ ] **Step 20:** Cloud Deployment & Live Demo Video Portfolio
