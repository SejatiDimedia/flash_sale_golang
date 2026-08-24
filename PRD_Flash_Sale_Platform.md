# Product Requirements Document (PRD)
## Flash Sale / Event Ticketing Platform

**Versi:** 1.0
**Tanggal:** 24 Agustus 2026
**Status:** Draft
**Tech Stack:** Golang, GraphQL, React, TanStack Query, PostgreSQL, Redis, RabbitMQ

---

## 1. Latar Belakang & Tujuan

### 1.1 Problem Statement
Penjualan tiket event/produk dengan stok terbatas (flash sale) sering menghadapi masalah:
- **Overselling** — stok terjual melebihi kapasitas karena race condition saat traffic tinggi.
- **Latency tinggi** saat lonjakan trafik bersamaan (thundering herd).
- **User experience buruk** — user tidak tahu posisi antrian, checkout gagal tanpa penjelasan jelas.
- **Sistem tidak tangguh** terhadap bot/scalper yang memborong stok.

### 1.2 Tujuan Produk
Membangun platform flash sale yang:
1. Menjamin **konsistensi stok** (tidak ada oversell) meski diakses ribuan user bersamaan.
2. Memberikan **update status real-time** (antrian, stok, status order) ke user.
3. Memisahkan proses **kritikal (locking stok)** dari proses **non-kritikal (notifikasi, invoice)** menggunakan arsitektur event-driven.
4. Menjadi showcase teknis: Go concurrency, GraphQL API/subscription, Redis caching & locking, RabbitMQ async processing.

### 1.3 Target Pengguna
- **End User** — membeli tiket/produk flash sale.
- **Admin/Organizer** — membuat event, mengatur stok, memantau penjualan.

---

## 2. Scope

### 2.1 In Scope (MVP)
- Manajemen event & produk (CRUD oleh admin).
- Mekanisme antrian & flash sale checkout dengan stok terbatas.
- Real-time update status stok & antrian ke frontend.
- Order processing asynchronous (payment simulasi, invoice, notifikasi).
- Autentikasi user (register/login, JWT).
- Dashboard admin sederhana (statistik penjualan real-time).

### 2.2 Out of Scope (MVP)
- Payment gateway asli (pakai payment simulasi/sandbox dulu).
- Sistem refund kompleks.
- Multi-tenant / multi-organizer marketplace.
- Native mobile app (fokus web/React dulu).
- Sistem anti-bot canggih (captcha dasar saja).

---

## 3. User Stories & Fitur

### 3.1 End User

| ID | User Story | Prioritas |
|----|------------|-----------|
| US-01 | Sebagai user, saya bisa melihat daftar event flash sale yang akan datang | Must |
| US-02 | Sebagai user, saya bisa melihat detail event (waktu mulai, stok, harga) | Must |
| US-03 | Sebagai user, saya bisa masuk ke "waiting room" beberapa saat sebelum sale dimulai | Must |
| US-04 | Sebagai user, saya menerima update real-time posisi antrian saya | Must |
| US-05 | Sebagai user, saya bisa melakukan checkout saat giliran saya tiba | Must |
| US-06 | Sebagai user, saya mendapat notifikasi jika checkout berhasil/gagal (stok habis) | Must |
| US-07 | Sebagai user, saya bisa melihat riwayat order saya | Should |
| US-08 | Sebagai user, saya menerima invoice/e-tiket via notifikasi in-app/email | Should |
| US-09 | Sebagai user, saya dibatasi maksimal N tiket per akun untuk mencegah scalping | Should |

### 3.2 Admin/Organizer

| ID | User Story | Prioritas |
|----|------------|-----------|
| US-10 | Sebagai admin, saya bisa membuat event baru beserta stok & jadwal sale | Must |
| US-11 | Sebagai admin, saya bisa mengubah/menutup event sebelum sale dimulai | Must |
| US-12 | Sebagai admin, saya bisa memantau jumlah stok terjual secara real-time | Must |
| US-13 | Sebagai admin, saya bisa melihat log antrian & order untuk audit | Should |
| US-14 | Sebagai admin, saya bisa export laporan penjualan | Could |

---

## 4. Arsitektur Sistem

### 4.1 High-Level Architecture

```
┌─────────────┐      GraphQL Query/Mutation      ┌──────────────────┐
│   React     │ ───────────────────────────────► │   Go Backend      │
│  Frontend   │ ◄─────────────────────────────── │  (gqlgen server)  │
│             │      GraphQL Subscription (WS)    │                   │
└─────────────┘                                    └───────┬───────────┘
                                                             │
                        ┌────────────────────────────────────┼──────────────────────┐
                        │                                    │                      │
                        ▼                                    ▼                      ▼
                ┌───────────────┐                  ┌──────────────────┐   ┌──────────────────┐
                │  PostgreSQL    │                  │      Redis        │   │    RabbitMQ       │
                │ (source of     │                  │ - Stock counter   │   │ - order.created    │
                │  truth: order, │                  │   (atomic decr)   │   │ - order.confirmed  │
                │  event, user)  │                  │ - Distributed lock│   │ - notification.send│
                └───────────────┘                  │ - Pub/Sub (fan-out│   └─────────┬────────┘
                                                     │   subscription)   │             │
                                                     └────────────────────┘             ▼
                                                                                ┌──────────────────┐
                                                                                │  Worker Pool       │
                                                                                │ (goroutines)       │
                                                                                │ - Process order     │
                                                                                │ - Generate invoice  │
                                                                                │ - Send notification │
                                                                                └──────────────────┘
```

### 4.2 Alur Kritikal: Checkout Flash Sale

1. User klik "Buy" → GraphQL mutation `purchaseTicket(eventId, qty)`.
2. Resolver mengecek rate limit user di Redis (cegah spam klik).
3. Resolver melakukan **atomic decrement** stok di Redis (`DECRBY`), bukan langsung ke Postgres, untuk menghindari lock contention di database saat traffic tinggi.
   - Jika hasil decrement < 0 → rollback (`INCRBY`) → return error "stok habis".
   - Jika berhasil → lanjut ke step 4.
4. Backend publish event `order.pending` ke RabbitMQ (exchange type: `direct` atau `topic`).
5. Response cepat dikirim ke user: **"Order sedang diproses"** (status: PENDING) — request awal tidak menunggu proses DB penuh, sehingga latency checkout tetap rendah.
6. **Worker pool** (goroutines, jumlah worker dikontrol via config) consume queue `order.pending`:
   - Insert order ke PostgreSQL (source of truth) dalam transaksi.
   - Publish `order.confirmed` → trigger notifikasi & invoice generation (consumer terpisah).
7. GraphQL Subscription `orderStatusChanged(orderId)` mem-push update ke frontend secara real-time (dari Redis Pub/Sub yang di-relay ke WebSocket subscriber), sehingga user melihat status berubah dari PENDING → CONFIRMED tanpa refresh.

### 4.3 Kenapa Redis untuk Stock Lock (bukan langsung DB)
- Redis single-threaded per command → operasi `DECRBY` atomik secara natural, cocok untuk high-concurrency counter tanpa perlu row-level lock di Postgres yang bisa jadi bottleneck.
- Postgres tetap jadi source of truth final — job worker yang menuliskan hasil final ke DB dalam transaksi, dengan reconciliation job berkala untuk memastikan Redis counter selalu sinkron dengan DB.

### 4.4 Kenapa RabbitMQ (bukan langsung proses sync)
- Memisahkan **critical path** (validasi stok, respon cepat ke user) dari **non-critical path** (simpan ke DB, generate invoice, kirim notifikasi) → checkout tetap responsif meski proses downstream lambat.
- Kalau service notifikasi/invoice down sementara, order tidak hilang — tetap ada di queue, bisa diproses ulang (durable queue + retry + dead-letter queue).

### 4.5 Frontend Data Layer

Frontend menggunakan kombinasi dua client library, dipisah sesuai jenis komunikasi ke backend:

| Layer | Library | Fungsi |
|---|---|---|
| Query & Mutation (request-response) | **TanStack Query** + `graphql-request` | Fetch daftar event, detail event, riwayat order, mutation `purchaseTicket` — dengan caching otomatis, retry, loading/error state bawaan, dan optimistic update saat checkout |
| Subscription (real-time push) | **`graphql-ws`** (WebSocket client) | Menerima update `orderStatusChanged` dan `stockUpdated` dari server secara real-time |
| Tabel data (dashboard admin) | **TanStack Table** | Sorting, filtering, pagination untuk log order/antrian di dashboard admin |

**Alasan pemilihan:**
- `graphql-request` dipilih sebagai GraphQL client dasar karena ringan (dibanding Apollo Client yang membawa banyak fitur bawaan yang belum tentu terpakai di MVP ini).
- **TanStack Query** menjadi state management layer di atas `graphql-request` — menghandle caching, stale-while-revalidate, `refetchInterval` (berguna sebagai fallback polling stok jika koneksi WebSocket subscription terputus), serta optimistic UI saat user klik "Buy" (state langsung berubah, rollback otomatis kalau mutation gagal).
- Subscription **tidak dihandle oleh TanStack Query** (bukan cakupannya) — sehingga tetap perlu client WebSocket terpisah (`graphql-ws`) khusus untuk fitur real-time.
- Routing menggunakan **React Router** (bukan TanStack Router) — dipilih karena lebih standar dan dokumentasinya lebih luas, sehingga fokus belajar bisa lebih diarahkan ke sisi backend (concurrency, Redis, RabbitMQ) yang menjadi centerpiece project ini. TanStack Router tetap bisa jadi opsi eksplorasi lanjutan di luar MVP.

---

## 5. Desain Concurrency (Go)

| Komponen | Pola Concurrency |
|----------|-------------------|
| Worker pool untuk consume RabbitMQ | Fixed-size goroutine pool (misal 10–50 worker), diambil dari channel job queue |
| Graceful shutdown | `context.Context` + `sync.WaitGroup` untuk memastikan job yang sedang jalan selesai sebelum service mati |
| Rate limiting per user | Token bucket / sliding window di Redis, dicek sebelum masuk proses checkout |
| GraphQL Subscription fan-out | Goroutine per koneksi WebSocket, broadcast via channel yang di-subscribe dari Redis Pub/Sub |
| Reconciliation job | Goroutine terpisah (cron-like, via `time.Ticker`) untuk sinkronisasi stok Redis vs Postgres berkala |

---

## 6. Data Model (Ringkas)

### 6.1 Entities

**User**
- id, name, email, password_hash, created_at

**Event**
- id, name, description, start_sale_at, end_sale_at, total_stock, price, status (draft/scheduled/active/closed)

**Order**
- id, user_id, event_id, quantity, status (PENDING/CONFIRMED/FAILED/CANCELLED), created_at, confirmed_at

**OrderLog / AuditLog**
- id, order_id, event_type, payload, created_at

### 6.2 Redis Keys (contoh)
- `stock:{event_id}` → integer counter stok tersedia
- `rate_limit:{user_id}:{event_id}` → counter dengan TTL untuk anti-spam
- `queue_position:{event_id}:{user_id}` → posisi antrian (opsional, untuk waiting room)

### 6.3 RabbitMQ Exchanges/Queues (contoh)
- Exchange: `order_events` (topic)
  - Routing key `order.pending` → queue `order_processing`
  - Routing key `order.confirmed` → queue `notification_queue`, `invoice_queue`
  - Dead-letter queue: `order_processing_dlq` (untuk order yang gagal diproses berkali-kali)

---

## 7. GraphQL API (Contoh Skema Tingkat Tinggi)

```graphql
type Event {
  id: ID!
  name: String!
  description: String
  startSaleAt: Time!
  endSaleAt: Time!
  totalStock: Int!
  availableStock: Int!
  price: Float!
  status: EventStatus!
}

type Order {
  id: ID!
  event: Event!
  quantity: Int!
  status: OrderStatus!
  createdAt: Time!
}

enum OrderStatus {
  PENDING
  CONFIRMED
  FAILED
  CANCELLED
}

type Query {
  events(status: EventStatus): [Event!]!
  event(id: ID!): Event
  myOrders: [Order!]!
}

type Mutation {
  purchaseTicket(eventId: ID!, quantity: Int!): Order!
}

type Subscription {
  orderStatusChanged(orderId: ID!): Order!
  stockUpdated(eventId: ID!): Event!
}
```

---

## 8. Non-Functional Requirements

| Kategori | Requirement |
|----------|-------------|
| Performance | Response time mutation `purchaseTicket` < 300ms (p95) pada beban simulasi 1000 concurrent user |
| Consistency | Zero oversell — stok akhir di DB tidak boleh melebihi total_stock, diverifikasi via automated test |
| Scalability | Backend stateless, bisa di-scale horizontal (state antrian/lock disimpan di Redis, bukan in-memory app) |
| Reliability | Order tidak boleh hilang jika worker crash — queue durable, message acknowledgment manual |
| Observability | Structured logging, metrics dasar (jumlah order/detik, queue length, error rate) |
| Security | Password hashing (bcrypt/argon2), JWT auth, rate limiting, input validation di resolver |

---

## 9. Testing & Validasi

- **Unit test** — logika bisnis inti (validasi stok, kalkulasi, dsb).
- **Integration test** — resolver GraphQL + Redis + RabbitMQ (bisa pakai `testcontainers-go`).
- **Load test** — simulasi flash sale nyata menggunakan `k6` atau `hey`, contoh skenario: 2000 virtual user checkout stok 100 tiket dalam 1 menit, verifikasi stok akhir = 0 dan order confirmed = 100 (tidak lebih).
- **Chaos test (opsional)** — matikan worker/consumer di tengah proses untuk memastikan message tidak hilang (requeue bekerja).

---

## 10. CI/CD & DevOps

### 10.1 Tujuan
Memastikan setiap perubahan kode teruji otomatis (terutama logika concurrency & stock consistency) sebelum masuk ke branch utama, serta deployment yang konsisten dan repeatable.

### 10.2 Tools
| Kebutuhan | Tools |
|---|---|
| CI/CD Runner | GitHub Actions (gratis untuk public repo) |
| Containerization | Docker & Docker Compose |
| Container Registry | GitHub Container Registry (GHCR) |
| Deployment Backend | Railway / Render / Fly.io |
| Deployment Frontend | Vercel / Netlify (auto-deploy dari Git) |
| DB Migration | `golang-migrate` |

### 10.3 Continuous Integration (CI) — jalan tiap push/PR

| Stage | Detail |
|---|---|
| Lint | `golangci-lint` (Go), `eslint` (React) |
| Unit Test | `go test ./...`, `npm test` |
| Integration Test | Service containers Postgres, Redis, RabbitMQ di GitHub Actions runner → test resolver GraphQL end-to-end, termasuk skenario race condition (misal N goroutine checkout stok terbatas secara bersamaan, verifikasi tidak ada oversell) |
| Build | `go build`, `npm run build` — memastikan tidak ada error compile |
| Docker Image Build | Build & push image backend/frontend ke GHCR (hanya di branch `main`) |

### 10.4 Continuous Deployment (CD) — jalan setelah CI sukses di `main`

| Stage | Detail |
|---|---|
| DB Migration | Jalankan migration otomatis sebelum versi baru live |
| Deploy Backend | Push image ke Railway/Render/Fly.io |
| Deploy Frontend | Auto-deploy via Vercel/Netlify (connect ke repo) |
| Smoke Test | Hit endpoint health-check pasca deploy untuk verifikasi service up dan terkoneksi ke Redis/RabbitMQ/Postgres |

### 10.5 Struktur Workflow (Contoh)

```
.github/workflows/
├── backend-ci.yml     # lint, unit test, integration test, build Go
├── frontend-ci.yml    # lint, unit test, build React
└── deploy.yml         # build & push docker image, migration, trigger deploy
```

### 10.6 Branching Strategy (Sederhana)
- `main` — selalu deployable, trigger CD otomatis.
- `develop` — integrasi fitur sebelum ke `main` (opsional untuk MVP, bisa disederhanakan langsung feature branch → `main` via PR).
- `feature/*` — satu branch per fitur/user story, wajib lolos CI sebelum merge (branch protection rule).

### 10.7 Manfaat Tambahan untuk Portfolio
Pipeline CI yang menjalankan test konsistensi stok otomatis pada tiap PR menjadi bukti konkret kualitas engineering — bisa didemokan langsung saat interview (screenshot/link ke Actions run yang hijau, atau video singkat proses race condition ke-detect sebelum merge).

---

## 11. Metodologi & Pendekatan Pengerjaan

### 11.1 Pendekatan Development
Project ini dikerjakan secara **hands-on oleh developer sendiri**, dengan bantuan **Antigravity** (AI coding assistant) sebagai **pemandu/guide**, bukan sebagai eksekutor otomatis. Prinsip yang dipegang:

- **Antigravity berperan sebagai mentor/pair-programmer** — memberi arahan flow, best practice, dan penjelasan konsep (misalnya kenapa pakai Redis atomic decrement, kenapa worker pool perlu graceful shutdown), tapi **eksekusi kode dilakukan sendiri** oleh developer.
- Tujuannya adalah **pembelajaran mendalam**, bukan sekadar menghasilkan project jadi — sehingga developer benar-benar memahami setiap keputusan arsitektur dan bisa menjelaskannya secara mandiri (penting untuk konteks interview/portfolio).
- Setiap fitur dikerjakan dengan alur: **pahami requirement → diskusi/tanya flow ke Antigravity → tulis kode sendiri → review & debug sendiri → validasi dengan test**.

### 11.2 Implikasi ke Roadmap
- Kecepatan pengerjaan mengikuti ritme belajar, bukan dikejar output maksimal secepatnya — roadmap di bawah bersifat fleksibel dan bisa disesuaikan ulang.
- Dokumentasi proses (catatan belajar, keputusan teknis, trade-off yang diambil) sebaiknya dicatat berjalan seiring — ini juga jadi bahan berharga untuk storytelling di CV/portfolio/interview nantinya.

---

## 12. Roadmap (Bertahap)

| Fase | Fokus |
|------|-------|
| **Fase 1 — Core MVP** | Auth, CRUD event (admin), checkout dasar dengan Redis stock lock, order via RabbitMQ worker, GraphQL query/mutation |
| **Fase 2 — Real-time UX** | GraphQL Subscription untuk status order & stok, waiting room/antrian |
| **Fase 3 — Hardening** | Rate limiting, dead-letter queue & retry mechanism, reconciliation job, load testing |
| **Fase 4 — Polish** | Dashboard admin analytics, export laporan, payment gateway sandbox (Midtrans) |

---

## 13. Metrik Keberhasilan (untuk konteks portfolio/demo)

- Tidak ada oversell dalam load test dengan berbagai skenario concurrency.
- Latency checkout tetap stabil meski traffic dinaikkan bertahap (100 → 1000 → 5000 concurrent user).
- Dokumentasi arsitektur & trade-off jelas (bisa dijelaskan saat interview).
- Demo end-to-end: dari admin membuat event → user checkout → notifikasi diterima, semua real-time.

---

## 14. Lampiran: Asumsi & Risiko

**Asumsi:**
- Payment diasumsikan sukses otomatis (simulasi) pada MVP, integrasi payment gateway asli menyusul di fase lanjutan.
- Single event server (bisa di-scale multi-instance karena state disimpan di Redis, bukan lokal).

**Risiko:**
- Redis sebagai single point of failure untuk stock lock — mitigasi: Redis Sentinel/Cluster di fase produksi, atau minimal snapshot/backup berkala untuk keperluan demo.
- Reconciliation antara Redis dan Postgres bisa drift jika ada bug — mitigasi: reconciliation job berjalan berkala + alert jika ada selisih.

---

*Dokumen ini adalah working draft dan dapat disesuaikan seiring perkembangan implementasi.*