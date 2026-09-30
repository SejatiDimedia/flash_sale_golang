# 🧪 Panduan & Dokumentasi Pengujian Sistem (Testing Suite)

Dokumen ini menjelaskan seluruh arsitektur pengujian untuk **Flash Sale Platform**, mulai dari Unit Testing logika bisnis, Integration Testing dengan *Race Detector* (`-race`), GraphQL Resolver Testing, hingga Frontend Unit dan E2E Browser Testing.

---

## 🏗️ Struktur & Hirarki Test Suite

```
flash_sale_platform/
├── backend/
│   ├── internal/service/checkout_logic_test.go      # Unit Test: Logika Bisnis & Quota
│   ├── internal/graph/schema_resolvers_test.go     # Resolver Test: RBAC & Input Validation
│   └── tests/integration_test.go                   # Integration Test: Race, Idempotency, DLQ
├── frontend/
│   ├── src/components/modals.test.tsx              # Component Test: Vitest + Testing Library
│   └── e2e/flash_sale_flow.spec.ts                 # E2E Test: Playwright Browser Automation
└── loadtest/
    ├── ramp_up.js                                  # k6: Ramp-Up Traffic
    ├── sudden_spike.js                             # k6: Thundering Herd Spike
    └── flash_sale_blitz.js                         # k6: Limited Stock War (Zero Oversell)
```

---

## 1. ⚙️ Unit Testing (Table-Driven Tests)

Unit test dirancang menggunakan pola *table-driven test* untuk menguji logika bisnis deterministik tanpa bergantung pada dependensi eksternal (DB/Redis/Network).

### Skenario yang Diuji (`backend/internal/service/checkout_logic_test.go`):
1. **Perhitungan Total Harga:** Validasi kuantitas tiket, harga VIP, tiket gratis (harga 0), dan penolakan input negatif atau nol.
2. **Validasi Kuota Pembelian (`max_per_user`):** Anti-scalping quota enforcement, batas ketat 1 tiket per user, akumulasi order lama + baru.
3. **Validasi Status Event:** Penolakan checkout saat event berstatus `draft`, `scheduled`, atau `closed`.
4. **Metrik Waiting Room:** Perhitungan estimasi waktu tunggu berdasarkan posisi antrean FIFO.
5. **Mekanisme Kedaluwarsa Reservasi:** Pemulihan stok ketika status order PENDING melewati ambang batas TTL (10 menit).

### Cara Menjalankan:
```bash
cd backend
go test -v ./internal/service/...
```

### Hasil Eksekusi Aktual:
```text
=== RUN   TestCalculateTotalPrice
--- PASS: TestCalculateTotalPrice (0.00s)
=== RUN   TestValidatePurchaseQuota
--- PASS: TestValidatePurchaseQuota (0.00s)
=== RUN   TestValidateEventStatus
--- PASS: TestValidateEventStatus (0.00s)
=== RUN   TestWaitingRoomQueueMetrics
--- PASS: TestWaitingRoomQueueMetrics (0.00s)
=== RUN   TestReservationExpiration
--- PASS: TestReservationExpiration (0.00s)
PASS
ok  	github.com/sejatidimedia/flash_sale_platform/internal/service	0.21s
```

---

## 2. 🛡️ Integration Testing dengan Race Detector (`-race`)

Integration test (`backend/tests/integration_test.go`) menguji integritas menyeluruh dengan infrastruktur riil (PostgreSQL, Redis, dan RabbitMQ).

### Skenario yang Diuji:
- **3.a. N Request Paralel ke Stok Terbatas:**
  50 goroutine bersaing memperebutkan 10 tiket terbatas. Diverifikasi bahwa:
  - Tepat 10 transaksi sukses terbentuk.
  - 40 transaksi lainnya ditolak dengan pesan `sold out`.
  - Sisa stok akhir di Redis dan PostgreSQL tepat bernilai 0 (tidak pernah negatif).
- **3.b. Checkout Idempotency Paralel:**
  10 goroutine serentak mengirimkan payload checkout dengan `Idempotency-Key` yang sama persis. Diverifikasi hanya tepat 1 order terbentuk dan stok hanya terpotong 1.
- **3.c. Reservasi Kedaluwarsa Melepas Stok:**
  User A mereservasi tiket hingga stok habis (0). Setelah waktu reservasi kedaluwarsa, worker membatalkan order dan mengembalikan stok. User B kemudian sukses membeli tiket yang telah dilepaskan tersebut.
- **3.d. Kegagalan di Tengah Checkout (Broker Down):**
  Koneksi RabbitMQ diputus sengaja saat checkout berlangsung. Sistem memicu automatic rollback stok di Redis dan PostgreSQL. Stok terbukti utuh tanpa ada kebocoran stok (*Zero Stock Leak*).
- **3.e. Retry Backoff & Dead Letter Queue (DLQ):**
  Pesan pesanan yang gagal diproses mengalami retry bertahap (3 kali) dengan exponential backoff. Setelah batas retry habis, pesan secara otomatis dialihkan ke antrean `order_processing_dlq` dan tidak diproses berulang.

### Cara Menjalankan:
```bash
cd backend
go test -v -race tests/integration_test.go
```

### Hasil Eksekusi Aktual:
```text
=== RUN   TestIntegration_ParallelCheckoutZeroOversell
    integration_test.go:186: ✅ [Zero-Oversell Passed] Total Requests: 50 | Success: 10 | Rejected: 40 | Final Stock: 0
--- PASS: TestIntegration_ParallelCheckoutZeroOversell (0.31s)
=== RUN   TestIntegration_IdempotencyKeyParallel
    integration_test.go:271: ✅ [Idempotency Passed] 10 Parallel Requests resulted in exactly 1 Order (ID: d0bbc24d-258c-4c4b-b671-65a5966eba60, Stock: 9)
--- PASS: TestIntegration_IdempotencyKeyParallel (0.21s)
=== RUN   TestIntegration_ExpiredReservationReleasesStock
    integration_test.go:335: ✅ [Expired Reservation Release Passed] Stock restored and User B successfully purchased
--- PASS: TestIntegration_ExpiredReservationReleasesStock (0.07s)
=== RUN   TestIntegration_MidCheckoutFailureNoStockLeak
    integration_test.go:393: ✅ [Zero Stock Leak Passed] RabbitMQ failure triggered automatic rollback! Stock remains intact at 5
--- PASS: TestIntegration_MidCheckoutFailureNoStockLeak (0.08s)
=== RUN   TestIntegration_RetryBackoffAndDLQ
    integration_test.go:470: ✅ [DLQ Verified] Received routed message in DLQ: OrderID 5ecda844-48f0-4eae-ba17-6ddf211d2542
    integration_test.go:495: ✅ [Worker Idempotency Verified] Duplicate message for CONFIRMED order processed cleanly
--- PASS: TestIntegration_RetryBackoffAndDLQ (5.06s)
PASS
ok  	command-line-arguments	7.22s
```

---

## 3. 🔐 GraphQL Resolver Testing (RBAC & Validasi Input)

File `backend/internal/graph/schema_resolvers_test.go` memverifikasi kontrak API GraphQL:
1. **Role-Based Access Control (RBAC):**
   - Guest tidak dapat membeli tiket, masuk waiting room, atau melihat pesanan.
   - Regular User tidak dapat membuka gate waiting room (`setGateMode`), memasukkan paksa pengguna (`admitUsersFromWaitingRoom`), atau melihat semua pesanan dan audit log admin.
   - Admin memiliki akses penuh ke mutasi administratif.
2. **Validasi Input Tanggal:**
   - Format tanggal yang tidak sesuai standar RFC3339 menghasilkan error deskriptif yang bersih (*clean GraphQL error*), bukan *panic* atau internal server error.

### Cara Menjalankan:
```bash
cd backend
go test -v ./internal/graph/...
```

### Hasil Eksekusi Aktual:
```text
=== RUN   TestResolver_Authorization_RBAC
--- PASS: TestResolver_Authorization_RBAC (0.00s)
=== RUN   TestResolver_InputValidation_DateFormats
--- PASS: TestResolver_InputValidation_DateFormats (0.00s)
=== RUN   TestResolver_HealthCheck
--- PASS: TestResolver_HealthCheck (0.00s)
PASS
ok  	github.com/sejatidimedia/flash_sale_platform/internal/graph	0.70s
```

---

## 4. 💻 Frontend Testing (Vitest & Playwright E2E)

### 4.a Component Tests (Vitest + React Testing Library)
Menguji komponen modal UI (`frontend/src/components/modals.test.tsx`):
- Modal Checkout: kalkulasi subtotal dan rendering kuota.
- Modal Waiting Room: progress bar giliran, estimasi waktu tunggu, dan tombol redirect saat giliran tiba.
- Empty states dan error notification.

**Cara Menjalankan:**
```bash
cd frontend
npm test -- --run
```

**Hasil Eksekusi:**
```text
 ✓ src/components/modals.test.tsx (5 tests) 14ms
 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  17:27:00
   Duration  412ms
```

### 4.b End-to-End Test (Playwright)
Menguji satu siklus perjalanan pengguna penuh (*full user journey*) dari browser headless Chromium (`frontend/e2e/flash_sale_flow.spec.ts`):
1. Pengguna membuka halaman katalog flash sale.
2. Memilih event berstatus aktif dan menekan tombol **"Beli Tiket"**.
3. Sistem mendeteksi antrean dan menampilkan **Virtual Waiting Room**.
4. Pengguna menunggu giliran dan status berubah menjadi **"GILIRAN ANDA TIBA!"**.
5. Pengguna menekan tombol checkout, transaksi diproses secara atomik, dan modal konfirmasi berhasil ditampilkan.

**Cara Menjalankan:**
```bash
cd frontend
npx playwright test
```

**Hasil Eksekusi:**
```text
Running 1 test using 1 worker
  ✓  [chromium] › e2e/flash_sale_flow.spec.ts:5:5 › Flash Sale User Journey: Masuk Antrean -> Dapat Giliran -> Checkout Sukses (1.2s)
  1 passed (1.9s)
```
