import type { Metadata } from "next";

export const metadata: Metadata = { title: "Kebijakan Privasi" };

const sections: { title: string; body: React.ReactNode }[] = [
  {
    title: "Data apa yang kami simpan",
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>Nama dan alamat email Anda (dari Google atau tautan email) untuk masuk.</li>
        <li>No. HP jika Anda mengisinya sendiri.</li>
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
      </ul>
    ),
  },
  {
    title: "Berapa lama disimpan",
    body: "Catatan punia yang sudah disahkan adalah bagian dari pembukuan pura dan disimpan selama pura memakai aplikasi ini. Data akun disimpan sampai Anda menghapus akun.",
  },
  {
    title: "Menghapus akun",
    body: "Buka Punia Saya → Akun saya → Hapus akun. Nama, email, dan No. HP Anda dihapus. Punia yang sudah disahkan tetap tersimpan sebagai arsip keuangan pura dengan nama \"Anonim\".",
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
