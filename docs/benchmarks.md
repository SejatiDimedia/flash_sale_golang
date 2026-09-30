# 📊 Flash Sale Platform Benchmark & Load Test Report

Laporan ini mendokumentasikan hasil pengujian beban nyata (*real-world stress test*) pada sistem **Flash Sale Platform** menggunakan **k6**, untuk menguji daya tahan konkurensi tinggi, performa latensi, serta pembuktian jaminan **Zero-Overselling**.

---

## 💻 Spesifikasi Mesin Pengujian

Semua metrik dalam dokumen ini dihasilkan langsung dari eksekusi nyata pada lingkungan pengujian berikut:

| Parameter | Spesifikasi Riil |
|---|---|
| **Perangkat** | Apple MacBook Pro (`Timurs-MacBook-Pro.local`) |
| **Processor** | Apple M1 Pro (10-Core CPU: 8 performance cores + 2 efficiency cores) |
| **Arsitektur** | ARM64 (`aarch64`) |
| **Sistem Operasi** | macOS Darwin Kernel Version 25.6.0 |
| **Go Runtime** | `go version go1.25.0 darwin/arm64` |
| **Node.js** | Node.js v20+ |
| **k6 Version** | `k6 v1.x (darwin/arm64)` |
| **Database** | PostgreSQL 16 (Docker container `routeforce-postgres`, connection pool: 500) |
| **Cache & Engine** | Redis 7 Alpine (Docker container `routeforce-redis`) |
| **Message Broker** | RabbitMQ 3 Management Alpine (Docker container `routeforce-rabbitmq`) |

---

## 🎯 Ringkasan Eksekutif Hasil Uji Beban

| Skenario | Virtual Users (VUs) | Total Iterasi | Total HTTP Req | Throughput | Median Latency | p(95) Latency | HTTP Error Rate | Pembelian Berhasil | Overselling |
|---|---|---|---|---|---|---|---|---|---|
| **1. Ramp-Up** | 0 ➔ 200 VUs | 2,433 | 4,868 | 138.6 req/s | 276 ms | 1,145 ms | **0.00%** | 500 / 500 tiket | **0** |
| **2. Sudden Spike** | 10 ➔ 300 VUs | 1,503 | 3,008 | 119.4 req/s | 2,468 ms | 4,170 ms | **0.00%** | 500 / 500 tiket | **0** |
| **3. Flash Sale Blitz** | 500 VUs serentak | 2,000 | 4,003 | 134.9 req/s | 4,545 ms | 6,887 ms | **0.00%** | 100 / 100 tiket | **0** |

> [!NOTE]
> Tiap iterasi melakukan 2 panggilan HTTP: (1) Pendaftaran akun pengguna acak (menggunakan kalkulasi hashing `bcrypt`), dan (2) Eksekusi mutasi checkout dengan *Idempotency-Key* dan token otorisasi Bearer.

---

## 📈 Skenario 1: Ramp-Up (Beban Bertahap hingga 200 VUs)

Skenario ini menguji stabilitas server saat beban pengguna meningkat perlahan dari 0 ke 50, lalu 100, memuncak di 200 pengguna serentak selama 35 detik.

### Output Konsol Eksekusi Nyata:
```text
     execution: local
        script: loadtest/ramp_up.js
        output: -

     scenarios: (100.00%) 1 scenario, 200 max VUs, 40s max duration (incl. graceful stop):
              * ramp_up_scenario: Up to 200 looping VUs for 35s over 4 stages (gracefulRampDown: 5s, gracefulStop: 30s)

  █ TOTAL RESULTS 

    CUSTOM
    checkout_latency_ms............: avg=408.40ms  min=4ms      med=276ms    max=2211ms p(90)=940.8ms p(95)=1145.8ms
    error_rate.....................: 0.00%  0 out of 2433
    successful_purchases...........: 500    14.24/s

    HTTP
    http_req_duration..............: avg=718.72ms  min=4.51ms   med=554.94ms max=2.3s   p(90)=1.62s   p(95)=1.83s 
    http_req_failed................: 0.00%  0 out of 4868
    http_reqs......................: 4868   138.64/s

    EXECUTION
    iteration_duration.............: avg=1.54s     min=178.33ms med=1.47s    max=4.25s  p(90)=2.27s   p(95)=3.07s 
    iterations.....................: 2433   69.29/s
    vus............................: 9      min=8         max=199
    vus_max........................: 200    min=200       max=200
```

### Analisis:
- Server mempertahankan **0.00% error rate** dengan throughput **138.64 requests/detik**.
- Tiket habis terdistribusi merata tepat sejumlah stok awal (500 tiket). Permintaan checkout berikutnya menerima respons GraphQL `sold out` secara tertib tanpa memicu error 500.

---

## ⚡ Skenario 2: Sudden Spike (*Thundering Herd* hingga 300 VUs)

Skenario ini mereplikasi lonjakan ekstrem saat penjualan tiket dibuka seketika (*gate open*), di mana jumlah virtual users melompat dari 10 menjadi 300 VUs hanya dalam rentang 2 detik.

### Output Konsol Eksekusi Nyata:
```text
     execution: local
        script: loadtest/sudden_spike.js
        output: -

     scenarios: (100.00%) 1 scenario, 300 max VUs, 30s max duration (incl. graceful stop):
              * sudden_spike: Up to 300 looping VUs for 25s over 4 stages (gracefulRampDown: 5s, gracefulStop: 30s)

  █ TOTAL RESULTS 

    CUSTOM
    checkout_latency_ms............: avg=2465.33ms min=8ms      med=2468ms   max=5940ms p(90)=3993.8ms p(95)=4170.8ms
    error_rate.....................: 0.00%  0 out of 1503
    successful_purchases...........: 500    19.83/s

    HTTP
    http_req_duration..............: avg=1.93s      min=7.45ms   med=1.91s    max=5.93s  p(90)=3.6s    p(95)=3.99s 
    http_req_failed................: 0.00%  0 out of 3008
    http_reqs......................: 3008   119.35/s

    EXECUTION
    iteration_duration.............: avg=3.92s      min=127.95ms med=4.4s     max=7.62s  p(90)=5.47s   p(95)=5.89s 
    iterations.....................: 1503   59.63/s
    vus_max........................: 300    min=300       max=300
```

### Analisis:
- Meskipun terjadi lonjakan 300 goroutine paralel yang memicu beban CPU pada hashing bcrypt dan koneksi database pool, **tidak ada satu pun request yang mengalami *network dropped* (0% http_req_failed)**.
- Rate limiter dan Redis atomic lock berhasil menyerap hentakan spike tanpa membebani storage layer secara fatal.

---

## 🔥 Skenario 3: Flash Sale Blitz (Uji Pembuktian Zero-Overselling)

Skenario uji paling krusial: **500 Virtual Users bersaing serentak memperebutkan hanya 100 tiket terbatas** dengan 2.000 percobaan transaksi checkout simultan.

### Output Konsol Eksekusi Nyata:
```text
     execution: local
        script: loadtest/flash_sale_blitz.js
        output: -

     scenarios: (100.00%) 1 scenario, 500 max VUs, 1m15s max duration (incl. graceful stop):
              * flash_sale_blitz: 2000 iterations shared among 500 VUs (maxDuration: 45s, gracefulStop: 30s)

================ BENCHMARK AUDIT VERIFICATION ================
Event ID: a563b909-6a18-4be2-a285-9de62134bdf3
Initial Stock: 100
Final Available Stock in DB: 0
==============================================================

  █ TOTAL RESULTS 

    CUSTOM
    checkout_latency_ms............: avg=4076.97ms min=247ms    med=4545.5ms max=7530ms p(90)=6708.2ms p(95)=6887.05ms
    sold_out_rejections............: 1900   64.04/s
    successful_purchases...........: 100    3.37/s

    HTTP
    http_req_duration..............: avg=3.67s     min=1.91ms   med=4.23s    max=7.53s  p(90)=6.26s    p(95)=6.7s 
    http_req_failed................: 0.00%  0 out of 4003
    http_reqs......................: 4003   134.93/s

    EXECUTION
    iterations.....................: 2000   67.41/s
    vus............................: 500    min=500       max=500
    vus_max........................: 500    min=500       max=500
```

### Verifikasi Ground Truth di PostgreSQL:
Query langsung pada database setelah eksekusi:
```sql
SELECT status, count(*), sum(quantity) 
FROM orders 
WHERE event_id = 'a563b909-6a18-4be2-a285-9de62134bdf3' 
GROUP BY status;

  status   | count | sum 
-----------+-------+-----
 CONFIRMED |   100 | 100
(1 row)

SELECT total_stock, available_stock 
FROM events 
WHERE id = 'a563b909-6a18-4be2-a285-9de62134bdf3';

 total_stock | available_stock 
-------------+-----------------
         100 |               0
(1 row)
```

### Kesimpulan Audit:
- **Total Tiket Tersedia Awal:** 100
- **Total Pembelian Berhasil:** 100
- **Total Penolakan Sold Out:** 1,900
- **Sisa Stok Terakhir di Database:** 0
- **Tingkat Overselling:** **0.000% (TERBUKTI ZERO OVERSELLING SECARA MATEMATIS & SISTEMIK)**.

---

## 🔁 Cara Mereproduksi Benchmark Secara Mandiri

1. **Jalankan Infrastruktur Pendukung:**
   ```bash
   docker-compose up -d postgres redis rabbitmq prometheus grafana
   ```

2. **Jalankan Backend Server:**
   ```bash
   cd backend
   DB_NAME=flash_sale_db DB_USER=postgres DB_PASSWORD=postgres DB_HOST=localhost DB_PORT=5432 \
   REDIS_ADDR=localhost:6379 RABBITMQ_URL=amqp://guest:guest@localhost:5672/ \
   go run cmd/server/main.go
   ```

3. **Jalankan Skrip Benchmark:**
   ```bash
   # Jalankan semua skenario sekaligus
   ./loadtest/run_benchmarks.sh

   # Atau jalankan skenario individual
   k6 run loadtest/ramp_up.js
   k6 run loadtest/sudden_spike.js
   k6 run loadtest/flash_sale_blitz.js
   ```

4. **Pantau Metrik Secara Real-Time:**
   - **Grafana Dashboard:** Buka `http://localhost:3000` (User: `admin`, Pass: `admin`), masuk ke menu Dashboards ➔ **Flash Sale Platform - Real-time Performance & Reliability**.
   - **Prometheus Targets:** Buka `http://localhost:9090/targets`.
