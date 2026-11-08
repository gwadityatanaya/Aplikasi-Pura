import type { Metadata } from "next";
import { HELP_ATTACHMENT_DAYS } from "@/lib/help";

export const metadata: Metadata = { title: "Kebijakan Privasi" };

const sections: { title: string; body: React.ReactNode }[] = [
  {
    title: "Data apa yang kami simpan",
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>Nama dan alamat email Anda (dari Google atau tautan email) untuk masuk.</li>
        <li>No. HP jika Anda mengisinya sendiri.</li>
        <li>Foto profil jika Anda mengunggahnya sendiri (opsional). Foto dipotong persegi dan diperkecil di perangkat Anda (sekitar 256×256 piksel) sebelum dikirim.</li>
        <li>Catatan punia: nominal, tanggal transfer, tujuan, foto bukti transfer, dan pilihan TAMPIL/ANONIM.</li>
        <li>Catatan masuk (waktu dan perangkat) untuk keamanan akun.</li>
      </ul>
    ),
  },
  {
    title: "Aplikasi tidak memegang uang",
    body: "PURA hanya mencatat. Uang punia Anda transfer langsung ke rekening pura lewat m-banking. Kami tidak pernah meminta PIN, kata sandi bank, atau kode OTP.",
  },
  {
    title: "Siapa yang dapat melihat data Anda",
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li><b>Umum:</b> jika Anda memilih TAMPIL, nama dan nominal punia yang sudah disahkan dapat terlihat di halaman pura. Jika memilih ANONIM, yang tampil hanya &quot;Anonim&quot; — nama asli tidak dikirim ke halaman publik sama sekali.</li>
        <li><b>Pengurus pura tujuan, Pengurus Banjar pengempon pura tersebut, dan Admin Utama:</b> dapat melihat nama asli dan foto bukti untuk keperluan verifikasi.</li>
        <li>Pengurus pura lain dan umat lain <b>tidak</b> dapat melihat data Anda.</li>
        <li><b>Foto profil</b> hanya terlihat oleh Anda sendiri, Pengurus Pura dan Pengurus Banjar yang bekerja bersama Anda di pura/banjar yang sama, dan Admin Utama. Foto profil <b>tidak pernah</b> tampil di halaman publik, laporan publik, atau di samping punia — termasuk punia ANONIM. Admin Utama dapat menghapus foto yang tidak pantas; tindakan itu tercatat dan Anda diberi tahu di aplikasi.</li>
      </ul>
    ),
  },
  {
    title: "Formulir pengajuan pendaftaran banjar",
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>Data di formulir <b>Ajukan pendaftaran</b> (nama banjar, wilayah, nama pura, nama dan jabatan pemohon, nomor WhatsApp, email, pemberi referensi dan kontaknya, alasan) hanya dilihat <b>Admin Utama</b> untuk memverifikasi pendaftaran, termasuk menghubungi Anda dan pemberi referensi. Tidak ditampilkan di halaman publik.</li>
        <li>Kami tidak meminta KTP atau nomor identitas. Mengirim formulir tidak memberi akses apa pun ke aplikasi.</li>
        <li>Log Aktivitas hanya mencatat nama banjar dan pura dari pengajuan, bukan data pribadi pemohon.</li>
      </ul>
    ),
  },
  {
    title: "Email konfirmasi punia",
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>Saat punia yang <b>Anda kirim lewat aplikasi</b> disahkan atau ditolak pengurus, kami mengirim email ke alamat akun Anda sendiri (jika layanan email aplikasi aktif). Punia yang dicatat pengurus secara manual tidak mengirim email.</li>
        <li>Isinya hanya data punia Anda sendiri: nama pura, nominal, tanggal transfer, penggalangan/kegiatan terkait, status, nomor catatan, dan tanggal pengesahan — atau alasan penolakan beserta cara memperbaikinya. <b>Tidak</b> memuat nama pengurus yang mengesahkan, nomor rekening lengkap, atau foto bukti.</li>
        <li>Email ini adalah konfirmasi <b>pencatatan</b>, bukan kuitansi dan bukan bukti transaksi bank.</li>
        <li>Email dikirim bertahap lewat antrean sesuai kuota harian layanan email; jika kuota habis, email dikirim hari berikutnya. Isi email antrean disimpan di server agar bisa dikirim ulang bila gagal.</li>
        <li>Anda bisa mematikan email ini di <b>Akun saya → Email konfirmasi punia</b>. Status punia tetap terlihat di <b>Punia Saya</b>.</li>
      </ul>
    ),
  },
  {
    title: "Pusat bantuan",
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>Pesan yang Anda kirim lewat tombol bantuan hanya dibaca oleh Anda dan Admin Utama.</li>
        <li>Agar mudah dibantu, aplikasi otomatis menyertakan: alamat halaman (tanpa isi formulir atau kode di belakangnya), peran Anda, pura yang sedang dibuka, serta jenis perangkat dan browser. <b>Tidak</b> ada data keuangan dan tidak ada nama donatur anonim.</li>
        <li>Gambar lampiran diperkecil di perangkat Anda dan <b>dihapus otomatis {HELP_ATTACHMENT_DAYS} hari</b> setelah pesan ditandai selesai. Isi pesan tetap disimpan sebagai riwayat.</li>
        <li>Jangan pernah menulis kata sandi, PIN, kode OTP, atau kode rahasia apa pun di pesan bantuan.</li>
        <li>Email pemberitahuan balasan hanya dikirim jika layanan email aplikasi sudah diaktifkan.</li>
      </ul>
    ),
  },
  {
    title: "Berapa lama disimpan",
    body: "Catatan punia yang sudah disahkan adalah bagian dari pembukuan pura dan disimpan selama pura memakai aplikasi ini. Data akun disimpan sampai Anda menghapus akun.",
  },
  {
    title: "Menghapus akun",
    body: "Buka Punia Saya → Akun saya → Hapus akun. Nama, email, No. HP, foto profil, dan gambar lampiran pesan bantuan Anda dihapus. Foto profil juga bisa dihapus kapan saja tanpa menghapus akun. Punia yang sudah disahkan tetap tersimpan sebagai arsip keuangan pura dengan nama \"Anonim\". Catatan keamanan (Log Aktivitas) yang hanya bisa dilihat Admin Utama tetap menyimpan nama akun yang pernah melakukan tindakan, karena catatan itu sengaja dibuat tidak bisa diubah.",
  },
  {
    title: "Email dari aplikasi",
    body: "Kami hanya mengirim email tautan masuk dan, untuk pengurus, ringkasan punia yang menunggu verifikasi (bisa dimatikan di Pengaturan). Tidak ada iklan.",
  },
  {
    title: "Pertanyaan",
    body: "Hubungi pengurus pura Anda atau Admin Utama aplikasi ini untuk pertanyaan tentang data Anda.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="container max-w-2xl py-10">
      <h1 className="text-3xl font-extrabold text-forest">Kebijakan Privasi</h1>
      <p className="mt-2 text-lg text-muted">Ringkas dan apa adanya: bagaimana PURA menjaga data umat.</p>
      <div className="mt-8 space-y-6 text-[17px] leading-relaxed">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="text-xl font-bold text-charcoal">{s.title}</h2>
            <div className="mt-1 text-charcoal/85">{s.body}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
