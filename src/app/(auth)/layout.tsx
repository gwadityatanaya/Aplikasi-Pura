import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { PatternBg, OrnamentDivider } from "@/components/brand/ornament";
import { TempleCover } from "@/components/brand/temple-cover";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,560px)] xl:grid-cols-[1fr_620px]">
      <aside className="relative hidden overflow-hidden bg-forest text-white lg:flex lg:flex-col">
        <PatternBg />
        <div className="relative flex flex-1 flex-col p-12">
          <Link href="/" aria-label="Beranda PURA"><Logo light /></Link>
          <div className="my-auto max-w-lg">
            <p className="text-sm font-bold uppercase tracking-wider text-gold">Untuk pengurus pura</p>
            <h2 className="mt-3 text-4xl font-extrabold leading-tight">Semudah menulis di buku, sekuat sistem keuangan modern.</h2>
            <OrnamentDivider className="my-8 max-w-xs" />
            <ul className="space-y-3 text-lg text-white/80">
              <li>✓ Saldo kas &amp; bank dihitung otomatis</li>
              <li>✓ Foto nota tersimpan bersama transaksi</li>
              <li>✓ Laporan siap dibagikan ke krama</li>
            </ul>
          </div>
        </div>
        <TempleCover variant="emerald" className="relative h-56 opacity-90" />
      </aside>
      <main className="flex min-h-dvh flex-col bg-ivory">
        <div className="flex items-center justify-between p-5 lg:hidden">
          <Link href="/" aria-label="Beranda PURA"><Logo /></Link>
        </div>
        <div className="flex flex-1 items-start justify-center px-5 pb-10 pt-4 lg:items-center lg:px-12">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </main>
    </div>
  );
}
