import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { OrnamentDivider } from "@/components/brand/ornament";

export function PublicFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-white">
      <div className="container py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">
              &ldquo;Semudah menulis di buku, sekuat sistem keuangan modern.&rdquo; PURA membantu pengurus pura mencatat kas, dana
              punia, dan menyusun laporan yang transparan bagi krama.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-charcoal">Umat</h3>
            <ul className="mt-3 space-y-2 text-[15px] text-muted">
              <li><Link className="hover:text-emerald-700" href="/pura">Direktori Pura</Link></li>
              <li><Link className="hover:text-emerald-700" href="/donasi">Penggalangan Dana</Link></li>
              <li><Link className="hover:text-emerald-700" href="/#cara-kerja">Cara Kerja</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-charcoal">Pengurus</h3>
            <ul className="mt-3 space-y-2 text-[15px] text-muted">
              <li><Link className="hover:text-emerald-700" href="/masuk">Masuk</Link></li>
              <li><Link className="hover:text-emerald-700" href="/umat">Punia Saya</Link></li>
              <li><Link className="hover:text-emerald-700" href="/kebijakan-privasi">Kebijakan Privasi</Link></li>
              <li><Link className="hover:text-emerald-700" href="/pasang">Pasang di HP</Link></li>
            </ul>
          </div>
        </div>
        <OrnamentDivider className="my-8" />
        <p className="text-center text-sm text-muted">
          PURA tidak memproses pembayaran — dana punia ditransfer langsung ke rekening resmi pura dan diverifikasi oleh pengurus.
        </p>
      </div>
    </footer>
  );
}
