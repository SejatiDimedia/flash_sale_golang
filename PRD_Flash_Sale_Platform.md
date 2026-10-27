# Product Requirements Document (PRD)
## Flash Sale / Event Ticketing Platform

**Versi:** 2.0 (High-Concurrency & Scalability Hardening)  
**Tanggal:** 27 Oktober 2026  
**Status:** In Progress  
**Tech Stack:** Golang, GraphQL (gqlgen), React, TanStack Query, PostgreSQL 16, Redis 7, RabbitMQ 3, Prometheus, Grafana, Midtrans Snap  

---

## 1. Latar Belakang & Tujuan

### 1.1 Problem Statement
Penjualan tiket konser atau produk edisi terbatas (flash sale) memiliki karakteristik trafik yang ekstrem (*Thundering Herd* / *Flash Crowd*):
- **Overselling**: Stok fisik terjual melebihi kapasitas riil karena *race condition* saat ribuan request masuk di milidetik yang sama.
- **Database Lock Contention**: Database relasional kolaps akibat antrean *row lock* (`SELECT ... FOR UPDATE`) dan kehabisan *connection pool*.
- **Cache Stampede / Dogpiling**: Saat cache kedaluwarsa pada detik ke nol, ribuan request membaca katalog secara bersamaan dan langsung membebani database utama.
- **Serangan Bot & Calo (Scalper)**: Skrip otomatis menembakkan puluhan request per milidetik, menghabiskan kuota dan menyingkirkan pembeli manusia.
- **Cascading Failure**: Keterlambatan respons dari pihak ketiga (Payment Gateway) menahan ribuan goroutine hingga server kehabisan memori (*OOM*).

### 1.2 Tujuan Produk
Membangun platform flash sale dan ticketing skala enterprise yang:
1. Menjamin **konsistensi stok 100% (Zero-Overselling)** di bawah beban ribuan hingga puluhan ribu request per detik.
2. Menerapkan **Virtual Waiting Room Adaptif** berbasis Redis ZSET untuk menertibkan trafik lonjakan tanpa menumbangkan database.
3. Melindungi pembacaan katalog dari **Cache Stampede** menggunakan utilitas konkurensi Go `sync/singleflight`.
4. Menerapkan **Distributed Rate Limiting** untuk memfilter bot dan calo sebelum request masuk ke antrean kritis.
5. Memiliki ketahanan terhadap kegagalan downstream menggunakan **Circuit Breaker** dan **Dead-Letter Queue (DLQ)**.
6. Menyediakan update status pesanan dan kuota secara **real-time** melalui WebSocket GraphQL Subscription.

### 1.3 Target Pengguna
- **End User**: Membeli tiket konser atau produk flash sale dengan pengalaman antrean yang transparan dan bebas pesanan ganda.
- **Admin/Organizer**: Mengelola jadwal event, kuota tiket, mengendalikan gerbang antrean (manual/auto), dan memantau analitik secara real-time.

---

## 2. Scope

### 2.1 Fitur yang Sudah Selesai (Fase 1 - 4)
- Autentikasi pengguna berbasis JWT dengan auto-seeding akun admin.
- Manajemen event dan kuota tiket dengan proteksi anti-scalping (maksimal tiket per akun).
- Virtual Waiting Room berbasis Redis Sorted Set (ZSET FIFO) dengan *Single-Use Checkout Pass*.
- Dual-Layer Stock Protection: Pengurangan stok atomik via Redis Lua Script + SQL conditional update di PostgreSQL.
- Idempotency Key Guard berbasis Redis SetNX untuk mencegah pesanan dan tagihan duplikat.
- Pemrosesan asinkron RabbitMQ dengan Worker Pool 10 goroutine, retry exponential backoff, dan routing ke Dead-Letter Queue (DLQ).
- Siklus pembayaran Midtrans Snap simulator dengan dukungan multi-channel (QRIS dinamis, Virtual Account, Kartu Kredit).
- Penerbitan E-Tiket otomatis dengan dual scanner: 1D Barcode (Code-128) dan 2D QR Code verifikasi.
- Worker Rekonsiliasi Otomatis untuk mengaudit integritas stok dan membatalkan pesanan kedaluwarsa (> 10 menit).
- Monitoring terintegrasi dengan Prometheus Metrics dan Grafana Dashboard.

### 2.2 Fitur Baru: Enterprise Scalability & Hardening (Fase 5)
- **Distributed Rate Limiting (Token Bucket / Sliding Window)**: Membatasi frekuensi request per IP/User ID via Redis untuk menangkis bot calo.
- **Cache Stampede Protection (`sync/singleflight`)**: Mengonsolidasikan ribuan request pembacaan event yang terjadi bersamaan menjadi satu query database tunggal.
- **Adaptive Waiting Room Admission**: Mengatur laju pelepasan antrean secara dinamis berdasarkan metrik kesehatan database dan antrean pesan (*congestion control*).
- **Circuit Breaker Pattern (`sony/gobreaker`)**: Memutus sementara panggilan ke Payment Gateway jika terjadi degradasi atau timeout ekstrem untuk mengisolasi risiko.

---

## 3. User Stories & Kriteria Penerimaan

### 3.1 End User
| ID | User Story | Kriteria Penerimaan | Prioritas |
|---|---|---|---|
| US-01 | Sebagai user, saya bisa melihat katalog event flash sale | Data tersaji cepat dari cache Redis dengan proteksi singleflight | Must |
| US-02 | Sebagai user, saya masuk ke ruang tunggu (waiting room) saat trafik padat | Mendapatkan nomor antrean FIFO yang diperbarui live | Must |
| US-03 | Sebagai user, saya menerima checkout pass saat giliran tiba | Pass bertipe one-time token dengan masa kedaluwarsa singkat | Must |
| US-04 | Sebagai user, saya bisa membeli tiket dengan jaminan tidak oversold | Stok terpotong atomik, respons instan berstatus PENDING | Must |
| US-05 | Sebagai user, saya tidak akan ditagih ganda jika klik berulang kali | Idempotency guard mengembalikan ID order yang sama | Must |
| US-06 | Sebagai user, saya bisa membayar via Midtrans (QRIS/VA/Card) | Pembayaran terverifikasi langsung via webhook atau simulator | Must |
| US-07 | Sebagai user, saya menerima e-tiket dengan Barcode & QR Code | Barcode Code-128 dan QR Code bisa di-scan di gate fisik | Must |

### 3.2 Admin & Organizer
| ID | User Story | Kriteria Penerimaan | Prioritas |
|---|---|---|---|
| US-08 | Sebagai admin, saya bisa membuat dan mengedit event | CRUD event tersimpan di PostgreSQL dan otomatis sinkron ke Redis | Must |
| US-09 | Sebagai admin, saya bisa mengontrol gerbang antrean (Auto vs Manual) | Admin bisa membuka atau menahan batch antrean waiting room | Must |
| US-10 | Sebagai admin, saya bisa memantau metrik penjualan real-time | Grafik kuota, throughput checkout, dan latency tersaji di dashboard | Should |

### 3.3 Sistem & Resiliensi (Fase 5 Hardening)
| ID | System Story | Kriteria Penerimaan | Prioritas |
|---|---|---|---|
| US-11 | Sistem membatasi request per IP/User (Rate Limiter) | Request melebihi batas (misal > 10 req/s) menerima HTTP 429 | Must |
| US-12 | Sistem mencegah Cache Stampede saat lonjakan pembacaan | 1.000 pembacaan bersamaan hanya menghasilkan 1 query database via singleflight | Must |
| US-13 | Sistem mengatur laju antrean secara adaptif | Batch size waiting room mengecil jika latency DB > 50ms, dan membesar jika sistem sehat | Should |
| US-14 | Sistem melindungi goroutine dari payment timeout (Circuit Breaker) | Circuit terbuka jika error rate > 30%, mengembalikan fallback tanpa menggantung | Should |
| US-15 | Sistem menjamin pesan asinkron tidak hilang (Transactional Outbox) | Order dan event antrean disimpan atomik dalam 1 transaksi SQL; outbox worker menjamin At-Least-Once Delivery ke RabbitMQ | Must |

---

## 4. Arsitektur Sistem Skala Tinggi

### 4.1 Diagram Alur Data Enterprise

```
                               ┌────────────────────────────────────────────────────────┐
                               │                    KLIEN / PENGGUNA                    │
                               └───────────────────────────┬────────────────────────────┘
                                                           │
                                                           ▼
                                         ┌───────────────────────────────────┐
                                         │   Rate Limiter (Token Bucket)     │
                                         │   Filter Bot & Request Spam (429) │
                                         └─────────────────┬─────────────────┘
                                                           │ (Lolos)
                                                           ▼
                                         ┌───────────────────────────────────┐
                                         │   Virtual Waiting Room (ZSET)     │
                                         │   Antrean FIFO + Adaptive Gate    │
                                         └─────────────────┬─────────────────┘
                                                           │ (Batch Admission)
                                                           ▼
                                         ┌───────────────────────────────────┐
                                         │   GraphQL Inbound Controller      │
                                         │   (Query, Mutation, Subscription) │
                                         └─────────┬───────────────┬─────────┘
                                                   │               │
                         ┌─────────────────────────┘               └─────────────────────────┐
                         ▼                                                                   ▼
       ┌───────────────────────────────────┐                               ┌───────────────────────────────────┐
       │   Jalur Baca (Query Katalog)      │                               │   Jalur Tulis (Checkout Mutasi)   │
       │   sync/singleflight + Cache Redis │                               │   Idempotency Lock (Redis SetNX)  │
       └─────────────────┬─────────────────┘                               └─────────────────┬─────────────────┘
                         │                                                                   │
                         ▼                                                                   ▼
       ┌───────────────────────────────────┐                               ┌───────────────────────────────────┐
       │   PostgreSQL (Replica / Cache)    │                               │   Atomic Stock Decr (Redis Lua)   │
       └───────────────────────────────────┘                               └─────────────────┬─────────────────┘
                                                                                             │ (Stok Terkunci)
                                                                                             ▼
                                                                           ┌───────────────────────────────────┐
                                                                           │   PostgreSQL ACID Transaction     │
                                                                           │   orders + outbox_events (Atomic) │
                                                                           └─────────────────┬─────────────────┘
                                                                                             │
                                                                                             ▼
                                                                           ┌───────────────────────────────────┐
                                                                           │   Outbox Relay Worker (Publisher) │
                                                                           │   Poller / Guaranteed Delivery    │
                                                                           └─────────────────┬─────────────────┘
                                                                                             │
                                                                                             ▼
                                                                           ┌───────────────────────────────────┐
                                                                           │   RabbitMQ Topic Exchange         │
                                                                           │   Durable Queue + DLQ Routing     │
                                                                           └─────────────────┬─────────────────┘
                                                                                             │
                                                                                             ▼
                                                                           ┌───────────────────────────────────┐
                                                                           │   Worker Pool (10 Goroutines)     │
                                                                           │   PostgreSQL Write + Circuit Breaker│
                                                                           └───────────────────────────────────┘
```

### 4.2 Rincian Mekanisme Proteksi Konkurensi

1. **Jalur Masuk (Rate Limiting Layer)**:
   Mencegah bot membanjiri server dengan memvalidasi kuota token di Redis. Request yang melanggar batas langsung ditolak sebelum menghabiskan alokasi memori aplikasi.
2. **Jalur Pembacaan (Singleflight Cache Stampede)**:
   Menggunakan `singleflight.Group` di Go. Jika kunci cache `event:{id}` habis masa berlakunya tepat saat lonjakan trafik, ribuan pembacaan hanya mengeksekusi 1 pemanggilan database. Hasil pemanggilan tersebut dibagikan secara serentak ke semua pemanggil.
3. **Jalur Transaksi (Dual-Layer Locking)**:
   - *Layer 1 (Memori)*: `DecrStockAtomic` via Redis Lua Script. Eksekusi atomik single-threaded memastikan tidak ada dua transaksi yang membaca sisa kuota yang sama.
   - *Layer 2 (Database)*: SQL update bersyarat `UPDATE events SET available_stock = available_stock - $1 WHERE id = $2 AND available_stock >= $1`. Jika terjadi selisih, sistem memicu *compensating rollback* ke Redis.
4. **Jalur Asinkron (Worker Pool & DLQ)**:
   Setelah stok aman, order disimpan dengan status `PENDING`. Worker pool Go memproses penulisan audit log dan integrasi pembayaran secara teratur. Jika terjadi error berulang 3 kali, pesan dialihkan ke antrean `order_processing_dlq` dengan header `x-failure-reason` untuk audit manual.
5. **Jalur Toleransi Kegagalan (Circuit Breaker)**:
   Panggilan HTTP ke layanan eksternal (Midtrans API) dibungkus oleh Circuit Breaker. Jika layanan eksternal mengalami timeout atau lonjakan error di atas ambang batas, sirkuit akan terbuka (*OPEN*) sehingga request berikutnya langsung menerima fallback cepat tanpa menggantung goroutine server.
6. **Jalur Keandalan Pesan (Transactional Outbox Pattern)**:
   Mengeliminasi *Dual-Write Problem*. Penulisan pesanan (`orders`) dan payload event (`outbox_events`) dijalankan dalam satu transaksi SQL atomik (`BEGIN ... COMMIT`). Outbox relay worker Go secara berkala membaca event berstatus `PENDING` dan meneruskannya ke RabbitMQ dengan jaminan *At-Least-Once Delivery*, mencegah event hilang jika koneksi message broker sempat terputus.

---

## 5. Matriks Pola Konkurensi Go

| Komponen | Pola Konkurensi Go | Fungsi & Keuntungan |
|---|---|---|
| **Pembacaan Katalog** | `golang.org/x/sync/singleflight` | Mencegah Cache Stampede (Dogpiling) pada database saat lonjakan pembacaan |
| **Worker Pemrosesan Order** | Bounded Goroutine Pool (10 workers) + Channel | Membatasi konkurensi agar tidak membanjiri koneksi database relasional |
| **Pencegahan Bot** | Token Bucket / Sliding Window di Redis | Membatasi laju request per IP/User di layer middleware |
| **Waiting Room Gate** | Adaptive Controller via `time.Ticker` | Mengatur ukuran batch lolos antrean berdasarkan latensi database riil |
| **Panggilan Downstream** | Circuit Breaker (`sony/gobreaker`) | Memutus koneksi macet ke pihak ketiga untuk mencegah kebocoran goroutine |
| **Outbox Relay Publisher** | Transactional Outbox + Background Publisher Goroutine | Menghilangkan Dual-Write Problem antara database SQL dan message broker RabbitMQ |
| **Graceful Shutdown** | `context.Context` + `sync.WaitGroup` + OS Signals | Menunggu worker menyelesaikan transaksi yang berjalan sebelum server mati |
| **Real-time Push** | Goroutine per WebSocket Client + Redis Pub/Sub | Mendorong update status order dan kuota secara instan tanpa polling berat |
| **Auto-Reconciliation** | Background Daemon Goroutine (`time.Ticker`) | Membersihkan order kedaluwarsa dan mengaudit integritas kuota setiap menit |

---

## 6. Model Data & Skema Database

### 6.1 Relasional (PostgreSQL 16)
- **users**: `id` (UUID), `name`, `email`, `password_hash`, `role` (admin/user), `created_at`
- **events**: `id` (UUID), `name`, `description`, `category`, `price`, `total_stock`, `available_stock`, `start_sale_at`, `end_sale_at`, `status`
- **orders**: `id` (UUID), `user_id`, `event_id`, `quantity`, `total_price`, `status` (PENDING/CONFIRMED/CANCELLED), `created_at`, `updated_at`
- **order_logs**: `id` (UUID), `order_id`, `action`, `payload` (JSONB), `created_at`
- **outbox_events**: `id` (UUID), `aggregate_type` (ORDER), `aggregate_id` (UUID), `event_type` (ORDER_CREATED/ORDER_PAID), `payload` (JSONB), `status` (PENDING/PUBLISHED/FAILED), `retry_count` (INT), `created_at`, `processed_at`

### 6.2 Pola Penyimpanan Redis
- `stock:{event_id}`: Integer kuota tiket aktif.
- `waiting_room:{event_id}`: Sorted Set (ZSET) dengan score milidetik kedatangan untuk antrean FIFO.
- `checkout_pass:{event_id}:{user_id}`: Kunci izin checkout sekali pakai dengan masa berlaku 5 menit.
- `idempotency:{key}`: Kunci pencegahan transaksi duplikat dengan status PROCESSING/COMPLETED (TTL 24 jam).
- `rate_limit:{ip}:{endpoint}`: Counter frekuensi akses dengan jendela waktu geser (*sliding window*).

### 6.3 Topologi RabbitMQ
- **Exchange Utama**: `order_events` (Topic Exchange, durable: true).
  - Routing Key `order.created` -> Queue `order_processing`
  - Routing Key `order.confirmed` -> Event downstream untuk tiket dan analitik
- **Dead-Letter Exchange**: `order_events_dlx` (Direct Exchange).
  - Routing Key `order.dlq` -> Queue `order_processing_dlq`

---

## 7. Target Kualitas & Non-Functional Requirements (NFR)

| Kategori | Target Spesifikasi | Metode Pengujian |
|---|---|---|
| **Konsistensi Stok** | 0% Overselling (Tepat 100 tiket teralokasi dari 2.000+ request serentak) | k6 Concurrent Stress Test & Integration Test |
| **Ketersediaan & Stabilitas** | 0.00% Server Crash / HTTP 500 Error di bawah beban puncak | Pengujian beban k6 dengan ambang batas failure rate |
| **Latensi Transaksi** | p95 Latency < 200ms pada mutasi checkout berbeban tinggi | Metrik Prometheus `http_request_duration_seconds` |
| **Ketahanan Bot** | Memblokir > 95% request spam sebelum menyentuh antrean kritis | Simulasi penembakan request agresif per IP |
| **Mitigasi Stampede** | Maksimal 1 query ke database saat kunci cache kadaluwarsa di bawah 1.000 pembaca | Unit test konkurensi Go menggunakan mock database counter |
| **Isolasi Kegagalan** | Goroutine tidak bertambah saat API eksternal timeout | Uji simulasi latensi pihak ketiga dengan Circuit Breaker aktif |
| **Keandalan Event Asinkron** | 0% Pesan Hilang (Zero Message Loss) antara SQL dan Broker | Transactional Outbox Pattern memastikan pengiriman terjamin meski RabbitMQ restart |

---

## 8. Roadmap Pengembangan

| Fase | Target Utama | Status |
|---|---|---|
| **Fase 1: Core Foundation** | Inisialisasi arsitektur, auth JWT, model PostgreSQL, Redis stock lock dasar, RabbitMQ worker | Selesai |
| **Fase 2: Real-Time Experience** | Integrasi GraphQL Subscriptions (WebSocket), Virtual Waiting Room ZSET, Single-Use Pass | Selesai |
| **Fase 3: Idempotency & Resiliency** | Idempotency Key Guard, Retry Exponential Backoff, Dead-Letter Queue (DLQ), Auto-Reconciliation Worker | Selesai |
| **Fase 4: End-to-End Delivery** | Midtrans Payment Simulator, Penerbitan E-Tiket Barcode/QR, Refactoring HTTP Handlers modular | Selesai |
| **Fase 5: Scalability & Hardening** | Distributed Rate Limiter, Cache Stampede Mitigation (`singleflight`), Adaptive Waiting Room, Circuit Breaker | **Fokus Saat Ini** |

---

## 9. Rencana Implementasi Fase 5

1. **Implementasi Distributed Rate Limiter**:
   - Menambahkan middleware rate limiter berbasis Token Bucket / Sliding Window di `backend/internal/middleware/rate_limiter.go`.
   - Mengonfigurasi batas akses per IP dan per user untuk endpoint kritis checkout dan antrean.
2. **Implementasi `sync/singleflight` pada Event Service**:
   - Membungkus pembacaan event di `backend/internal/service/event_service.go` dengan `singleflight.Group` untuk mencegah *Cache Stampede*.
3. **Implementasi Circuit Breaker pada Klien Midtrans**:
   - Menambahkan wrapper `gobreaker.CircuitBreaker` pada pemanggilan HTTP di `backend/internal/pkg/midtrans/client.go`.
4. **Implementasi Adaptive Waiting Room Controller**:
   - Menambahkan penyesuaian otomatis batch admission di `backend/internal/pkg/redisclient/redis.go` berdasarkan metrik beban sistem.
5. **Implementasi Transactional Outbox Pattern**:
   - Membuat migrasi tabel `outbox_events` di PostgreSQL.
   - Mengintegrasikan penulisan order dan outbox event dalam satu transaksi SQL ACID.
   - Membangun `outbox_worker.go` dengan graceful polling dan publisher ke RabbitMQ.
6. **Validasi Beban Lanjutan**:
   - Menjalankan k6 stress test untuk memverifikasi penolakan bot, efisiensi singleflight, dan proteksi circuit breaker.