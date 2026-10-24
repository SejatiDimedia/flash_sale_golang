# Platform Tiket Flash Sale Berkecepatan Tinggi

Solusi penjualan tiket daring dengan sistem antrean teratur dan jaminan stok akurat untuk penyelenggara acara serta promotor hiburan.

## Latar Belakang

Penjualan tiket konser dan acara populer sering mengalami lonjakan pengunjung yang sangat masif pada detik pertama loket dibuka. Ketika puluhan ribu calon pembeli menyerbu situs web secara serentak, sistem transaksi konvensional kerap mengalami kelambatan parah, transaksi macet di tengah jalan, atau bahkan situs berhenti beroperasi.

Dampak paling merugikan bagi penyelenggara adalah terjadinya penjualan tiket melebihi kapasitas fisik (overselling). Hal ini menciptakan kekecewaan besar bagi penggemar yang telah membayar tetapi tidak mendapatkan kursi, merusak reputasi merek penyelenggara, serta menimbulkan beban operasional besar untuk proses pengembalian dana manual dan penanganan komplain.

## Tujuan Proyek

Proyek ini bertujuan untuk:
- Memastikan sistem penjualan tiket tetap stabil, responsif, dan tidak tumbang saat menerima lonjakan trafik ekstrem.
- Memberikan jaminan mutlak bahwa tiket tidak akan pernah terjual melebihi kapasitas fisik yang tersedia.
- Menyediakan transparansi proses bagi calon pembeli melalui informasi antrean yang diperbarui secara langsung di layar.
- Melindungi pembeli dari penagihan berulang akibat klik panik atau gangguan koneksi internet.
- Memfasilitasi pembayaran instan multi-kanal dan penerbitan tiket digital aman secara langsung.
- Membantu penyelenggara mengawasi laju penjualan, memantau omset riil, dan mengatur aliran pengunjung secara fleksibel.

## Solusi

### Ruang Antrean Virtual dan Radar Urutan Langsung
Calon pembeli yang datang saat trafik memuncak diarahkan ke ruang antrean digital yang tertib. Pengguna dapat melihat nomor urutan dan estimasi waktu tunggu secara langsung tanpa harus memuat ulang halaman peramban, mengurangi rasa cemas saat memperebutkan tiket terbatas.

### Perlindungan Penjualan Tiket Berlapis
Mekanisme penguncian kuota bekerja seketika saat pembeli menekan tombol beli. Sistem memastikan setiap tiket yang dialokasikan terkunci aman untuk satu pembeli sah, sehingga tiket fisik tidak pernah terjual lebih dari satu kali.

### Pembelian Ekspres dan Batas Kuota Anti-Calo
Pengguna dapat memilih tiket dan menyelesaikan reservasi dalam hitungan detik. Setiap akun dibatasi kuota pembelian maksimal sesuai kebijakan acara untuk mencegah aksi pemborongan tiket oleh calo.

### Pencegah Transaksi Ganda Otomatis
Sistem mengenali dan mengamankan setiap instruksi pembelian unik dari pengguna. Jika pengguna tidak sengaja menekan tombol beberapa kali atau terjadi gangguan jaringan, sistem hanya memproses satu transaksi tanpa memotong kuota ganda atau membebankan biaya tambahan.

### Pemrosesan Pesanan Cepat di Latar Belakang
Penyelesaian pesanan, pembentukan tanda terima digital, dan pengiriman notifikasi diproses secara terpisah di latar belakang. Pemisahan alur ini membuat antarmuka pengguna merespons dalam hitungan detik tanpa tertahan oleh proses pencatatan data yang berat.

### Simulasi Pembayaran Multi-Kanal Terpadu
Sistem menyediakan antarmuka pembayaran langsung yang mendukung berbagai metode transaksi modern seperti QRIS, transfer rekening virtual bank, dompet digital, dan kartu kredit, lengkap dengan verifikasi pembayaran otomatis.

### Tiket Digital Mandiri dengan Kode QR dan Barcode
Setelah pembayaran terkonfirmasi, pembeli langsung menerima e-tiket digital interaktif yang dilengkapi barcode dan kode QR unik untuk keperluan pemindaian gerbang masuk acara.

### Pelepasan Tiket Kedaluwarsa Otomatis
Tiket yang telah dipilih namun tidak diselesaikan pembayarannya dalam batas waktu yang ditentukan akan dilepaskan kembali ke kuota umum secara otomatis, memberikan kesempatan kepada antrean pembeli berikutnya.

### Pusat Kendali Penyelenggara dan Pemantau Omset Langsung
Penyelenggara acara dibekali ruang kendali untuk memantau grafik penjualan secara langsung, memeriksa sisa kuota tiket, melihat omset total, meninjau jejak audit transaksi, serta mengatur laju pelepasan calon pembeli dari ruang antrean secara manual maupun otomatis.

## Hasil

Uji coba sistem pada skenario persaingan kuota ekstrem menghasilkan performa yang terukur:
- Tingkat kelebihan penjualan 0% (zero overselling), di mana seluruh transaksi sukses tidak pernah melampaui kuota fisik yang ditentukan.
- Tingkat kegagalan koneksi sistem 0,00% pada lonjakan trafik tiba-tiba dengan throughput mencapai 138 transaksi per detik.
- Tepat 100 tiket terjual ludes dari 100 kuota yang tersedia dalam perebutan oleh 500 pengguna simultan, dengan 1.900 permintaan selebihnya ditolak secara tertib tanpa gangguan sistem.
- Tidak ada kebocoran stok tiket ketika terjadi simulasi gangguan layanan perantara di tengah proses transaksi.

## Teknologi

Go, React, TypeScript, GraphQL, PostgreSQL, Redis, RabbitMQ, Docker, Prometheus, Grafana.

---

Tertarik mengamankan penjualan tiket acara Anda dari risiko kegagalan sistem dan tiket berlebih? Hubungi kami untuk konsultasi arsitektur sistem transaksi berkecepatan tinggi.
