# Hal yang masih perlu keputusan Anda

Daftar ini berisi pilihan yang **tidak bisa saya putuskan sendiri** karena menyangkut kebijakan banjar, uang, atau tanggung jawab. Untuk tiap poin ada saran saya; tandai yang sudah Anda putuskan.

## Sudah diputuskan (Phase 3.1)

- ✅ Nama pencatat ("dicatat oleh") disembunyikan dari umat.
- ✅ Pemeriksa hanya melihat "Anonim" untuk donatur anonim.
- ✅ Pengurus Banjar boleh mengoreksi punia di semua pura yang diempon banjarnya (termasuk pura tanpa pengurus), dengan alasan wajib, tidak untuk punianya sendiri.
- ✅ Mode darurat Admin Utama: 60 menit.
- ✅ Situs demo hanya untuk orang tertentu, tidak diindeks mesin pencari, isi ulang manual dengan `npm run db:reset-demo`.
- ✅ Email uji coba: Brevo Free + Gmail khusus proyek; domain sendiri ditunda sampai pilot.

- ✅ Nama akun di Log Aktivitas (khusus Admin Utama) dibiarkan sebagai jejak keamanan. **Sampaikan ke pengurus saat pilot:** "ANONIM" berarti anonim di **tampilan publik** dan laporan versi umum. Nama asli pengirim tetap diketahui oleh pengurus pura tujuan, Pengurus Banjar pengemponnya, dan Admin Utama.
- ✅ Gabung akun: tidak dibuat. Pengurus yang punya dua email memakai email yang didaftarkan Admin Utama.
- ⏳ Skrip ganti email Admin Utama: dipindah ke **Phase 3.4**. Aturan pengesahan pengeluaran menunggu batas nominal dari pengurus banjar.

## Alamat bertingkat (baru)

1. **Nomor Kepmendagri sumber data.** Berkas data dari cahyadsn/wilayah menyebut *Kepmendagri No. 300.2.2-2138 Tahun 2025* di kepala berkasnya, sedangkan README repositorinya menyebut *No. 300.2.2-2430 Tahun 2025*. Isi datanya cocok dengan jumlah wilayah resmi 2025 (38 provinsi, 514 kab/kota, 7.285 kecamatan, 83.762 desa/kelurahan). *Saran: pakai seperti sekarang*, dan perbarui saat sumbernya merilis versi baru. Jika Anda ingin sumber lain (mis. langsung dari situs Kemendagri atau BPS), beri tahu saya.
2. **Desa dinas vs desa adat.** Dropdown memakai wilayah **dinas** (Kemendagri). Banjar adat sering lebih cocok dikelompokkan per **desa adat** (MDA Bali), yang tidak selalu sama dengan desa dinas. Perlu ditambahkan kolom "Desa adat" (teks atau daftar MDA) untuk banjar? *Saran: ya, sebagai teks dulu, sebelum BDDN.*
3. **Alamat lama tanpa kode.** Banjar/pura yang dulu diisi teks bebas tetap tampil apa adanya tetapi belum punya kode. Perlu saya buatkan bantuan "cocokkan otomatis" (mencari kode berdasarkan nama) yang hasilnya Anda periksa sebelum disimpan? *Saran: belum perlu*; untuk pilot, cukup pilih ulang dari dropdown saat mengedit.
4. **Pengurus pura belum bisa mengubah lokasi pura** (hanya Admin Utama di Back Office), sama seperti sebelumnya. Tetap begitu?

## Phase 3.2 — sudah diputuskan

- ✅ Lampiran pesan bantuan dihapus otomatis **30 hari** setelah pesan Selesai.
- ✅ **Banjar diarsipkan:** Pengurus Banjar-nya tetap bisa **melihat** laporan dan riwayat pura yang diempon (baca saja), tetapi tidak bisa mencatat, mengesahkan, menolak, atau mengoreksi.
- ✅ **Pura dengan punia menunggu tidak bisa diarsipkan** sampai semua punia itu disahkan atau ditolak (dijaga aplikasi dan database).
- ✅ **Foto dihapus Admin Utama:** pemiliknya mendapat satu kalimat pemberitahuan di aplikasi, tanpa alasan rinci.
- ⏳ **Skrip ganti email Admin Utama** → Phase 3.4.
- ⏳ **Batas nominal pengesahan pengeluaran** → menunggu angka dari pengurus banjar.

## Phase 3.2 — masih terbuka (sudah berjalan dengan saran saya)

1. **Kertas F4.** PDF memakai F4 21,5 × 33 cm. Excel tidak punya ukuran "F4", jadi memakai **Folio 8½ × 13 inci** (21,6 × 33 cm) — selisih 1 mm, hasil cetak sama. *Saran: biarkan.*
2. **Pemisah ribuan di Excel** mengikuti bahasa komputer (Rp1.050.000 di Windows berbahasa Indonesia, Rp1,050,000 di Windows berbahasa Inggris). Bisa dipaksa selalu titik, tetapi angkanya lalu menjadi teks dan **tidak bisa dijumlah lagi**. *Saran: biarkan sebagai angka.*
3. **Pilihan tanda tangan bawaan** saat membuka halaman Laporan: "Ketua, Sekretaris, dan Bendahara", tanpa "Mengetahui". Perlu diganti, misalnya selalu dengan "Mengetahui: Kelian Banjar"?
4. **Yang dihitung "data"** sehingga pura tidak bisa dihapus permanen: transaksi, punia, kegiatan (selain "Operasional Pura" otomatis), **campaign**, **laporan terbit**, foto/nota, dan saldo awal kas. *Saran: tetap begitu* (lebih aman).
5. **Pemeriksa tidak melihat foto profil** (hanya pemilik, Pengurus Pura/Banjar terkait, dan Admin Utama). *Saran: tetap begitu.*
6. **Foto Admin Utama** terlihat oleh semua Pengurus Pura/Banjar, karena Admin Utama terhubung ke semua pura. *Saran: tetap begitu.*
7. **Batas 5 pesan per jam** per orang. *Saran: tetap.*
8. **Laporan "penyalahgunaan atau pura mencurigakan"** hanya masuk ke Admin Utama, **tidak** ke Pengurus Banjar (karena bisa jadi yang dilaporkan justru pengurus setempat). *Saran: tetap begitu.*
9. **Isi pesan bantuan** disimpan selama aplikasi dipakai; saat akun dihapus, pesan tetap ada dengan nama "Akun dihapus" tetapi gambar lampirannya ikut dihapus. Perlu pesan juga dihapus bersama akun?

## Phase 3.3 — perlu keputusan Anda

Semua sudah berjalan dengan pilihan "saran" di bawah. Jawab hanya yang ingin diubah.

**Kegiatan & penggalangan dana**

1. ✅ *(diputuskan: opsional)* **Tanggal berakhir penggalangan ikut opsional.** Agar benar-benar "hanya judul yang wajib", tanggal berakhir boleh kosong; penggalangan tanpa tanggal berakhir berjalan sampai ditutup. *Saran: biarkan.* Jika ingin tanggal berakhir tetap wajib, beri tahu saya.
2. ✅ *(diputuskan: satu isian)* **"Cerita" dan "Tujuan" tetap satu isian** ("Cerita & tujuan", opsional), terpisah dari "Dana akan digunakan untuk". Perlu dipecah menjadi dua isian?
3. ✅ *(diputuskan)* **Penggalangan yang sudah ditutup tidak bisa dibuka lagi** (alasan penutupan juga tidak bisa diubah). Jika perlu, buat penggalangan baru. *Saran: biarkan.*
4. **Kegiatan kosong boleh dihapus oleh Pengurus Banjar** juga (sesuai permintaan). Kegiatan "Operasional Pura" yang dibuat otomatis juga bisa dihapus jika kosong. *Saran: biarkan.*
5. ✅ *(diputuskan: cukup, dengan peringatan di form)* **Pemeriksaan data pribadi** pada alasan penutupan dan alasan penolakan hanya mengenali **email, nomor HP, dan nomor rekening**. Nama orang tidak bisa dikenali otomatis — hanya peringatan di form. Cukup?

**Rekening & QRIS**

6. **Rekening tanpa centang "Tampil untuk umat"** tetap tercatat di buku kas tetapi tidak bisa dipilih umat (mis. rekening tabungan internal). *Saran: biarkan.*
7. ✅ **Input punia manual** kini punya pilihan **Masuk ke** (rekening atau Tunai) — Phase 3.4.
8. **QRIS hanya satu per pura.** Perlu QRIS per rekening?

**Email konfirmasi**

9. **Kuota harian:** 250 email konfirmasi per hari (Brevo Free 300, sisa 50 untuk tautan masuk dan ringkasan harian). *Saran: biarkan untuk pilot.*
10. ✅ **Email gagal** dicoba sampai 5 kali; jumlah yang tetap gagal kini tampil sebagai peringatan di Back Office (Phase 3.4).
11. ✅ **Isi email antrean dihapus otomatis 90 hari** setelah selesai (terkirim, dibatalkan, atau gagal) — Phase 3.4.
12. Email penolakan juga memuat kalimat "bukan kuitansi" (seragam dengan email pengesahan). *Saran: biarkan.*

**Migrasi dari buku**

13. **Saksi saldo awal berupa nama yang diketik** (dengan saran nama pengurus pura). Haruskah wajib dipilih dari daftar pengurus berakun saja? *Saran: biarkan diketik* — saksi kadang pengurus banjar yang belum punya akun.
14. ✅ *(diputuskan)* **Transaksi sebelum tanggal mulai ditolak** (bukan sekadar peringatan), termasuk pengesahan punia yang ditransfer sebelum tanggal mulai (karena uangnya sudah masuk saldo awal). *Saran: biarkan.*
15. ✅ **Pencocokan bulanan** bisa diisi Pengurus Pura dan Pengurus Banjar (Phase 3.4); Pemeriksa tidak.
16. **Tanggal mulai tidak boleh setelah transaksi pertama yang sudah tercatat** (untuk pura demo/pilot yang sudah berjalan). Pura yang sudah punya transaksi lama sebaiknya memilih tanggal mulai sama dengan atau sebelum transaksi pertamanya.

**Lanjutan**

17. ✅ **Skrip ganti email Admin Utama** → selesai di Phase 3.4 tahap 4 (`npm run admin:ganti-email`).
18. ⏳ **Batas nominal pengesahan pengeluaran** → menunggu angka dari pengurus banjar.

## Phase 3.4 — perlu keputusan Anda

Semua sudah berjalan dengan pilihan "saran" di bawah. Jawab hanya yang ingin diubah.

**Pengajuan pendaftaran & verifikasi**

1. ✅ *(diputuskan: biarkan)* **Pengajuan yang disetujui membuat pura berstatus belum aktif** (lencana "Nonaktif"), bukan langsung aktif. Pura baru aktif setelah Admin Utama mengubah statusnya lewat **Ubah data** (biasanya setelah checklist verifikasi selesai). Tidak ada akun pengurus atau rekening yang dibuat otomatis. *Saran: biarkan.*
2. **Batas kirim: 3 pengajuan per hari per jaringan internet**, dan WA/email yang masih punya pengajuan menunggu ditolak dengan pesan "sudah kami terima". Satu warnet atau wifi balai banjar bisa terkena batas yang sama. *Saran: biarkan.*
3. ✅ *(diputuskan, sudah dikerjakan)* Pengajuan berstatus **Ditolak dihapus otomatis 6 bulan** setelah perubahan terakhirnya; Log mencatat jumlahnya saja.
4. ✅ *(diputuskan, sudah dikerjakan)* **Aktivasi pura tidak dikunci**, tetapi jika checklist belum 4/4 muncul peringatan dan **alasan wajib**, tercatat di Log Aktivitas. Berlaku juga ✅ *(diputuskan, sudah dikerjakan)* saat pura **langsung dibuat Aktif** lewat **Tambah pura** (kecuali checklist sudah 4/4). Skrip data demo tidak terkena aturan ini.

**Pemeliharaan**

5. **Pengingat cadangan** hanya menghitung cadangan dari aplikasi (**Cadangan data → Unduh**) dan skrip `npm run backup`. Riwayat otomatis Neon tidak terlihat oleh aplikasi, jadi tidak dihitung. Batasnya **7 hari**. *Saran: biarkan.*
6. **Dasbor angka per banjar:** pura yang diempon dua banjar dihitung di **kedua** banjar, jadi jumlah per banjar bisa lebih besar dari total keseluruhan. Ini tertulis di bawah tabel. *Saran: biarkan.*
7. **Skrip ganti email Admin Utama** hanya bisa dijalankan dengan akses database (dari laptop). Login Google lama otomatis diputus; Admin Utama masuk lagi dengan email baru. *Saran: biarkan.*

**Kenyamanan pengguna**

8. **Ukuran huruf** satu pilihan per akun, berlaku di Dashboard maupun Tampilan Umat. Sebelum masuk, pilihan disimpan di perangkat saja. *Saran: biarkan.*
9. **Bukti pencatatan punia** tersedia untuk semua status (menunggu, disahkan, ditolak, dikoreksi). Nomor catatan hanya ada setelah disahkan; sebelumnya tampil **kode kiriman**. *Saran: biarkan.*
10. **Nama pada bukti punia ANONIM** disembunyikan secara bawaan ("Anonim"). Pemilik akun bisa mencentang agar namanya ikut tercetak. *Saran: biarkan.*
11. ⏳ *(dicatat untuk Phase 3.6)* **Pengurus dan Admin Utama tidak bisa membuka bukti punia umat** (hanya pemilik akun). Akibatnya pengurus tidak bisa mencetakkan bukti untuk umat yang datang ke pura. Punia yang dicatat manual juga tidak punya bukti digital. Perlu versi bukti yang bisa dicetak pengurus?

**Mode demo**

12. **Nama wilayah di data contoh adalah wilayah nyata** (Badung › Mengwi, Gianyar › Ubud) agar dropdown alamat bisa dicoba. Banjar, pura, orang, dan rekening tetap fiktif. *Saran: biarkan.*
13. **Pengaman isi ulang demo hanya memeriksa nama pura dan banjar**, bukan nama akun. Alasannya: calon klien yang mencoba situs demo dengan akun Google membuat akun bernama asli, dan itu tidak boleh menghalangi isi ulang. Akun-akun itu ikut terhapus saat demo diisi ulang. *Saran: biarkan.*

**Panduan**

14. ✅ *(diputuskan, sudah dikerjakan: diganti `admin@contoh.id`)* **PANDUAN.md masih menulis email Google Anda** di langkah pemasangan (Admin Utama, `ADMIN_EMAIL`, `/setup`). Ini bukan kunci rahasia, tetapi jika panduan akan dibagikan ke banjar lain, sebaiknya diganti dengan contoh seperti `email-admin@contoh.com`. Saya tidak mengubahnya tanpa persetujuan Anda. Ganti?

## Bahan pilot (dijawab sebelum pilot, tidak perlu untuk demo)

Bagian A–D di bawah: pengurus tiap pura, rekening, tanggal mulai dan saldo awal, serta pemegang cadangan.

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
2. ✅ **Kode wilayah baku — sudah ada.** Banjar dan pura menyimpan kode Kemendagri (provinsi, kabupaten/kota, kecamatan, desa/kelurahan) dari dropdown bertingkat, di kolom `province_code`, `regency_code`, `district_code`, `village_code` (tabel `banjars` diberi indeks per kabupaten). Ringkasan BDDN bisa dikelompokkan per kode tanpa takut ejaan berbeda. Yang belum ada: **desa adat** (MDA), yang batasnya tidak selalu sama dengan desa dinas — lihat keputusan di bawah.
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
