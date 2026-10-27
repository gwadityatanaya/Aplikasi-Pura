# Panduan PURA — dari nol sampai bisa dipakai

Panduan ini untuk Anda yang **bukan programmer**. Ikuti langkahnya berurutan. Tiap langkah menjelaskan **apa yang dilakukan** dan **kenapa**.

Waktu yang dibutuhkan: sekitar **60 menit** untuk pertama kali (termasuk mengatur Google dan email).

---

## Daftar isi

1. [Gambaran singkat](#1-gambaran-singkat)
2. [Siapa melakukan apa (peran)](#2-siapa-melakukan-apa-peran)
3. [Yang perlu disiapkan](#3-yang-perlu-disiapkan)
4. [Langkah 1 — Database gratis di Neon](#langkah-1--database-gratis-di-neon)
5. [Langkah 2 — Kode rahasia](#langkah-2--kode-rahasia)
6. [Langkah 3 — Email tautan masuk dengan Brevo](#langkah-3--email-tautan-masuk-dengan-brevo)
7. [Langkah 4 — Pasang aplikasi di Vercel](#langkah-4--pasang-aplikasi-di-vercel)
8. [Langkah 5 — Login Google](#langkah-5--login-google)
9. [Langkah 6 — Akun Admin Utama (sekali saja)](#langkah-6--akun-admin-utama-sekali-saja)
10. [Langkah 7 — Banjar, pura, rekening, dan pengurus](#langkah-7--banjar-pura-rekening-dan-pengurus)
11. [Alur punia sehari-hari](#alur-punia-sehari-hari)
12. [Memasang aplikasi di HP](#memasang-aplikasi-di-hp)
13. [Cadangan data mingguan](#cadangan-data-mingguan)
14. [Memulihkan data](#memulihkan-data)
15. [Menjalankan di laptop](#menjalankan-di-laptop)
16. [Memperbarui aplikasi](#memperbarui-aplikasi)
17. [Keamanan: kebiasaan baik](#keamanan-kebiasaan-baik)
18. [Masalah yang sering terjadi](#masalah-yang-sering-terjadi)

---

## 1. Gambaran singkat

PURA menggantikan siaran WhatsApp tentang kas dan punia pura. **Aplikasi ini hanya mencatat — tidak memegang atau memindahkan uang.** Umat mentransfer punia lewat m-banking langsung ke rekening pura, lalu mengunggah bukti transfer di aplikasi. Pengurus mencocokkan bukti itu dengan mutasi rekening dan menekan **Setuju**.

| Bagian | Fungsinya | Layanan (gratis) |
|---|---|---|
| **Kode aplikasi** | "Resep" aplikasinya | GitHub — repo `gwadityatanaya/Aplikasi-Pura` |
| **Database** | Tempat semua data disimpan | **Neon** |
| **Server web** | Menjalankan aplikasi di internet | **Vercel** |
| **Email** | Mengirim tautan masuk & ringkasan harian | **Brevo** |
| **Login Google** | Masuk dengan satu ketukan | **Google Cloud** |

**Tidak ada lagi kata sandi.** Semua orang masuk dengan **Google** atau **tautan email** (tautan sekali pakai yang dikirim ke email, berlaku 15 menit). Jadi tidak ada kata sandi yang bisa bocor atau terlupa.

Pengaman yang tetap berlaku:
- Admin Utama **tidak bisa** dihapus, diturunkan, atau dinonaktifkan — dijaga langsung oleh database.
- **Log Aktivitas** tidak bisa diedit atau dihapus, bahkan oleh Admin Utama.
- Transaksi yang sudah dikonfirmasi dan punia yang sudah diverifikasi **tidak bisa diubah**. Kesalahan diperbaiki dengan entri koreksi.
- Pengurus **tidak bisa** memverifikasi punia yang dikirim dari emailnya sendiri — dijaga di server **dan** di database.
- Nama umat yang memilih **ANONIM** tidak pernah dikirim ke halaman publik (yang terkirim hanya tulisan "Anonim").
- Foto bukti dan nota hanya bisa dibuka oleh pengurus pura terkait, Pengurus Banjar pengemponnya, Admin Utama, dan pengunggahnya sendiri.
- Terlalu sering gagal masuk → dikunci sementara.

---

## 2. Siapa melakukan apa (peran)

| Peran | Bisa melakukan | Diberikan oleh |
|---|---|---|
| **Admin Utama** (Anda) | Semuanya: banjar, pura, **rekening pura**, mendaftarkan/mencabut pengurus, Log Aktivitas, cadangan. | Langkah setup |
| **Pengurus Banjar** | Melihat dashboard dan memverifikasi punia di **semua pura yang diempon banjarnya**. Memverifikasi punia pura yang **belum punya pengurus**. Tidak bisa mengubah rekening atau mengatur akun. | Admin Utama |
| **Pengurus Pura** | Hanya pura yang ditugaskan: verifikasi punia, input punia manual (tunai/WhatsApp), catat pengeluaran + foto nota, laporan PDF/Excel, pengaturan tampilan untuk umat, Riwayat Audit Pura. Satu orang boleh memegang beberapa pura, dan boleh juga menjadi Pengurus Banjar. | Admin Utama |
| **Pemeriksa** | Hanya melihat (transaksi, nota, laporan, Riwayat Audit Pura). | Admin Utama |
| **Umat** | Akun sendiri: kirim punia, lihat riwayat punia sendiri, hapus akun. | Daftar sendiri (otomatis) |

Peran lama dipetakan otomatis: Ketua/Bendahara/Sekretaris → **Pengurus Pura**, Auditor → **Pemeriksa**.

Saat masuk, aplikasi mencocokkan email (huruf besar/kecil tidak berpengaruh). Email yang terdaftar sebagai pengurus langsung masuk ke **Dashboard**; selain itu menjadi **Umat**. Staf bisa berpindah antara **Dashboard** dan **Tampilan Umat** lewat tombol di atas layar.

---

## 3. Yang perlu disiapkan

- [ ] Akun **GitHub** (sudah ada; kode ada di repo `Aplikasi-Pura`).
- [ ] Email Admin Utama: `wiraaditya452@gmail.com` (akun Google).
- [ ] Laptop/komputer (lebih mudah daripada HP untuk langkah awal).
- [ ] Tempat aman untuk catatan rahasia (buku pribadi atau pengelola kata sandi).

---

## Langkah 1 — Database gratis di Neon

**Kenapa:** aplikasi butuh tempat menyimpan data yang aman dan selalu menyala.

1. Buka **https://neon.tech** → **Sign up** → **Continue with GitHub**.
2. Buat project: **Project name** `pura`, **Region** **AWS Asia Pacific (Singapore)** → **Create project**.
3. Klik **Connect**. Pastikan **Connection pooling** **ON** (alamat mengandung `-pooler`) → **Copy** → simpan sebagai **DATABASE_URL**.
4. Matikan **Connection pooling** (OFF) → salin → simpan sebagai **DATABASE_URL_UNPOOLED**.

> ⚠️ Alamat database berisi kata sandi database. **Jangan dibagikan.**

---

## Langkah 2 — Kode rahasia

Buat **dua** kode acak (masing-masing 24–32 huruf dan angka), misalnya dengan pengelola kata sandi. **Jangan pakai contoh ini:** `k7Rq2mXv9TzL4pWn8sBd3HcY6jFa`.

| Simpan dengan judul | Gunanya |
|---|---|
| **SETUP_TOKEN** | Membuka halaman `/setup` untuk membuat Admin Utama (sekali saja). |
| **CRON_SECRET** | Kunci untuk email ringkasan harian ke pengurus. |

---

## Langkah 3 — Email tautan masuk dengan Brevo

**Kenapa:** umat dan pengurus yang tidak memakai Google masuk lewat tautan yang dikirim ke email. Aplikasi juga mengirim **satu email ringkasan per hari** ke pengurus jika ada punia menunggu verifikasi (bisa dimatikan masing-masing di **Pengaturan → Notifikasi**).

**Batas gratis Brevo:** 300 email per hari. Untuk satu banjar ini lebih dari cukup: tiap orang biasanya hanya butuh tautan masuk sesekali (sesi masuk bertahan lama), dan ringkasan harian maksimal satu per pengurus. Email yang dikirim layanan gratis memuat sedikit logo Brevo dan kadang masuk folder **Spam/Promosi** — beri tahu umat untuk memeriksa folder itu.

1. Buka **https://www.brevo.com** → **Sign up free**. Isi data, verifikasi email Anda.
2. Daftarkan pengirim: menu **Senders, Domains & Dedicated IPs → Senders → Add a sender**. Isi nama `PURA` dan email Anda (mis. `wiraaditya452@gmail.com`), lalu klik tautan verifikasi yang dikirim ke email tersebut.
   - Catatan: pengirim berupa alamat Gmail bisa lebih sering masuk Spam. Jika kelak punya domain sendiri, daftarkan domain di menu **Domains** agar lebih terpercaya.
3. Ambil data SMTP: menu **SMTP & API → tab SMTP**. Catat:
   - **SMTP server** → `smtp-relay.brevo.com`, **Port** → `587`
   - **Login** → simpan sebagai **SMTP_USER**
   - Klik **Generate a new SMTP key** → salin → simpan sebagai **SMTP_PASS** (hanya ditampilkan sekali).

---

## Langkah 4 — Pasang aplikasi di Vercel

1. Buka **https://vercel.com** → **Sign Up** → paket **Hobby** (gratis) → **Continue with GitHub**.
2. **Add New… → Project** → pilih repo **Aplikasi-Pura** → **Import**.
3. Buka **Environment Variables** dan tambahkan:

   | Key (nama) | Value (isi) |
   |---|---|
   | `DATABASE_URL` | dari Langkah 1 nomor 3 (yang ada `-pooler`) |
   | `DATABASE_URL_UNPOOLED` | dari Langkah 1 nomor 4 |
   | `ADMIN_EMAIL` | `wiraaditya452@gmail.com` |
   | `SETUP_TOKEN` | dari Langkah 2 |
   | `CRON_SECRET` | dari Langkah 2 |
   | `APP_TIMEZONE` | `Asia/Makassar` (WITA). `Asia/Jakarta` untuk WIB. |
   | `SMTP_HOST` | `smtp-relay.brevo.com` |
   | `SMTP_PORT` | `587` |
   | `SMTP_USER` | dari Langkah 3 |
   | `SMTP_PASS` | dari Langkah 3 |
   | `EMAIL_FROM` | `PURA <email-pengirim-yang-sudah-diverifikasi>` |
   | `UMAT_REGISTRATION` | `true` |

4. Klik **Deploy** dan tunggu 2–4 menit. Tabel database dibuat otomatis.
5. Catat alamat aplikasi, mis. `https://aplikasi-pura.vercel.app`. Tambahkan variabel **`APP_URL`** berisi alamat itu (tanpa `/` di akhir), lalu **Deployments → ⋯ → Redeploy**.

**Cek cepat:** buka `https://ALAMAT-ANDA/api/health` → harus ada `"database":"terhubung"`.

Email ringkasan harian berjalan otomatis setiap pagi (pukul 09.00 WITA) lewat **Vercel Cron** yang sudah diatur di `vercel.json`. Paket gratis Vercel mengizinkan jadwal sekali sehari.

---

## Langkah 5 — Login Google

**Kenapa:** kebanyakan umat sudah punya akun Google di HP-nya, jadi masuk cukup satu ketukan.

1. Buka **https://console.cloud.google.com** dengan akun Google Anda → buat project baru bernama `PURA`.
2. Menu **APIs & Services → OAuth consent screen** (di tampilan baru: **Google Auth Platform → Branding**):
   - **User type / Audience:** **External**.
   - Isi nama aplikasi `PURA`, email dukungan, dan email kontak Anda.
   - Bagian **Scopes / Data access:** cukup `openid`, `email`, `profile` (bawaan). Tidak perlu yang lain.
   - Bagian **Audience:** klik **Publish app** agar semua orang bisa masuk (bukan hanya "test users"). Karena hanya memakai nama & email, aplikasi tidak perlu proses verifikasi panjang dari Google.
3. Menu **Credentials → Create credentials → OAuth client ID** (atau **Clients → Create client**):
   - **Application type:** **Web application**.
   - **Authorized redirect URIs:** tambahkan `https://ALAMAT-ANDA/api/auth/google/callback` (ganti dengan alamat dari Langkah 4). Untuk mencoba di laptop, tambahkan juga `http://localhost:3000/api/auth/google/callback`.
   - Klik **Create**, lalu salin **Client ID** dan **Client secret**.
4. Di Vercel tambahkan `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET`, lalu **Redeploy**.

Jika alamat aplikasi berubah (mis. memakai domain sendiri), ubah juga **Authorized redirect URIs** di Google.

---

## Langkah 6 — Akun Admin Utama (sekali saja)

1. Buka `https://ALAMAT-ANDA/setup`.
2. Isi **Kode setup** (SETUP_TOKEN), **Nama lengkap**, dan **Email** `wiraaditya452@gmail.com` (harus sama dengan `ADMIN_EMAIL`).
3. Klik **Buat Admin Utama**. Anda langsung masuk ke **Back Office**.

Setelah itu **halaman `/setup` terkunci selamanya**. Berikutnya Anda masuk dengan **Masuk dengan Google** (akun `wiraaditya452@gmail.com`) atau tautan email. *(Disarankan)* hapus `SETUP_TOKEN` dari Vercel lalu Redeploy.

---

## Langkah 7 — Banjar, pura, rekening, dan pengurus

Semua dilakukan di **Back Office** (menu kiri, atau **Lainnya** di HP). Semua perubahan tercatat di **Log Aktivitas**.

1. **Tambah banjar** — tab **Banjar → Tambah banjar**.
2. **Tambah pura** — tab **Pura → Tambah pura**. Centang satu atau lebih **banjar pengempon** (satu pura boleh diempon beberapa banjar).
3. **Isi rekening pura** — pada kartu pura tekan **Rekening**: nama bank, nomor rekening, dan **nama pemilik rekening** (ditampilkan ke umat agar mereka bisa mencocokkan di m-banking). Hanya Admin Utama yang bisa mengubahnya. **Umat baru bisa berpunia ke pura yang rekeningnya sudah diisi.**
4. **Daftarkan pengurus pura** — pada kartu pura tekan **Pengurus** → ketik email orang tersebut → pilih **Pengurus Pura** atau **Pemeriksa**. Orang itu cukup membuka aplikasi dan masuk dengan Google/tautan email memakai alamat itu — tidak ada undangan atau kata sandi.
5. **Daftarkan Pengurus Banjar** — tab **Banjar → Pengurus Banjar** → ketik email.
6. **Mencabut/menonaktifkan** — tekan ikon hapus di daftar pengurus untuk mencabut peran, atau tab **Akun → Nonaktifkan** untuk menutup akunnya sama sekali. Aksesnya **langsung** hilang di semua perangkat.

Tanda yang perlu diperhatikan di Back Office:
- **"Pengurus pura belum terdaftar"** — punia pura ini diverifikasi oleh Pengurus Banjar; umat juga melihat label ini.
- **"Hanya 1 pengurus"** — sebaiknya tambah pengurus kedua, agar punia yang dikirim pengurus itu sendiri bisa diverifikasi orang lain.
- **"Rekening belum diisi"** — umat belum bisa berpunia lewat aplikasi.

Pengurus pura lalu mengisi sendiri di **Pengaturan**: deskripsi & kontak pura, **saldo awal** kas (agar posisi kas di halaman umat benar), dan **Tampilan untuk umat** (tampilkan saldo, transaksi terakhir, daftar punia, berapa transaksi terakhir 3–5). Semua bawaannya **terbuka**.

---

## Alur punia sehari-hari

**Umat:**
1. Buka halaman pura → **Berpunia** → salin nomor rekening → transfer lewat m-banking.
2. Isi nominal, tanggal transfer, unggah foto/tangkapan layar bukti, pilih **TAMPIL** atau **ANONIM**, tujuan (umum / odalan / pembangunan / lainnya), dan kegiatan jika ada → **Kirim punia**.
3. Pantau di **Punia Saya → Riwayat punia**. Jika ditolak, alasannya terlihat dan bisa **Perbaiki & kirim ulang**.

**Pengurus:**
1. Lencana **"N punia menunggu"** muncul di menu **Punia**. Buka **Verifikasi Punia**.
2. Cocokkan bukti dengan mutasi rekening → **Setuju**, atau **Tolak** dengan alasan. Bisa pilih beberapa sekaligus lalu **Setujui terpilih**.
3. Tanda **"Kemungkinan dobel"** muncul jika ada punia lain dengan nominal dan tanggal sama. Bukti yang **persis sama** atau nominal + tanggal + nomor referensi yang sama otomatis ditolak sistem.
4. *(Opsional, hemat waktu)* **Cocokkan mutasi (CSV):** unduh mutasi rekening dari internet banking dalam format CSV, lalu unggah di halaman Verifikasi Punia. Aplikasi menandai punia yang nominalnya sama dan tanggalnya selisih paling lama 2 hari, lalu Anda bisa menyetujui semuanya sekaligus. File mutasi hanya dibaca di perangkat Anda dan tidak disimpan. Tetap periksa nama pengirimnya.
5. Punia tunai atau lewat WhatsApp: **Input punia manual** — langsung tercatat terverifikasi (kecuali email donaturnya adalah email Anda sendiri; itu harus disetujui pengurus lain).
6. Pengeluaran: **+ → Catat Pengeluaran** dengan kategori, catatan, dan foto nota.
7. Untuk paruman: **Laporan** → pilih jenis (mis. **Laporan punia** atau **Ringkasan keuangan**) dan periode → unduh **PDF** atau **Excel**.

---

## Memasang aplikasi di HP

Di aplikasi buka menu **Pasang di HP** (`/pasang`) — ada panduan bergambar untuk **Android (Chrome)** dan **iPhone (Safari)**. Ringkasnya:
- **Android:** Chrome → **⋮** → **Instal aplikasi** / **Tambahkan ke layar utama**.
- **iPhone:** Safari → **Bagikan** (kotak panah ke atas) → **Tambah ke Layar Utama** → **Tambah**.

Data keuangan sengaja **tidak disimpan di HP**; aplikasi butuh internet untuk menampilkan data. Tampilan aplikasi disimpan di HP agar ringan untuk HP sederhana dan sinyal lemah, dan foto bukti otomatis diperkecil sebelum dikirim.

---

## Cadangan data mingguan

Buat cadangan **setiap minggu** (mis. setiap Minggu sore) dan **sebelum upacara besar**.

### Cara 1 — Dari aplikasi (disarankan)
1. Masuk sebagai Admin Utama → **Back Office → Cadangan data → Unduh cadangan (.json)**.
2. Simpan di **Google Drive pribadi** atau flashdisk dengan nama jelas, mis. `cadangan-pura-2026-11-01.json`. Simpan setidaknya 4 cadangan terakhir.

File ini berisi data keuangan **dan data pribadi umat** (nama, email), tanpa foto. **Jangan dibagikan.**

### Cara 2 — Riwayat otomatis Neon
Neon menyimpan riwayat perubahan **6 jam terakhir** (paket gratis). Gunanya membatalkan kesalahan yang baru saja terjadi. Karena hanya 6 jam, **Cara 1 tetap wajib**.

### Cara 3 — Cadangan lengkap dengan foto (butuh laptop)
Ikuti [Menjalankan di laptop](#menjalankan-di-laptop) sampai langkah 4 dengan alamat database **utama**, lalu `npm run backup`. File muncul di folder `cadangan/`.

---

## Memulihkan data

**Kesalahan dalam 6 jam terakhir:** console.neon.tech → project **pura** → **Restore** → pilih waktu sebelum kesalahan.

**Dari file cadangan (butuh laptop):**
1. Di Neon buat database/project **baru**, salin alamatnya, isi ke `DATABASE_URL` di file `.env`.
2. Jalankan:
   ```
   npm run db:migrate
   npm run restore -- cadangan/nama-file-cadangan.json
   ```
3. Di Vercel ganti `DATABASE_URL` dan `DATABASE_URL_UNPOOLED` ke database baru → **Redeploy**.

Pemulihan hanya mau berjalan ke database **kosong**, supaya data lama tidak tertimpa tanpa sengaja.

---

## Menjalankan di laptop

Untuk mencoba perubahan, data contoh, cadangan lengkap, atau pemulihan.

1. Pasang **Node.js 20 LTS** dari https://nodejs.org.
2. Unduh kode: GitHub → repo **Aplikasi-Pura** → **Code → Download ZIP** (lalu ekstrak), atau `git clone https://github.com/gwadityatanaya/Aplikasi-Pura.git`.
3. Buka Terminal/Command Prompt di folder itu → `npm install`.
4. Salin `.env.example` menjadi `.env`, lalu isi:
   - `DATABASE_URL` — **gunakan database terpisah untuk percobaan**: di Neon **Branches → Create branch** `percobaan`, salin alamatnya. Data sungguhan tidak tersentuh.
   - `ADMIN_EMAIL`, `SETUP_TOKEN`, `APP_TIMEZONE` seperti di Vercel.
   - `SMTP_HOST` boleh **dikosongkan**: di laptop, tautan masuk akan **langsung tampil di layar** sehingga tidak perlu email.
   - `GOOGLE_CLIENT_ID/SECRET` opsional (perlu redirect URI `http://localhost:3000/...` di Google).
5. Jalankan:
   ```
   npm run db:migrate
   npm run dev
   ```
6. Buka **http://localhost:3000** → `/setup` untuk akun Admin Utama pertama.

**Data contoh (fiktif)** — hanya untuk database percobaan yang **kosong**:
```
npm run db:seed-demo -- --ya
```
Isinya: 2 banjar, 6 pura (satu diempon dua banjar, satu tanpa pengurus), Pengurus Banjar `ketut.banjar@contoh.id` dan `gede.banjar@contoh.id`, pengurus pura (`made@`, `komang@`, `wayan@`, `putu@`, `nengah@`, `kadek.taman@contoh.id`), dan umat (`ayu@`, `nyoman@`, `kadek@contoh.id`). Masuk dengan tautan email; di laptop tautannya tampil di layar.

**Tes otomatis** — butuh database tes terpisah yang namanya mengandung `test` atau `e2e` (isinya dihapus setiap kali tes jalan):
```
E2E_DATABASE_URL="postgres://.../pura_e2e" npm run test:e2e
```

---

## Memperbarui aplikasi

Setiap perubahan yang di-*push* ke GitHub (cabang `main`) otomatis dibangun ulang oleh Vercel, termasuk pembaruan tabel database. Buat **cadangan** dulu sebelum pembaruan besar.

---

## Keamanan: kebiasaan baik

- 🔒 Jangan membagikan Environment Variables, file `.env`, atau file cadangan.
- 🔐 Aktifkan **verifikasi 2 langkah** di akun Google `wiraaditya452@gmail.com` — akun ini sekarang adalah kunci Admin Utama.
- 👤 Satu orang, satu akun. Jangan memakai akun bersama.
- 🚪 Segera cabut peran pengurus yang sudah tidak menjabat.
- 👥 Usahakan tiap pura punya **minimal 2 pengurus**.
- 👀 Sesekali periksa **Log Aktivitas**, terutama "Akses ditolak" atau "Masuk gagal" yang berulang.
- 💾 Cadangan setiap minggu.
- 📱 HP hilang: **Pengaturan → Keamanan → Keluar dari semua perangkat** dari perangkat lain.

---

## Masalah yang sering terjadi

**Email tautan masuk tidak datang**
→ Periksa folder **Spam/Promosi**. Pastikan pengirim di `EMAIL_FROM` sudah diverifikasi di Brevo dan `SMTP_USER/SMTP_PASS` benar. Cek kuota harian Brevo (300/hari). Sementara itu, masuk dengan Google.

**"Masuk dengan Google belum diatur"**
→ `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` belum diisi di Vercel, atau belum Redeploy.

**Google menampilkan "redirect_uri_mismatch"**
→ Alamat di **Authorized redirect URIs** harus persis `https://ALAMAT-ANDA/api/auth/google/callback` (https, tanpa `/` di akhir).

**Google menampilkan "access blocked / app not verified" untuk umat**
→ Aplikasi masih mode **Testing**. Buka Google Cloud → **Audience → Publish app**.

**Pengurus masuk tetapi hanya melihat Tampilan Umat**
→ Emailnya belum didaftarkan di Back Office, atau berbeda dengan email Google yang dipakai. Daftarkan email yang benar.

**"Terlalu banyak percobaan"**
→ Tunggu 15 menit lalu coba lagi.

**Admin Utama tidak bisa masuk (akun Google hilang / email tidak datang)** — skrip darurat
→ Dari laptop yang file `.env`-nya berisi alamat database **utama** dan `APP_URL`, jalankan:
```
npm run admin:reset
```
Perintah ini menampilkan **tautan masuk sekali pakai (berlaku 1 jam)** untuk Admin Utama. Pembuatannya tercatat di Log Aktivitas. Hanya orang yang memegang alamat database yang bisa menjalankannya.

**"Setup belum dikonfigurasi" / "Email ini tidak terdaftar sebagai email Admin Utama"**
→ Isi `SETUP_TOKEN` (min. 16 karakter) dan `ADMIN_EMAIL` di Vercel, lalu Redeploy. Email yang diketik harus sama dengan `ADMIN_EMAIL`.

**`/api/health` tidak menampilkan "terhubung"**
→ Alamat database salah salin. Salin ulang dari tombol **Connect** di Neon.

**Umat tidak bisa berpunia ke suatu pura**
→ Rekening pura belum diisi Admin Utama (**Back Office → Pura → Rekening**).

**Ingin menutup pendaftaran umat baru sementara**
→ Ubah `UMAT_REGISTRATION` menjadi `false` di Vercel lalu Redeploy. Pengurus yang sudah terdaftar tetap bisa masuk.
