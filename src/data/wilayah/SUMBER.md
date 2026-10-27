# Data wilayah administrasi Indonesia

- **Berkas:** `wilayah.json` — kode dan nama provinsi, kabupaten/kota, kecamatan, desa/kelurahan.
- **Sumber:** [cahyadsn/wilayah](https://github.com/cahyadsn/wilayah), berkas `db/wilayah.sql`
  (terakhir diubah 13 Februari 2026). Kode mengikuti kode wilayah Kemendagri.
- **Dasar data:** kepala berkas menyebut *Kepmendagri No. 300.2.2-2138 Tahun 2025*; README repositori
  menyebut *Kepmendagri No. 300.2.2-2430 Tahun 2025*.
- **Jumlah:** 38 provinsi, 514 kabupaten/kota, 7.285 kecamatan, 83.762 desa/kelurahan.
- **Lisensi:** MIT — lihat `LICENSE-cahyadsn-wilayah.txt`.
- **Bentuk kode:** `51` (provinsi) → `51.03` (kab/kota) → `51.03.05` (kecamatan) → `51.03.05.2001` (desa/kelurahan).

Memperbarui: lihat docs/PANDUAN.md bagian "Memperbarui data wilayah". Ringkasnya:

    npm run wilayah:update -- <berkas-wilayah.sql> --sumber "<sumber & dasar hukum>" --lisensi "<lisensi>"

Aplikasi tidak memanggil layanan luar: data ini dibaca server dari berkas di atas.
