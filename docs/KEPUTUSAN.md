# Hal yang masih perlu keputusan Anda

Daftar ini berisi pilihan yang **tidak bisa saya putuskan sendiri** karena menyangkut kebijakan banjar, uang, atau tanggung jawab. Untuk tiap poin ada saran saya; tandai yang sudah Anda putuskan.

## Baru dari Phase 3.1

1. **Nama pengurus yang mencatat punia manual disembunyikan dari umat.** Pengurus, Pengurus Banjar, dan Admin Utama melihat "dicatat oleh [nama]". Umat (di riwayat punianya dan di halaman pura) tidak melihat nama itu. *Saran: tetap disembunyikan.* Umat cukup tahu punianya "dicatat oleh pengurus".
2. **Pemeriksa melihat "Anonim".** Aturan Anda menyebut nama asli hanya untuk pengurus pura, Pengurus Banjar terkait, dan Admin. Karena itu Pemeriksa (peran lihat-saja) juga melihat "Anonim" untuk donatur anonim, dan tidak bisa membuka laporan punia versi lengkap. *Saran: tetap begitu.* Jika Pemeriksa perlu mencocokkan nama, ia bisa minta pengurus.
3. **Siapa boleh mengoreksi punia yang sudah disahkan?** Sekarang **Pengurus Pura** (dan Admin Utama lewat mode darurat). Pengurus Banjar hanya bisa mengesahkan atau menolak, tidak mengoreksi. Akibatnya, untuk **pura tanpa pengurus**, koreksi hanya bisa dilakukan Admin Utama lewat mode darurat. *Pilihan:* izinkan Pengurus Banjar mengoreksi punia di pura yang belum punya pengurus.
4. **Lama mode darurat Admin Utama: 60 menit**, satu pura, alasan wajib. Urusan Back Office (banjar, data pura, rekening, pengurus, ganti email) tidak perlu mode darurat. Perlu lebih pendek atau lebih panjang?
5. **Ganti email Admin Utama.** Tombol "Ganti email" sengaja tidak berlaku untuk Admin Utama. Jika email Anda sendiri perlu diganti, itu dilakukan bersama orang teknis: ubah `ADMIN_EMAIL` di Vercel, lalu ubah email di database. Perlu dibuatkan skrip khusus seperti `admin:reset`?
6. **Ganti email ke alamat yang sudah dipakai akun umat.** Saat ini ditolak, agar dua akun tidak tercampur. Hal ini bisa terjadi jika pengurus sudah lebih dulu masuk dengan email barunya sebagai umat. Perlu fitur "gabungkan akun"? *Saran: belum perlu untuk pilot.*
7. **Situs DEMO.** Siapa pun bisa masuk ke situs demo dan mencoba-coba. Perlukah data demo **dihapus dan diisi ulang** berkala (mis. tiap minggu), atau situs demo hanya dibagikan ke orang tertentu?
8. **Pengirim email.** Untuk uji coba memakai Brevo Free + Gmail khusus proyek, yang lebih sering masuk Spam. Untuk pemakaian rutin, *saran: beli domain sendiri* (±Rp150–250 ribu/tahun) dan daftarkan di Brevo.

## A. Sebelum uji coba (pilot) dimulai

1. **Mulai dengan database bersih?**
   Data dari Phase 2 hanya data coba. Saran: buat database Neon **baru** khusus pilot, jalankan `/setup`, lalu masukkan banjar dan pura yang asli. Data contoh (`db:seed-demo`) jangan dipakai di database pilot.

2. **Alamat aplikasi.**
   Tetap `*.vercel.app` (gratis) atau beli domain sendiri (mis. `kaspura.id`, ±Rp150–250 ribu/tahun)? Domain sendiri membuat email tautan masuk lebih jarang masuk Spam dan terlihat lebih resmi. Jika alamat berubah, redirect URI Google juga harus diubah.

3. **Alamat pengirim email.**
   Gmail pribadi boleh untuk pilot, tetapi lebih sering masuk Spam. Dengan domain sendiri, alamat seperti `noreply@domain-anda` bisa diverifikasi di Brevo.

4. **Rekening tiap pura atas nama siapa?**
   Aplikasi menampilkan nama pemilik rekening kepada umat. Saran: rekening atas nama **pura/banjar** (bukan pribadi pengurus) agar tidak ada keraguan saat pergantian pengurus. Jika masih atas nama pribadi, sebaiknya diumumkan di paruman.

5. **Daftar pengurus tiap pura (minimal 2 orang).**
   Pura dengan satu pengurus memunculkan peringatan, karena punia dari pengurus itu sendiri harus disetujui orang lain (Pengurus Banjar). Siapa Pengurus Banjar untuk pilot?

6. **Tanggal mulai pembukuan dan saldo awal.**
   Pilih satu tanggal "pindah dari buku ke aplikasi" (mis. 1 bulan depan). Pengurus mengisi **saldo awal** per tanggal itu dari buku kas. Posisi kas di halaman umat dihitung dari saldo awal tersebut.

7. **Pengaturan bawaan tampilan umat.**
   Saat ini semua **terbuka**: saldo kas, 5 transaksi terakhir, daftar punia. Apakah paruman setuju saldo kas tiap pura terlihat publik? Pengurus tiap pura bisa menutupnya sendiri di **Pengaturan → Tampilan untuk umat**.

8. **Siapa saja boleh mendaftar sebagai umat?**
   Saat ini terbuka untuk siapa pun yang punya email (`UMAT_REGISTRATION=true`). Umat baru hanya bisa melihat halaman publik dan riwayatnya sendiri. Alternatifnya: tutup pendaftaran dan hanya terima punia lewat input manual pengurus.

## B. Aturan punia

9. **Batas umur bukti transfer.** Sekarang maksimal **1 tahun** ke belakang dan tidak boleh tanggal di masa depan. Perlu lebih pendek (mis. 3 bulan)?
10. **Tujuan punia.** Pilihan sekarang: Umum, Odalan/Piodalan, Pembangunan, Lainnya. Perlu tambahan (mis. Ngusaba, Melasti, Perbaikan Pelinggih)?
11. **Input manual langsung terverifikasi** (sesuai jawaban Anda), kecuali punia dengan email pengurus itu sendiri. Perlu batas nominal, mis. di atas Rp5 juta tetap butuh persetujuan pengurus kedua?
12. **Jam email ringkasan harian.** Sekarang pukul **09.00 WITA**, maksimal 1 email per pengurus per hari dan hanya jika ada punia menunggu.

## C. Tanggung jawab dan keamanan

13. **Siapa memegang cadangan mingguan** dan di mana disimpan (Google Drive siapa)? Saran: Admin Utama + satu orang kepercayaan.
14. **Cadangan Admin Utama.** Hanya ada satu Admin Utama. Jika Anda berhalangan lama, siapa yang memegang akses Neon (untuk skrip darurat `npm run admin:reset`)? Saran: simpan akses Neon dan Vercel di amplop tertutup / pengelola kata sandi bersama satu orang kepercayaan.
15. **Kebijakan privasi.** Halaman `/kebijakan-privasi` sudah ada versi ringkas. Untuk penggunaan lebih luas, sebaiknya ditinjau terkait **UU No. 27/2022 tentang Pelindungan Data Pribadi**, termasuk siapa "pengendali data" (banjar? yayasan?) dan kontak resminya.
16. **Lama penyimpanan data.** Catatan keuangan disimpan selamanya sebagai arsip pura. Perlu batas, mis. foto bukti dihapus setelah 5 tahun?

## D. Fitur yang belum dikerjakan (bisa ditambah kemudian)

17. **Impor mutasi rekening (CSV).** Versi sederhana sudah ada: pengurus mengunggah file CSV mutasi, aplikasi menandai punia yang nominal dan tanggalnya cocok. Tidak ada data bank yang disimpan. Untuk hasil terbaik, saya perlu **contoh file mutasi** (nomor rekening dan nama boleh disamarkan) dari bank yang dipakai (BPD Bali, BRI, BNI, dll.) karena formatnya berbeda-beda.
18. **Integrasi bank otomatis / QRIS** — di luar cakupan. Butuh kerja sama dengan bank atau penyedia pembayaran, dan mengubah aplikasi dari "mencatat" menjadi "menerima uang" (aturan Bank Indonesia dan OJK berlaku).
19. **Aplikasi di Play Store / App Store** — di luar cakupan. Versi PWA (pasang dari peramban) sudah bisa dipakai. Play Store butuh akun developer ($25 sekali bayar); App Store butuh $99/tahun.

---

# Persiapan akses BDDN (Bendesa / tingkat di atas banjar)

Tujuan: BDDN bisa melihat **ringkasan** banyak banjar sekaligus, **hanya-baca**. Halamannya belum dibuat, tetapi data sudah disiapkan agar penambahannya ringan.

**Yang sudah siap:**
- Setiap pura terhubung ke banjar lewat tabel `temple_banjars` (banyak-ke-banyak). Setiap banjar punya kolom desa, kecamatan, kabupaten, dan provinsi.
- Peran dihitung di server, di satu tempat (`templeAccess` di `src/server/context.ts`). Peran baru cukup ditambahkan di sana dan di `src/lib/permissions.ts`.
- Data publik dan data pribadi sudah terpisah (`src/server/public.ts`). Ringkasan BDDN bisa memakai pola yang sama: angka, tanpa nama umat atau foto bukti.

**Yang perlu diputuskan dan dikerjakan nanti:**
1. **Cakupan wilayah BDDN.** Apakah per desa adat, per kecamatan, atau per kabupaten? Saran: tabel baru `bddn_members (user_id, scope_type, scope_value)`, misalnya `("desa", "Desa Adat X")`. Admin Utama mendaftarkan email BDDN di Back Office, sama seperti Pengurus Banjar.
2. **Kode wilayah baku.** Nama desa dan kecamatan sekarang diketik bebas, sehingga ejaannya bisa berbeda-beda. Sebelum BDDN, isi kode wilayah resmi (kode Kemendagri, atau daftar desa adat dari MDA) di tabel `banjars` agar ringkasan per wilayah tidak terpecah.
3. **Isi ringkasan.** Saran isi:
   - total punia dan pengeluaran per banjar/pura per bulan,
   - jumlah punia menunggu verifikasi,
   - kapan terakhir diperbarui,
   - jumlah pengurus, dan pura yang belum punya pengurus atau rekening.

   **Tanpa** nama donatur, foto bukti, atau Log Aktivitas.
4. **Halaman dan API.** Buat `GET /api/bddn/ringkasan` yang hanya mengembalikan angka gabungan, dan halaman `/app/bddn`. BDDN tidak masuk ke daftar pura biasa (tidak bisa memverifikasi atau mengubah apa pun).
5. **Persetujuan banjar.** Apakah setiap banjar perlu menyetujui datanya dilihat BDDN? Jika ya, tambahkan kolom `share_with_bddn` di tabel `banjars` (bawaan: tidak).
6. **Kapasitas saat jumlah pengguna banyak.**
   - Foto bukti sekarang disimpan di database. Neon gratis berkapasitas 0,5 GB, kira-kira 3.000–5.000 foto. Untuk puluhan banjar, pindahkan foto ke penyimpanan file (Vercel Blob / Cloudflare R2) dan naikkan paket Neon.
   - Kuota email Brevo gratis 300/hari. Untuk puluhan banjar, perlu paket berbayar atau lebih banyak pengguna memakai login Google.
7. **Admin di bawah Admin Utama.** Dengan banyak banjar, satu Admin Utama akan kewalahan. Pertimbangkan peran **"Admin Banjar"** yang boleh mendaftarkan pengurus untuk banjarnya sendiri, sementara **rekening tetap hanya diubah Admin Utama**.
