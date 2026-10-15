# PRODUCT REQUIREMENTS DOCUMENT (PRD)

**Nama Produk:** Kalkulator PLTS 24 Jam (Solar Sizing Calculator)
**Versi:** 1.3.0
**Tanggal:** 2026-10-13
**Status:** Draft untuk direview

---

## Riwayat Revisi

| Versi | Tanggal | Perubahan |
|-------|---------|-----------|
| 1.0.0 | - | Versi awal (draft pengguna) |
| 1.1.0 | 2026-10-13 | Perbaikan akurasi rumus, penambahan asumsi & glosarium, penjelasan keputusan teknis, penambahan acceptance criteria & contoh perhitungan |
| 1.2.0 | 2026-10-13 | Penetapan stack teknis: HTMX v4 + Alpine.js + Bootstrap, penambahan database lokal (IndexedDB) untuk riwayat & preferensi |
| 1.3.0 | 2026-10-13 | Penambahan deployment Docker dengan webserver Caddy agar aplikasi dapat dijalankan secara remote |
| 2.0.0 | 2026-10-13 | Pembaruan 6 tahap perancangan teknis PLTS (Inverter VA→W, Energi Realistis/Daftar Alat 24 Jam, LiFePO4 48V modul unit, PV aman hujan, Konfigurasi String Seri/Paralel, serta Pengaman MCB & Kabel DC) |

---

## 1. Ringkasan Eksekutif (Executive Summary)

Aplikasi web **kalkulator PLTS** membantu pemilik rumah, teknisi, atau peminat energi terbarukan merancang spesifikasi lengkap **PLTS Off-Grid 24 Jam Nonstop** (Inverter, Panel Surya, Konfigurasi String, Baterai LiFePO4 48V, serta Ukuran Kabel & MCB DC) berdasarkan kebutuhan energi harian. Studi kasus acuan: sistem rumah PLN 1300 VA dan 5500 VA yang menyala 24 jam penuh dari tenaga surya.

Aplikasi ini **purely client-side** (tanpa backend/logika server): seluruh perhitungan dan rendering dilakukan di browser menggunakan JavaScript (Alpine.js + Bootstrap 5). Data pengguna (riwayat perhitungan & preferensi input) disimpan **lokal di browser** melalui IndexedDB. Aplikasi dikemas sebagai **container Docker** dengan webserver ringan **Caddy** agar dapat dijalankan dan diakses secara **remote**.

## 2. Tujuan Produk (Objectives)

1. Mempermudah perhitungan teknis PLTS menjadi alur 6 tahap yang terstruktur.
2. Memberikan estimasi yang akurat agar pengguna tidak salah memilih kapasitas alat (*under-sizing* maupun *over-sizing*).
3. Menyediakan simulasi rincian beban per alat listrik dan perhitungan realistis 24 jam.
4. Memberikan rekomendasi konfigurasi string MPPT, MCB DC, dan ukuran penampang kabel demi keselamatan instalasi.
5. Menyediakan antarmuka yang bersih, cepat, dan responsif tanpa *page reload*.

## 3. Target Pengguna (Target Audience)

| Segmen | Kebutuhan |
|--------|-----------|
| Masyarakat awam yang merancang PLTS rumah | Alur jelas 6 tahap, hasil mudah dipahami, minimal istilah rumit |
| Teknisi / instalatur PLTS di lapangan | Konfigurasi string seri-paralel, rating MCB DC, ukuran kabel mm², validasi input ketat |

## 4. Ruang Lingkup (Scope)

### 4.1 In-Scope (Versi 2.0)
- Input daya via VA (PLN) atau Watt langsung (berfungsi untuk sizing inverter serta referensi charging alternatif baterai via PLN/Genset).
- 2 metode perhitungan energi harian: Rincian tabel per alat (nama, watt, jam, qty) atau Manual kWh.
- Estimasi durasi charging alternatif (PLN/Genset) saat tanpa sinar matahari.
- 6 output rancangan lengkap:
  1. Inverter: Daya nyata (W) & rekomendasi kelas pasar (3 kW – 5 kW pada 48V).
  2. Energi Harian (Wh & kWh).
  3. Baterai LiFePO4 48V: Kapasitas dasar (Ah), riil (Ah, DoD 80%), kWh, & jumlah modul paralel (modul 200Ah/100Ah).
  4. Panel Surya: PV dasar, PV + rugi 20%, total aktual aman musim hujan, jumlah lembar panel 550 Wp.
  5. Konfigurasi String Panel: Jumlah string paralel & panel seri (contoh 6S 2P), total Vmp, total Imp.
  6. Pengaman & Kabel (SF 1.25): MCB DC & penampang kabel jalur PV dan jalur Baterai.
- Penyimpanan lokal (IndexedDB): riwayat perhitungan dan preferensi input.
- Deployment Docker + Caddy.

---

## 5. Fitur dan Logika Perhitungan (6 Tahapan Teknis)

### 5.1 Tahap 1: Target Sistem & Daya Inverter
- **Konversi Daya Nyata:**
  `Daya Nyata (W) = Daya Semu PLN (VA) × Faktor Daya (0,8)`
  (Contoh PLN 1300 VA: 1300 × 0,8 = 1040 Watt).
- **Sistem Tegangan Baterai:** Default **48 Volt** (menjaga arus tetap rendah dan aman untuk beban > 1 kW).
- **Rekomendasi Kapasitas Inverter:**
  Untuk beban 1040 W pada sistem 48V, disarankan inverter kelas **3 kW hingga 5 kW** untuk mengantisipasi *surge current* lonjakan motor/kompresor.

### 5.2 Tahap 2: Kebutuhan Energi Harian (24 Jam)
Disediakan 2 metode perhitungan:
1. **Rincian Beban Per Alat:**
   `Total Energi (Wh) = ∑ (Daya Alat [W] × Durasi Nyala [Jam] × Jumlah Alat)`
2. **Input Manual kWh:** Input langsung angka kWh harian (otomatis tersinkron dari rincian alat).

### 5.3 Tahap 3: Kapasitas Baterai (LiFePO4 48V)
- Tipe baterai default: **Lithium LiFePO4** dengan Depth of Discharge (DoD) **80%**.
- **Kapasitas Dasar (Ah):**
  `Kapasitas Dasar (Ah) = Energi Harian (Wh) / Tegangan Sistem (48V)`
  (Contoh: 20.000 Wh / 48V = 416,7 Ah).
- **Kapasitas Riil (Ah):**
  `Kapasitas Riil (Ah) = Kapasitas Dasar (Ah) / DoD (0,8)`
  (Contoh: 416,7 Ah / 0,8 = 520,8 Ah ≈ 521 Ah).
- **Jumlah Unit Modul Baterai:**
  `Jumlah Unit = ⌈Kapasitas Riil / Kapasitas Modul⌉`
  (Menggunakan modul 48V 200Ah: 521 / 200 = 2,6 → **3 unit 48V 200Ah** diparalel = total 600 Ah).

### 5.4 Tahap 4: Kebutuhan Panel Surya (PV)
- **Peak Sun Hour (PSH):** Default **4,5 jam/hari** (rata-rata Indonesia).
- **Kebutuhan PV Dasar (Wp):**
  `PV Dasar (Wp) = Energi Harian (Wh) / PSH (4,5 jam)`
  (Contoh: 20.000 Wh / 4,5 jam = 4.444 Wp).
- **Faktor Rugi (Loss Factor):** Ditambahkan rugi 20% (faktor 1,2):
  `PV Total (Wp) = PV Dasar (Wp) × 1,2`
  (Contoh: 4.444 Wp × 1,2 = 5.333 Wp).
- **Cadangan Musim Hujan & Jumlah Lembar:**
  Digenapkan menjadi 6 kWp agar tetap andal saat cuaca mendung. Dengan modul 550 Wp:
  `Jumlah Panel = ⌈6.000 Wp / 550 Wp⌉ = 10,9 → 12 lembar` (Total aktual: 6.600 Wp / 6,6 kWp).

### 5.5 Tahap 5: Konfigurasi Seri & Paralel Panel (String Sizing)
- Karakteristik panel 550 Wp: Vmp = 42V, Imp = 13A.
- Penyesuaian rentang MPPT tegangan tinggi (150V–450V):
  Susunan: **6S 2P** (2 string paralel, tiap string 6 panel seri).
  - Tegangan array total: `6 × 42V = 252 Volt` (Vmp).
  - Arus array total: `2 × 13A = 26 Ampere` (Imp).

### 5.6 Tahap 6: Ukuran Kabel dan Pengaman (MCB DC)
Berdasarkan batas aman (Safety Factor / SF = 1,25):
- **Jalur PV (Panel ke SCC):**
  - Arus desain: `13A × 1,25 = 16,25A`.
  - MCB DC: **20 Ampere**.
  - Kabel minimal: **6 mm²** (Solar DC Cable).
- **Jalur Baterai (Baterai ke Inverter/SCC):**
  - Daya beban penuh misal 4.000 W pada 48V: arus 83,3A (toleransi 90A).
  - Arus desain: `90A × 1,25 = 112,5A`.
  - MCB DC: **125 Ampere**.
  - Kabel minimal: **25 mm²** (Kabel tembaga serabut NYAF).

---

## 6. Contoh Kasus Terpadu: PLTS Rumah 1300 VA (Benchmark Jago Listrik)

**Input:**
- Daya PLN: 1300 VA (Daya nyata 1040 W)
- Durasi: 24 Jam Nonstop Off-Grid
- Pemakaian: Rata-rata 80% (19.968 Wh ≈ 20 kWh/hari)
- Tegangan Sistem: 48V
- Baterai: LiFePO4 (DoD 80%), modul 200 Ah
- PSH: 4,5 jam
- Panel: 550 Wp

**Hasil Perancangan:**
1. **Inverter:** Beban 1040 W → Rekomendasi inverter 48V kapasitas **3 kW – 5 kW**.
2. **Energi:** 20 kWh / hari.
3. **Baterai:** Kapasitas dasar 417 Ah, riil 521 Ah → **3 unit modul 48V 200Ah** paralel (Total 600 Ah / 28,8 kWh).
4. **Panel Surya:** PV dasar 4.444 Wp, rugi 20% = 5.334 Wp, genap aman hujan 6 kWp → **12 lembar 550 Wp** (6.600 Wp aktual).
5. **Konfigurasi String:** **6S 2P** (Vmp: 252V, Imp: 26A).
6. **Kabel & MCB:**
   - Jalur PV: MCB DC 20A, Kabel 6 mm².
   - Jalur Baterai: MCB DC 125A, Kabel 25 mm².

---

## 6. Alur Pengguna (User Flow)

1. Pengguna membuka aplikasi di browser.
2. Melihat form "Kalkulator PLTS 24 Jam" — input terisi otomatis dari preferensi tersimpan (jika ada).
3. Mengisi daya rumah (contoh: 5500), energi harian (contoh: 30 kWh), memilih tegangan 48V, mengatur SPH 4 jam, memilih jenis baterai & DoD.
4. Menekan tombol **"Hitung Kebutuhan"**.
5. Sistem memproses seketika; muncul *Section Hasil* di bawah form dengan animasi transisi halus; hasil juga tersimpan ke riwayat.
6. Pengguna membaca hasil (contoh: Inverter ≥6600W, Panel 9750 WP ≈ 18 lembar, Baterai 48V 782 Ah, SCC 204A).
7. Pengguna dapat mengubah input dan menekan hitung ulang; hasil ter-update langsung tanpa reload.
8. Pengguna dapat membuka tab **Riwayat** untuk melihat, membandingkan, atau menghapus hasil perhitungan sebelumnya.

---

## 7. Persyaratan Non-Fungsional (Non-Functional Requirements)

### 7.1 Keputusan Teknologi & Struktur

> **Keputusan teknis (disepakati):** Stack frontend **HTMX v4 + Alpine.js + Bootstrap (terbaru)**, dengan **database lokal di browser (IndexedDB)** untuk menyimpan riwayat perhitungan dan preferensi input. Aplikasi tetap **pure client-side** (static files, tanpa backend).

**Catatan penting:** Karena aplikasi berjalan murni di browser tanpa backend, HTMX tidak dipakai untuk fungsinya yang utama (AJAX pertukaran HTML dari server). Perannya di sini dibatasi untuk:
- **Render hasil** menggunakan **hx-custom template tag** (fitur HTMX v4) agar HTML hasil perhitungan di-generate dari template di sisi klien, dan
- **Interaksi UI** (misal trigger render ulang, transisi swap) bekerja sama dengan **Alpine.js**.

Alpine.js menangani **state reaktivitas** (input ↔ hasil secara live), dan Bootstrap menangani **styling/komponen** yang sudah siap pakai.

| Aspek | Keputusan |
|-------|-----------|
| Markup | HTML5 semantik |
| Styling | **Bootstrap 5** (CDN) + sedikit CSS kustom |
| Reaktivitas state | **Alpine.js** (CDN) — binding `x-model`, `x-data`, `x-effect` |
| Interaksi/render tambahan | **HTMX v4** (CDN) — template tag `hx-custom`, swap/transisi |
| Penyimpanan lokal | **IndexedDB** (via library pembungkus ringan) untuk riwayat & preferensi |
| Struktur file | `index.html`, `css/style.css`, `js/` (modul: kalkulasi, storage, template), `Caddyfile`, `Dockerfile`, `docker-compose.yml` |
| Distribusi | Statis + container Docker (Caddy) untuk akses remote |

### 7.2 Database Lokal (IndexedDB)

Data disimpan **lokal di browser** melalui **IndexedDB** (bukan localStorage) karena kapasitas lebih besar dan cocok untuk daftar riwayat. Dua store utama:

| Store | Isi | Kegunaan |
|-------|-----|----------|
| `history` | Daftar hasil perhitungan (timestamp, seluruh input, seluruh output) | Menampilkan riwayat, membandingkan, menghapus |
| `preferences` | Nilai input terakhir pengguna (key-value) | Form terisi otomatis saat dibuka kembali |

Fitur:
- **Riwayat perhitungan:** setiap "Hitung" menyimpan entri baru; pengguna dapat melihat daftar, membuka kembali, membandingkan, dan menghapus entri.
- **Preferensi input:** nilai terakhir disimpan otomatis dan dimuat ulang saat halaman dibuka.
- **API:** dibungkus dalam modul JavaScript terpisah (`js/storage.js`) sehingga mudah diuji dan diisolasi.
- **Fallback:** jika IndexedDB tidak tersedia (jarang), fallback ke `localStorage`.

### 7.3 UI/UX
- Desain responsif **mobile-first** (ramah layar HP teknisi di lapangan).
- Hasil ditampilkan dalam **kartu (card)** agar mudah dicerna.
- **Validasi input:** menolak karakter non-numerik pada kolom angka; menolak nilai kosong/nol/non-positif; pesan error inline yang jelas.
- **Tooltip/penjelasan** singkat pada setiap field (definisi SPH, DoD, dll.).
- Bahasa antarmuka: **Indonesia**.

### 7.4 Kinerja
- Respons instan (< 100 ms) karena perhitungan di sisi klien.
- Tanpa *page reload* saat menghitung.

### 7.5 Aksesibilitas
- Kontras warna cukup, ukuran font terbaca, fokus keyboard untuk form.

---

## 8. Penanganan Error & Validasi

| Kondisi | Perilaku |
|---------|----------|
| Kolom angka diisi huruf | Input ditolak; karakter non-numerik diabaikan/blokir |
| Nilai ≤ 0 atau kosong | Validasi gagal; pesan error di bawah field; tombol hitung tidak mengeksekusi |
| Energi harian diisi di luar rentang wajar | Peringatan (misal sangat besar/kecil) tetapi tetap dihitung |
| SPH di luar rentang 1–10 | Peringatan, nilai diklampirkan ke rentang |
| Hari otonomi kosong | Default 1 |
| Kombinasi output di luar kelas komersial umum | Menampilkan "pilih kelas terdekat di atas" |

---

## 9. Asumsi (Assumptions)

1. Sistem yang dihitung adalah **PLTS Off-Grid**.
2. Beban puncak (input #1) merupakan perkiraan maksimum beban yang ditarik bersamaan; pengguna bertanggung jawab atas akurasinya.
3. Energi harian adalah total kebutuhan 24 jam (sudah mencakup siang dan malam).
4. `Loss Factor` 1.3 sudah mencakup efisiensi inverter, rugi kabel, suhu, debu, dan mismatch.
5. SCC menggunakan metode **MPPT**.
6. Hasil adalah **estimasi minimum aman**, bukan spesifikasi final — konsultasi teknisi tetap disarankan untuk instalasi nyata.

---

## 10. Contoh Perhitungan Terpadu (Worked Example)

**Input:**
- Daya terpasang: 5500 W
- Energi harian: 30 kWh (30000 Wh)
- SPH: 4 jam
- Tegangan sistem: 48 V
- Jenis baterai: Lithium → DoD 80%
- Hari otonomi: 1
- WP per lembar: 550

**Output:**
1. **Inverter:** 5500 × 1.2 = 6600 W → minimal 6600 W (pilih kelas 6000–8000 W).
2. **Panel:** (30000 / 4) × 1.3 = 9750 WP → 9750 / 550 = 17.7 → **18 lembar**.
3. **Baterai:** (30000 / 48) / 0.8 × 1 = 781.25 → **782 Ah @ 48V** (≈ 37.5 kWh).
4. **SCC:** 9750 / 48 = 203.1 → **204 A** (MPPT).

---

## 11. Kriteria Penerimaan (Acceptance Criteria)

- [ ] Pengguna dapat mengisi semua field dan menekan "Hitung Kebutuhan".
- [ ] Input non-numerik ditolak pada kolom angka.
- [ ] Output 4 komponen (Inverter, Panel, Baterai, SCC) muncul sebagai kartu tanpa reload.
- [ ] Perhitungan menghasilkan nilai yang sama dengan contoh terpadu (Section 10) untuk input yang sama (toleransi pembulatan).
- [ ] Halaman responsif dan dapat digunakan nyaman di layar HP.
- [ ] Tooltip/penjelasan tersedia untuk parameter SPH, DoD, tegangan sistem, dan hari otonomi.
- [ ] Energi harian diterima dalam kWh dan dikonversi internal ke Wh.
- [ ] Setiap "Hitung Kebutuhan" menyimpan entri baru ke riwayat (IndexedDB).
- [ ] Riwayat dapat ditampilkan, dibuka kembali, dan dihapus.
- [ ] Preferensi input terakhir tersimpan dan form terisi otomatis saat halaman dibuka kembali.
- [ ] Aplikasi dapat di-build sebagai image Docker dan dijalankan dengan Caddy.
- [ ] Aplikasi dapat diakses secara remote melalui browser menggunakan IP/domain yang ditunjuk.
- [ ] Container berjalan ringan (base `caddy:alpine`) tanpa proses build tambahan.

---

## 12. Glosarium (Glossary)

| Istilah | Definisi |
|---------|----------|
| **PLTS** | Pembangkit Listrik Tenaga Surya |
| **Off-Grid** | Sistem mandiri tanpa koneksi ke jaringan PLN |
| **Inverter** | Alat mengubah DC (baterai/panel) menjadi AC untuk beban rumah |
| **WP (Watt Peak)** | Kapasitas puncak panel dalam kondisi standar (STC) |
| **Panel Surya** | Modul fotovoltaik penghasil listrik DC |
| **Baterai** | Penyimpan energi DC; kapasitas dinyatakan dalam Ah |
| **SCC / Solar Charge Controller** | Pengatur pengisian baterai dari panel |
| **MPPT** | Maximum Power Point Tracking; metode SCC yang menyesuaikan tegangan agar daya panel optimal |
| **PWM** | Pulse Width Modulation; metode SCC yang lebih sederhana |
| **SPH / Sun Peak Hours** | Jumlah jam setara penyinaran matahari puncak (1000 W/m²) per hari |
| **DoD / Depth of Discharge** | Persentase kapasitas baterai yang boleh dikuras |
| **Ah / Ampere-hour** | Satuan kapasitas baterai |
| **Safety Factor** | Faktor pengaman untuk mencegah *overload* |
| **IndexedDB** | Database lokal di browser untuk menyimpan data terstruktur (riwayat & preferensi) |

---

## 13. Rencana Pengembangan Lanjutan (Future Scope)

| Versi | Fitur |
|-------|-------|
| **V2.0** | Kalkulator beban per alat (kulkas, AC, lampu) untuk nilai Wh harian lebih akurat |
| **V3.0** | Estimasi harga komponen berdasarkan harga pasar (Rupiah) |
| **V4.0** | Export hasil ke PDF agar bisa dibagikan ke kontraktor PLTS |
| **V5.0 (potensial)** | Dukungan perhitungan SCC tipe PWM; dukungan mode On-Grid |

---

## 14. Deployment & Webserver (Docker + Caddy)

Aplikasi dikemas sebagai **container Docker** dan disajikan oleh webserver **Caddy** agar dapat dijalankan dan diakses **secara remote** (misal di VPS, Raspberry Pi, atau server rumah). Karena aplikasi **purely client-side**, server hanya bertugas **menyajikan file statis** — tidak ada logika backend. Semua perhitungan tetap berjalan di browser pengguna.

### 14.1 Alasan Memilih Caddy
- **Ringan & efisien:** image berbasis `caddy:alpine`, ukuran sangat kecil, cocok untuk sumber daya terbatas.
- **Auto HTTPS** secara default (Let's Encrypt) ketika domain diberikan.
- **Konfigurasi sederhana** (Caddyfile) — hanya beberapa baris untuk serving static file.
- **Dukungan container Docker** yang baik dan stabil.

### 14.2 Arsitektur Deployment

```
[ Browser Pengguna / Remote ]
        │  HTTPS / HTTP
        ▼
[ Container Docker: Caddy ]
   │  serves static files
   ▼
[ index.html, css/, js/ ]
   │  (perhitungan & data di sisi klien)
   ▼
[ IndexedDB lokal di browser pengguna ]
```

- Satu container Docker tunggal (Caddy) menyajikan seluruh file statis.
- Database (IndexedDB) tersimpan **di browser masing-masing pengguna**, bukan di server — sehingga tidak ada data pengguna yang disimpan di container.

### 14.3 File Deployment

| File | Isi |
|------|-----|
| `Caddyfile` | Konfigurasi Caddy: arahkan `:80` / `:443` (atau domain) ke folder file statis |
| `Dockerfile` | Multi-stage atau copy langsung dari image `caddy:alpine`; menyalin file statis & Caddyfile |
| `docker-compose.yml` | Definisi service untuk menjalankan container dengan mudah (opsional, memudahkan orkestrasi) |

### 14.4 Cara Menjalankan (Ringkas)

```bash
# Opsi A: docker compose
docker compose up -d

# Opsi B: docker run langsung
docker build -t plts-kalkulator .
docker run -d -p 8005:80 plts-kalkulator
```

Setelah berjalan, aplikasi dapat diakses melalui `http://<host>:8005/` (atau domain dengan HTTPS otomatis).

### 14.5 Catatan Konfigurasi
- **Port default:** container mendengar di port `80` (internal); dipetakan ke port eksternal **`8005`** agar tidak bentrok.
- **Domain & HTTPS:** jika pengguna memiliki domain, cukup tulis nama domain di Caddyfile dan Caddy akan mengurus sertifikat HTTPS otomatis.
- **Dockerfile ringan:** gunakan base image `caddy:alpine` dan hanya menyalin file statis + Caddyfile — tanpa dependency/build tool tambahan, karena tidak ada proses build frontend.
