# 📌 MILESTONE TRACKER: Hardening, Testing, & Benchmark Flash Sale Platform

> **Catatan:** File ini digunakan sebagai pelacak progres bertahap (milestone) selama pengerjaan berlangsung. Sesuai kesepakatan, file ini dapat dihapus setelah seluruh tugas selesai dan seluruh deliverable final diserahkan.

**Branch Kerja:** `test-and-audit-hardening`  
**Spesifikasi Mesin Eksekusi:** Apple M1 Pro (10-Core CPU, ARM64) | macOS 26.6.2 | Go 1.25.0

---

## 🔍 Audit Awal & Verifikasi Klaim
- [x] **Audit Celah Race Condition & Keandalan:**
  - [x] Analisis mekanisme overselling (Redis atomic Lua script).
  - [x] Analisis alur reservasi, checkout, dan pembatalan saat ini.
  - [x] Identifikasi celah: cache-miss race, DB out-of-order write drift, RabbitMQ publish failure stock leakage, anti-scalping TOCTOU, ketiadaan idempotency key.
- [x] **Laporan Klaim README yang Belum Terbukti:**
  - [x] k6 load test konfigurasi di repo (50 VUs) vs klaim README (1.000 VUs).
  - [x] CI hanya menjalankan 2 unit test tanpa database/Redis/RabbitMQ/race detection riil.
  - [x] Ketiadaan Prometheus `/metrics` dan dashboard Grafana.

---

## 🎯 Milestone 1: Unit Testing (Logika Bisnis & Validasi)
- [x] Table-driven unit test perhitungan stok & batas kuota (`max_per_user` anti-scalping).
- [x] Table-driven unit test kalkulasi harga & validasi jumlah tiket (`quantity >= 1`).
- [x] Table-driven unit test validasi status event (`draft`, `scheduled`, `active`, `closed`).
- [x] Unit test logika antrean Waiting Room & pembuatan/validasi pass token.
- [x] Unit test logika kedaluwarsa reservasi (*reservation expiration logic*).

---

## 🛡️ Milestone 2: Hardening & Bug Fixes (Commit Bertahap)
- [x] **Penerapan Idempotency Key:**
  - [x] Tambahkan dukungan idempotency key pada checkout service & GraphQL middleware.
  - [x] Simpan dan validasi key di Redis dengan TTL untuk mencegah double-order pada request paralel/retry.
- [x] **Pencegahan Kebocoran Stok (Stock Leak Prevention):**
  - [x] Rollback atomik stok Redis (`IncrStock`) dan DB (`RestoreAvailableStock`), serta update status order menjadi `FAILED` jika RabbitMQ publish gagal.
- [x] **Pencegahan Database Race Condition (DB Safe Update):**
  - [x] Implementasikan relative decrement `DeductAvailableStock` di PostgreSQL (`available_stock = available_stock - $1 WHERE available_stock >= $1`).
- [x] **Mekanisme Reservasi Kedaluwarsa & Pembatalan:**
  - [x] Tambahkan `GetExpiredPendingOrders`, `CancelExpiredOrders`, serta background cleaner di reconciliation worker.
- [x] **Worker Idempotency & Reconciliation Fix:**
  - [x] Cegah pemrosesan ganda pada pesan RabbitMQ yang sudah CONFIRMED.
  - [x] Perbaiki data drift auto-correction di Redis menggunakan `SetStock`.

---

## 🧪 Milestone 3: Integration Testing (Race Detection & Fault Tolerance)
- [ ] **3.a Concurrency Test:** N request paralel ke stok terbatas dengan flag `-race` berulang (Zero-Oversell guarantee).
- [ ] **3.b Idempotency Test:** Checkout dengan Idempotency-Key sama dikirim berkali-kali & paralel hanya menghasilkan 1 order.
- [ ] **3.c Expiration Release Test:** Reservasi kedaluwarsa melepaskan stok dan stok dapat dipesan kembali oleh pengguna lain.
- [ ] **3.d Failure Resilience Test:** Simulasi kegagalan di tengah checkout (RabbitMQ terputus/DB error) tidak membocorkan stok.
- [ ] **3.e Retry Backoff & DLQ Test:** Pesan gagal diproses masuk retry dengan exponential backoff lalu ke Dead-Letter Queue (DLQ) tanpa duplikasi pemrosesan.

---

## 🌐 Milestone 4: GraphQL Resolvers Testing
- [ ] Test validasi input untuk setiap mutation (register, login, createEvent, purchaseTicket).
- [ ] Test otorisasi peran (RBAC: Admin vs User biasa vs Guest).
- [ ] Test error format & clean error handling (tidak membocorkan stack trace internal).

---

## 💻 Milestone 5: Frontend Testing
- [ ] Unit/Component test (Vitest/Testing Library) untuk komponen antrean (WaitingRoomModal) dan checkout (CheckoutModal).
- [ ] E2E Test Playwright: Alur lengkap user masuk waiting room, mendapatkan giliran, dan menyelesaikan checkout tiket.

---

## ⚡ Milestone 6: Performa & Load Testing (k6 di `/loadtest`)
- [ ] Skenario k6: Ramp-up bertahap (*load ramping*).
- [ ] Skenario k6: Spike traffic mendadak (*sudden surge*).
- [ ] Skenario k6: Ribuan virtual users bersaing untuk stok kecil (*flash sale blitz*).
- [ ] Pengukuran metrik nyata: Throughput (RPS), Latency p95/p99, Error Rate, Overselling Count (wajib 0).
- [ ] Dokumentasikan hasil benchmark nyata dan spesifikasi mesin di `docs/benchmarks.md`.

---

## 📊 Milestone 7: Observabilitas & Monitoring
- [ ] Tambahkan endpoint Prometheus `/metrics` di Go backend (request rate, latency, panjang antrean, stok tersisa).
- [ ] Konfigurasi Prometheus & dashboard Grafana terintegrasi di `docker-compose.yml`.
- [ ] Screenshot / export panel dashboard saat pengujian beban berlangsung.

---

## 📚 Milestone 8: Deliverables Final & Dokumentasi
- [ ] Dokumen `docs/testing.md` lengkap dengan cara menjalankan seluruh unit, integrasi, dan E2E test.
- [ ] Dokumen `docs/benchmarks.md` dengan angka metrik riil dan panduan reproduksi.
- [ ] Update `README.md` dengan diagram arsitektur Mermaid, penjelasan keputusan teknis, dan verifikasi klaim.
- [ ] Update workflow CI di `.github/workflows/ci.yml` agar menjalankan suite test lengkap.
- [ ] Ringkasan final laporan kerja: perubahan yang dilakukan, status penyelesaian, hasil angka nyata, dan analisis risiko.
