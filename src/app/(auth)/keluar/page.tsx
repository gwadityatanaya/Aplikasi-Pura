"use client";
import Link from "next/link";
import { useEffect } from "react";
import { LogOut } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { useStore } from "@/lib/store";

export default function LogoutPage() {
  const hydrated = useStore((s) => s.hydrated);
  const logout = useStore((s) => s.logout);
  useEffect(() => {
    if (hydrated && useStore.getState().session) logout();
  }, [hydrated, logout]);
  return (
    <div className="text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-mint text-emerald-700"><LogOut className="h-8 w-8" /></div>
      <h1 className="mt-5 text-2xl font-extrabold text-forest">Anda telah keluar</h1>
      <p className="mt-2 text-[17px] text-muted">Suksma telah menjaga kas pura dengan baik. Sampai jumpa lagi.</p>
      <div className="mt-7 flex flex-col gap-2">
        <Link href="/masuk" className={buttonClass("primary", "xl")}>Masuk kembali</Link>
        <Link href="/" className={buttonClass("outline", "xl")}>Ke beranda</Link>
      </div>
    </div>
  );
}
