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

---

## 1. Ringkasan Eksekutif (Executive Summary)

Aplikasi web **kalkulator PLTS** membantu pemilik rumah, teknisi, atau peminat energi terbarukan menghitung spesifikasi komponen **PLTS Off-Grid** (Inverter, Panel Surya, Baterai, dan Solar Charge Controller/SCC) berdasarkan kebutuhan energi harian pengguna. Studi kasus acuan: rumah berdaya 5500 VA yang menyala 24 jam penuh hanya dari tenaga surya.

Aplikasi ini **purely client-side** (tanpa backend/logika server): seluruh perhitungan dan rendering dilakukan di browser menggunakan JavaScript (HTMX v4 + Alpine.js). Pendekatan ini menjamin respons instan. Data pengguna (riwayat perhitungan & preferensi input) disimpan **lokal di browser** melalui IndexedDB. Aplikasi dikemas sebagai **container Docker** dengan webserver ringan **Caddy** agar dapat dijalankan dan diakses secara **remote**.

## 2. Tujuan Produk (Objectives)

1. Mempermudah perhitungan teknis PLTS menjadi proses sekali klik.
2. Memberikan estimasi yang akurat agar pengguna tidak salah memilih kapasitas alat (*under-sizing* maupun *over-sizing*).
3. Menyediakan antarmuka yang bersih, cepat, dan responsif tanpa *page reload*.
4. Mengedukasi pengguna melalui *tooltip*/penjelasan singkat pada setiap parameter.

## 3. Target Pengguna (Target Audience)

| Segmen | Kebutuhan |
|--------|-----------|
| Masyarakat awam yang merancang PLTS rumah | Hasil mudah dipahami, minimal istilah teknis, penjelasan tiap parameter |
| Teknisi / instalatur PLTS di lapangan | Input cepat, hasil akurat, tampilan ramah layar HP, validasi input ketat |

## 4. Ruang Lingkup (Scope)

### 4.1 In-Scope (Versi 1.0)
- Form input parameter inti (daya terpasang, energi harian, SPH, tegangan sistem, DoD).
- Perhitungan dan tampilan 4 output utama: Inverter, Panel Surya (total WP + estimasi jumlah lembar), Baterai (Ah), SCC (A).
- Validasi input, *tooltip* penjelasan, dan opsi perhitungan estimasi energi.
- Desain responsif mobile-first, berbahasa Indonesia.
- Penyimpanan lokal (IndexedDB): **riwayat perhitungan** dan **preferensi input**.
- Deployment **Docker + Caddy** agar aplikasi dapat dijalankan secara remote.

### 4.2 Out-of-Scope (Versi 1.0)
- Perhitungan beban per alat (kulkas, AC, lampu) → rencana V2.0.
- Estimasi harga komponen dalam Rupiah → rencana V3.0.
- Export hasil ke PDF → rencana V4.0.
- Dukungan PLTS **On-Grid** / *grid-tie* (fokus off-grid).
- *Backend* / penyimpanan data pengguna.

---

## 5. Fitur dan Logika Perhitungan

### 5.1 Form Input Pengguna

| # | Parameter | Satuan | Rentang / Default | Wajib | Keterangan |
|---|-----------|--------|-------------------|-------|------------|
| 1 | **Daya terpasang / beban puncak** | Watt (W) | > 0; contoh 5500 | Ya | Beban maksimum yang mungkin ditarik bersamaan. Dipakai untuk sizing inverter. |
| 2 | **Total pemakaian energi harian** | kWh | > 0; contoh 30 | Ya | Total konsumsi listrik 24 jam. Diterima dalam kWh (dikonversi ke Wh di internal). Opsi bantu: "beban rata-rata × 24 jam". |
| 3 | **Jam efektif matahari (SPH)** | jam | 1–10; default 4–5 | Ya | Lama penyinaran matahari optimal per hari. Default Indonesia 4–5 jam. |
| 4 | **Tegangan sistem** | V | 12 / 24 / 48 | Ya | Tegangan DC baterai & inverter. Saran: 48V untuk sistem > 3000W. |
| 5 | **Depth of Discharge (DoD)** | % | 20–90; default tergantung jenis baterai | Ya | Batas maksimum baterai dikuras. Default: 80% (Lithium/LiFePO4), 50% (VRLA/Aki). |
| 6 | **Hari otonomi (optional)** | hari | 1–5; default 1 | Tidak | Cadangan hari saat matahari redup / mendung. Default 1 (tanpa cadangan ekstra). |
| 7 | **Jenis baterai** | - | Lithium / VRLA | Ya (opsional) | Menentukan default DoD secara otomatis. |
| 8 | **Watt peak per lembar panel** | WP | > 0; default 550 | Tidak | Digunakan untuk menghitung estimasi jumlah lembar panel. |

> **Catatan asumsi unit:** Energi harian diterima dalam **kWh** (bukan Wh) untuk mengurangi risiko salah input angka nol; sistem mengonversi ke Wh untuk perhitungan. Ini merupakan perbaikan dari versi 1.0.0 yang mencampur Wh dan kWh.

### 5.2 Logika Perhitungan

Semua perhitungan dilakukan **di sisi klien** (JavaScript) dan menghasilkan angka yang dibulatkan ke atas (ceiling) ke nilai aman.

#### a. Kapasitas Inverter (Watt)

```
Inverter (W) = Beban Puncak (W) × Safety Factor
```

- `Safety Factor` default **1.2** (20% cadangan untuk lonjakan arus start motor/kompresor).
- **Prinsip:** Inverter di-size berdasarkan **daya puncak (W)**, bukan energi harian (Wh). Beban puncak bersumber dari input #1.
- Contoh: 5500 W × 1.2 = 6600 W → rekomendasi "minimal 6600 W, pilih kelas 6000–8000 W".

#### b. Kebutuhan Panel Surya (Watt Peak / WP)

```
Panel Total (WP) = (Energi Harian (Wh) / SPH (jam)) × Loss Factor
```

- `Loss Factor` default **1.3** (mengompensasi efisiensi inverter, rugi kabel, suhu, debu, dan mismatch modul). Rentang umum 1.25–1.3.
- **Jumlah lembar panel:** `Panel Total (WP) / WP per lembar`, dibulatkan ke atas.
- Contoh (Energi 30000 Wh, SPH 4): (30000 / 4) × 1.3 = **9750 WP** → dengan panel 550 WP ≈ **18 lembar**.

#### c. Kebutuhan Kapasitas Baterai (Ah)

```
Baterai (Ah) = (Energi Harian (Wh) / Tegangan Sistem (V)) / DoD × Hari Otonomi
```

- **Prinsip:** kapasitas terpakai (usable) baterai harus ≥ kebutuhan energi harian. Karena baterai hanya boleh dikuras sebesar DoD, kapasitas fisik dihitung dengan membagi kebutuhan dengan DoD.
- Contoh (30000 Wh, 48V, DoD 80%, otonomi 1): (30000 / 48) / 0.8 × 1 = **781.25 Ah → 782 Ah**.
- `Hari Otonomi > 1` menambah cadangan hari mendung (opsional, default 1).

#### d. Kebutuhan Solar Charge Controller (SCC) (Ampere)

```
SCC (A) = Panel Total (WP) / Tegangan Sistem (V)
```

- **Asumsi:** metode **MPPT** (Maximum Power Point Tracking), yang arus output-nya mengikuti tegangan sistem.
- Contoh: 9750 WP / 48 V = **203.125 A → 204 A**.
- **Catatan:** untuk SCC tipe **PWM**, perhitungan berbeda (berbasis arus short-circuit × jumlah string paralel); metode PWM di luar lingkup V1.0 dan akan dicatat sebagai catatan teknis.

### 5.3 Output Sistem

Setelah tombol **"Hitung Kebutuhan"**, tampil dashboard hasil berupa kartu (card):

| Output | Nilai | Keterangan tambahan |
|--------|-------|---------------------|
| Inverter | Rekomendasi kapasitas (W) | Tampil juga rentang kelas komersial yang sesuai |
| Panel Surya | Total kapasitas (WP) + estimasi jumlah lembar | Berdasarkan WP per lembar yang dipilih |
| Baterai | Kapasitas (Ah) pada tegangan sistem | Tampil juga estimasi dalam kWh |
| SCC | Kapasitas minimal (A) | Metode MPPT |

Setiap kartu menyertakan ringkasan rumus yang dipakai agar pengguna memahami asal angka (transparansi & edukasi).

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
docker run -d -p 8080:80 plts-kalkulator
```

Setelah berjalan, aplikasi dapat diakses melalui `http://<host>:8080/` (atau domain dengan HTTPS otomatis).

### 14.5 Catatan Konfigurasi
- **Port default:** container mendengar di port `80` (internal); dipetakan ke port eksternal (contoh `8080`) agar tidak bentrok.
- **Domain & HTTPS:** jika pengguna memiliki domain, cukup tulis nama domain di Caddyfile dan Caddy akan mengurus sertifikat HTTPS otomatis.
- **Dockerfile ringan:** gunakan base image `caddy:alpine` dan hanya menyalin file statis + Caddyfile — tanpa dependency/build tool tambahan, karena tidak ada proses build frontend.
