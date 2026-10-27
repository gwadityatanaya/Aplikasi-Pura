# Panduan PURA — dari nol sampai bisa dipakai

Panduan ini untuk Anda yang **bukan programmer**. Ikuti langkahnya berurutan. Tiap langkah menjelaskan **apa yang dilakukan** dan **kenapa**.

Waktu yang dibutuhkan: sekitar **30–45 menit** untuk pertama kali.

---

## Daftar isi

1. [Gambaran singkat](#1-gambaran-singkat)
2. [Yang perlu disiapkan](#2-yang-perlu-disiapkan)
3. [Langkah 1 — Membuat database gratis di Neon](#langkah-1--membuat-database-gratis-di-neon)
4. [Langkah 2 — Membuat kode setup rahasia](#langkah-2--membuat-kode-setup-rahasia)
5. [Langkah 3 — Memasang aplikasi di Vercel](#langkah-3--memasang-aplikasi-di-vercel)
6. [Langkah 4 — Membuat akun Admin Utama (sekali saja)](#langkah-4--membuat-akun-admin-utama-sekali-saja)
7. [Langkah 5 — Menyelesaikan pengaturan](#langkah-5--menyelesaikan-pengaturan)
8. [Langkah 6 — Menambahkan pura dan pengurus](#langkah-6--menambahkan-pura-dan-pengurus)
9. [Memasang aplikasi di HP](#memasang-aplikasi-di-hp)
10. [Mencadangkan (backup) data](#mencadangkan-backup-data)
11. [Memulihkan data](#memulihkan-data)
12. [Menjalankan di komputer sendiri (opsional)](#menjalankan-di-komputer-sendiri-opsional)
13. [Memperbarui aplikasi](#memperbarui-aplikasi)
14. [Keamanan: kebiasaan baik](#keamanan-kebiasaan-baik)
15. [Masalah yang sering terjadi](#masalah-yang-sering-terjadi)

---

## 1. Gambaran singkat

Aplikasi PURA terdiri dari tiga bagian:

| Bagian | Fungsinya | Layanan (gratis) |
|---|---|---|
| **Kode aplikasi** | "Resep" aplikasinya | GitHub — repo `gwadityatanaya/Aplikasi-Pura` |
| **Database** | Tempat semua data disimpan (transaksi, donasi, pengguna) | **Neon** |
| **Server web** | Menjalankan aplikasi agar bisa dibuka di internet | **Vercel** |

Cara kerjanya: Anda membuka alamat aplikasi (mis. `https://pura-anda.vercel.app`). Vercel menjalankan aplikasinya, lalu aplikasi menyimpan dan membaca data dari database Neon.

### Apa yang berubah dari versi prototipe?

- **Data tersimpan di database sungguhan**, bukan lagi di peramban. Semua HP dan laptop melihat data yang sama.
- **Login aman.** Kata sandi disimpan dalam bentuk *hash* (diacak satu arah), jadi tidak ada orang yang bisa membacanya, termasuk Anda dan programmer. Setelah 5 kali salah kata sandi, login dikunci 15 menit.
- **Admin Utama** (akun Anda) dapat:
  - melihat semua data dan laporan dari semua pura,
  - menambah, menonaktifkan, dan mengatur peran pengguna lain.

  Akun Admin Utama **tidak bisa dihapus, diturunkan, atau dinonaktifkan** oleh siapa pun. Aturan ini dijaga langsung oleh database.
- **Log Aktivitas** (khusus Admin Utama) mencatat siapa yang login, siapa yang mencatat, mengubah, atau menghapus transaksi, dan kapan. Log ini **tidak bisa diedit atau dihapus**, bahkan oleh Admin Utama.
- **Bisa dipasang di HP** seperti aplikasi biasa (PWA).
- **Mode demo** tetap ada untuk presentasi. Mode ini memakai data contoh dan tidak menyentuh data sungguhan.

> **Tentang "menghapus transaksi":** demi kejujuran pembukuan, transaksi yang sudah **dikonfirmasi** tidak bisa dihapus atau diubah. Kesalahan diperbaiki dengan **entri koreksi** (pembatalan). Yang bisa dihapus hanya **draf**. Semua tindakan ini tercatat di Log Aktivitas.

---

## 2. Yang perlu disiapkan

- [ ] **Akun GitHub.** Sudah ada, dan kode sudah tersimpan di repo `Aplikasi-Pura`.
- [ ] **Email Anda:** `wiraaditya452@gmail.com`. Email ini akan menjadi akun Admin Utama.
- [ ] Sekitar 30 menit tanpa gangguan, dan sebuah laptop/komputer (lebih mudah daripada HP untuk langkah awal).
- [ ] Sebuah tempat aman untuk menyimpan catatan rahasia, misalnya buku catatan pribadi atau pengelola kata sandi.

Anda **tidak perlu** memasang program apa pun di komputer untuk Langkah 1–6.

---

## Langkah 1 — Membuat database gratis di Neon

**Kenapa:** aplikasi butuh tempat menyimpan data yang aman dan selalu menyala.

1. Buka **https://neon.tech** lalu klik **Sign up**. Pilih **Continue with GitHub** supaya tidak perlu membuat kata sandi baru.
2. Saat diminta membuat project:
   - **Project name:** `pura`
   - **Region:** pilih **AWS Asia Pacific (Singapore)** — paling dekat dengan Indonesia, jadi aplikasi lebih cepat.
   - Pilihan lain biarkan seperti bawaan, lalu klik **Create project**.
3. Di halaman project, klik tombol **Connect**. Akan muncul tulisan panjang yang diawali `postgresql://…`. Inilah **alamat database**.
   - Pastikan pilihan **Connection pooling** dalam keadaan **menyala (ON)**. Alamatnya akan mengandung kata `-pooler`.
   - Klik **Copy**, lalu simpan di catatan rahasia Anda dengan judul **DATABASE_URL**.
4. Matikan pilihan **Connection pooling** (OFF). Alamatnya berubah (kata `-pooler` hilang). Salin juga dan simpan dengan judul **DATABASE_URL_UNPOOLED**.

> ⚠️ Alamat database berisi kata sandi database. **Jangan dibagikan** ke grup WhatsApp atau ke siapa pun.

---

## Langkah 2 — Membuat kode setup rahasia

**Kenapa:** akun Admin Utama dibuat lewat halaman khusus `/setup`. Supaya orang asing tidak bisa memakainya duluan, halaman itu meminta **kode rahasia** yang hanya Anda yang tahu.

Buat kode berisi **minimal 24 huruf dan angka acak**. Contoh bentuknya (**jangan pakai contoh ini**):

```
k7Rq2mXv9TzL4pWn8sBd3HcY6jFa
```

Cara mudah: buka pengelola kata sandi di HP/peramban dan buat kata sandi acak sepanjang 24–32 karakter.

Simpan kode ini di catatan rahasia dengan judul **SETUP_TOKEN**.

---

## Langkah 3 — Memasang aplikasi di Vercel

**Kenapa:** Vercel menjalankan aplikasi agar bisa dibuka dari mana saja lewat internet.

1. Buka **https://vercel.com** → **Sign Up** → pilih paket **Hobby** (gratis) → **Continue with GitHub**.
2. Klik **Add New… → Project**.
3. Cari repo **Aplikasi-Pura**, lalu klik **Import**.
   - Jika repo tidak muncul, klik **Adjust GitHub App Permissions** dan izinkan Vercel mengakses repo tersebut.
4. Buka bagian **Environment Variables**. Ini adalah "pengaturan rahasia" aplikasi. Tambahkan satu per satu (kolom **Key** = nama, kolom **Value** = isi):

   | Key (nama) | Value (isi) |
   |---|---|
   | `DATABASE_URL` | alamat dari Langkah 1 nomor 3 (yang ada `-pooler`) |
   | `DATABASE_URL_UNPOOLED` | alamat dari Langkah 1 nomor 4 |
   | `ADMIN_EMAIL` | `wiraaditya452@gmail.com` |
   | `SETUP_TOKEN` | kode dari Langkah 2 |
   | `ALLOW_REGISTRATION` | `false` |
   | `APP_TIMEZONE` | `Asia/Makassar` (WITA). Gunakan `Asia/Jakarta` untuk WIB. |

5. Klik **Deploy**. Tunggu 2–4 menit. Pada proses ini Vercel juga **membuat tabel-tabel di database secara otomatis**.
6. Jika berhasil, muncul tulisan **Congratulations!** beserta alamat aplikasi Anda, misalnya `https://aplikasi-pura.vercel.app`. Catat alamat ini.

**Cek cepat:** buka `https://ALAMAT-ANDA/api/health`. Jika muncul `"database":"terhubung"`, berarti aplikasi sudah tersambung ke database. 🎉

---

## Langkah 4 — Membuat akun Admin Utama (sekali saja)

1. Buka `https://ALAMAT-ANDA/setup`.
2. Isi formulirnya:
   - **Kode setup:** kode dari Langkah 2.
   - **Nama lengkap:** nama Anda.
   - **Email:** `wiraaditya452@gmail.com`. Harus sama persis dengan `ADMIN_EMAIL`.
   - **Kata sandi:** minimal 10 karakter, berisi huruf dan angka. Buat yang **belum pernah Anda pakai** di tempat lain.
3. Klik **Buat Admin Utama**.

Setelah berhasil, **halaman `/setup` terkunci selamanya**. Tidak ada orang lain yang bisa membuat Admin Utama kedua, meskipun mengetahui kode setup.

> 💡 Simpan kata sandi Admin Utama di tempat aman. Jika lupa, lihat [Masalah yang sering terjadi](#masalah-yang-sering-terjadi).

---

## Langkah 5 — Menyelesaikan pengaturan

1. Di Vercel, buka project Anda → **Settings → Environment Variables**.
2. Tambahkan `APP_URL` dengan isi alamat aplikasi Anda, misalnya `https://aplikasi-pura.vercel.app` (tanpa garis miring `/` di akhir). Alamat ini dipakai untuk membuat tautan aktivasi pengurus.
3. *(Disarankan)* Hapus `SETUP_TOKEN`. Kode ini sudah tidak dibutuhkan.
4. Buka tab **Deployments**, klik tanda **⋯** pada deployment teratas → **Redeploy**. Langkah ini membuat perubahan pengaturan mulai berlaku.

---

## Langkah 6 — Menambahkan pura dan pengurus

### Membuat pura

Setelah setup, Anda langsung diarahkan untuk mengisi data pura pertama: nama, lokasi, dan kontak. Pura yang dibuat Admin Utama langsung aktif dan tampil di halaman publik.

Pura berikutnya ditambahkan lewat: ketuk nama pura di menu kiri (atau menu **Lainnya** di HP) → **Daftarkan pura lain**.

### Menambahkan pengurus (Ketua, Bendahara, Sekretaris, Auditor)

1. Buka **Panel Admin Utama → Pengguna → Tambah pengguna**.
2. Isi nama, email, pura, dan perannya.
3. Aplikasi membuat **tautan aktivasi**. Klik **Kirim via WhatsApp** dan kirim ke orang tersebut secara pribadi, **bukan ke grup**.
4. Orang itu membuka tautan, membuat kata sandinya sendiri, lalu langsung masuk.
   - Tautan berlaku **72 jam** dan hanya bisa dipakai **sekali**.

Ketua pura juga bisa menambah pengurus untuk puranya sendiri lewat menu **Pengurus & Peran**.

### Hak tiap peran

| Peran | Bisa melakukan |
|---|---|
| **Admin Utama** | Semuanya, di semua pura. Termasuk Log Aktivitas, kelola pengguna, dan cadangan data. |
| **Ketua Pengempon** | Mencatat & menyetujui transaksi, mengelola donasi & campaign, mempublikasikan laporan, mengelola pengurus pura. |
| **Bendahara** | Mencatat transaksi, memverifikasi donasi, membuat campaign dan laporan. |
| **Sekretaris** | Melihat data dan membuat **draf** transaksi (perlu dikonfirmasi Ketua/Bendahara). |
| **Pemeriksa / Auditor** | Hanya melihat: transaksi, nota, dan Riwayat Audit pura. |

### Jika pengurus berhenti atau ada masalah

**Panel Admin Utama → Pengguna →** pilih orangnya:

- **Nonaktifkan:** orang itu langsung dikeluarkan dari semua perangkat dan tidak bisa masuk lagi. Catatan yang pernah dibuatnya tetap tersimpan.
- **Atur peran:** ubah atau cabut perannya di tiap pura.
- **Atur ulang sandi:** buat tautan baru jika ia lupa kata sandi. Jika pengurus menekan **Lupa kata sandi**, permintaannya muncul di bagian atas Panel Admin Utama.

---

## Memasang aplikasi di HP

**Android (Chrome):**
1. Buka alamat aplikasi di Chrome.
2. Ketuk menu **⋮** (kanan atas) → **Instal aplikasi** atau **Tambahkan ke layar utama**.

**iPhone (Safari):**
1. Buka alamat aplikasi di **Safari** (bukan Chrome).
2. Ketuk tombol **Bagikan** (kotak dengan panah ke atas) → **Tambah ke Layar Utama** → **Tambah**.

Ikon PURA akan muncul di layar HP. Jika internet putus, aplikasi menampilkan pesan "Tidak ada koneksi". Data keuangan sengaja **tidak disimpan di HP** demi keamanan, jadi aplikasi butuh internet untuk menampilkan data.

Tombol **Pasang aplikasi** juga tersedia di **Pengaturan → Tampilan**.

---

## Mencadangkan (backup) data

Lakukan cadangan **rutin** — misalnya setiap awal bulan, dan sebelum upacara besar seperti Piodalan.

### Cara 1 — Dari aplikasi (paling mudah, disarankan)

1. Masuk sebagai Admin Utama → **Panel Admin Utama → Cadangan data**.
2. Klik **Unduh cadangan (.json)**.
3. Simpan file tersebut di **Google Drive pribadi** atau flashdisk. Beri nama yang jelas, misalnya `cadangan-pura-2026-11.json`.

Catatan:
- File ini **tidak berisi foto nota**, supaya ukurannya kecil. Untuk cadangan beserta foto, gunakan Cara 3.
- File berisi data keuangan dan kata sandi dalam bentuk hash. **Jangan dibagikan.**

### Cara 2 — Riwayat otomatis Neon

Neon otomatis menyimpan riwayat perubahan database. Pada paket **gratis**, riwayat ini hanya mencakup **6 jam terakhir**. Gunanya untuk membatalkan kesalahan yang **baru saja** terjadi (misalnya baru 1 jam yang lalu). Cara pakainya ada di [Memulihkan data](#memulihkan-data).

Karena hanya 6 jam, **Cara 1 tetap wajib dilakukan rutin.**

### Cara 3 — Cadangan lengkap dengan foto (butuh komputer)

Ikuti dulu [Menjalankan di komputer sendiri](#menjalankan-di-komputer-sendiri-opsional) sampai langkah 4. Isi `.env` dengan alamat database **utama**, lalu jalankan:

```
npm run backup
```

File cadangan muncul di folder `cadangan/`.

---

## Memulihkan data

### Kesalahan dalam 6 jam terakhir (paling mudah)

1. Buka **console.neon.tech** → project **pura** → menu **Restore** (kadang bernama *Instant restore* atau *Backup & restore*).
2. Pilih waktu **sebelum** kesalahan terjadi, lalu ikuti petunjuk di layar.

### Dari file cadangan (butuh komputer)

1. Di Neon, buat **database baru** (atau project baru), lalu salin alamatnya.
2. Di komputer, isi `DATABASE_URL` pada file `.env` dengan alamat database **baru** tersebut.
3. Jalankan:
   ```
   npm run db:migrate
   npm run restore -- cadangan/nama-file-cadangan.json
   ```
4. Di Vercel, ganti `DATABASE_URL` dan `DATABASE_URL_UNPOOLED` ke database baru, lalu **Redeploy**.

Pemulihan hanya mau berjalan ke database yang **masih kosong**. Ini sengaja, supaya data lama tidak tertimpa tanpa sengaja.

> Jika ragu, mintalah bantuan orang yang paham komputer dan tunjukkan bagian panduan ini. Jangan pernah memberikan file `.env` atau file cadangan kepada orang yang tidak Anda percayai.

---

## Menjalankan di komputer sendiri (opsional)

Hanya perlu jika Anda ingin mencoba perubahan, membuat cadangan lengkap, atau memulihkan data.

1. Pasang **Node.js versi 20 LTS** dari https://nodejs.org (pilih tombol **LTS**).
2. Unduh kode: di GitHub, buka repo **Aplikasi-Pura** → tombol hijau **Code** → **Download ZIP**, lalu ekstrak. Atau, jika memakai git:
   ```
   git clone https://github.com/gwadityatanaya/Aplikasi-Pura.git
   ```
3. Buka **Terminal** (Mac) atau **Command Prompt** (Windows) di folder tersebut, lalu jalankan:
   ```
   npm install
   ```
4. Salin file `.env.example` menjadi `.env`, lalu isi nilainya (lihat penjelasan di dalam file).
   - **Saran penting:** untuk percobaan, gunakan database **terpisah**, bukan database utama. Di Neon: **Branches → Create branch**, beri nama `percobaan`, lalu salin alamatnya. Dengan begitu data sungguhan tidak tersentuh.
5. Siapkan tabel, lalu jalankan aplikasi:
   ```
   npm run db:migrate
   npm run dev
   ```
6. Buka **http://localhost:3000** di peramban.

---

## Memperbarui aplikasi

Setiap kali ada perubahan kode yang di-*push* ke GitHub (cabang `main`), Vercel **otomatis** membangun ulang aplikasinya. Database juga ikut diperbarui jika ada tabel baru. Anda tidak perlu melakukan apa-apa.

Untuk berjaga-jaga, buat **cadangan data** (Cara 1) sebelum pembaruan besar.

---

## Keamanan: kebiasaan baik

- 🔒 **Jangan pernah** membagikan isi Environment Variables, file `.env`, atau file cadangan.
- 🔒 Gunakan kata sandi yang berbeda untuk PURA, email, dan akun lain.
- 👤 Satu orang, satu akun. Jangan memakai akun bersama.
- 🚪 Segera **nonaktifkan** akun pengurus yang sudah tidak menjabat.
- 👀 Sesekali periksa **Log Aktivitas**, terutama baris merah seperti "Login gagal" atau "Akses ditolak" yang muncul berulang.
- 💾 Buat cadangan rutin setiap bulan.
- 📱 Jika HP hilang: ganti kata sandi dari perangkat lain (**Pengaturan → Keamanan**). Semua sesi di perangkat lain otomatis berakhir.

---

## Masalah yang sering terjadi

**"Setup belum dikonfigurasi" di halaman /setup**
→ `SETUP_TOKEN` (minimal 16 karakter) atau `ADMIN_EMAIL` belum diisi di Vercel. Isi keduanya, lalu **Redeploy**.

**"Email ini tidak terdaftar sebagai email Admin Utama"**
→ Email yang diketik berbeda dengan `ADMIN_EMAIL`. Periksa huruf dan spasinya.

**Deploy gagal dengan tulisan "DATABASE_URL belum diisi"**
→ Tambahkan `DATABASE_URL` di Environment Variables Vercel, lalu Redeploy.

**`/api/health` tidak menampilkan "terhubung"**
→ Alamat database salah salin. Salin ulang dari tombol **Connect** di Neon.

**Pengurus lupa kata sandi**
→ Panel Admin Utama → Pengguna → **Atur ulang sandi** → kirim tautannya lewat WhatsApp.

**Admin Utama lupa kata sandi**
→ Demi keamanan, tidak ada orang lain yang bisa mereset Admin Utama dari dalam aplikasi. Jalankan perintah ini dari komputer yang file `.env`-nya berisi alamat database **utama** dan `APP_URL`:
```
npm run admin:reset
```
Perintah ini menampilkan tautan atur ulang yang berlaku 1 jam. Pembuatan tautan ini juga tercatat di Log Aktivitas.

**"Terlalu banyak percobaan gagal"**
→ Tunggu 15 menit lalu coba lagi dengan kata sandi yang benar.

**Pura baru tidak muncul di halaman publik**
→ Pura yang didaftarkan oleh selain Admin Utama perlu disetujui dulu: **Panel Admin Utama → Pura → Setujui**.

**Ingin membuka pendaftaran mandiri** (orang bisa membuat akun sendiri)
→ Ubah `ALLOW_REGISTRATION` menjadi `true` di Vercel, lalu Redeploy. Pura baru yang mereka daftarkan tetap menunggu persetujuan Anda.
