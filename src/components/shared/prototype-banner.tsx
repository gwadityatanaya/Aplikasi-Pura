"use client";
import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";

export function PrototypeNotice() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-gold-light px-2.5 py-1 text-xs font-bold text-gold-dark ring-1 ring-gold/30 hover:bg-[#efe1c4]"
      >
        <FlaskConical className="h-3.5 w-3.5" aria-hidden /> Prototipe
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Tentang prototipe ini" size="md">
        <div className="space-y-3 text-[15px] leading-relaxed text-charcoal">
          <p>
            PURA versi ini adalah <strong>prototipe interaktif</strong> untuk demonstrasi. Semua nama, transaksi, rekening dan
            nominal adalah <strong>data fiktif</strong>.
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-muted">
            <li>Login dan sesi hanya simulasi di peramban Anda — bukan sistem keamanan sungguhan. Kata sandi tidak disimpan.</li>
            <li>Data tersimpan di LocalStorage perangkat ini dan dapat diatur ulang kapan saja.</li>
            <li>Tidak ada pembayaran sungguhan. Donasi &quot;simulasi&quot; ditandai dengan jelas.</li>
            <li>Versi produksi akan memakai server yang aman, autentikasi dan otorisasi di sisi server, serta verifikasi mutasi bank.</li>
          </ul>
        </div>
      </Dialog>
    </>
  );
}

export function SimulationTag({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800 ring-1 ring-amber-200 ${className}`}>
      Simulasi
    </span>
  );
}
