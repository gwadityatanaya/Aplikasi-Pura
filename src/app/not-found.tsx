import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { OrnamentDivider } from "@/components/brand/ornament";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-ivory px-6 text-center">
      <div className="max-w-md">
        <Logo />
        <p className="mt-10 text-7xl font-extrabold text-forest">404</p>
        <OrnamentDivider className="my-6" />
        <h1 className="text-2xl font-bold">Halaman tidak ditemukan</h1>
        <p className="mt-2 text-muted">Tautan mungkin salah atau halaman sudah dipindahkan.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/" className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700">Ke beranda</Link>
          <Link href="/app" className="rounded-xl border border-line bg-white px-5 py-3 font-semibold hover:bg-ivory">Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
