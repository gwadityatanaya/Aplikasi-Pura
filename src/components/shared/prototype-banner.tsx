"use client";
import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { useStore } from "@/lib/store";

/** Badge shown only in demo mode, explaining that the data is fictional. */
export function PrototypeNotice() {
  const [open, setOpen] = useState(false);
  const isDemo = useStore((s) => s.mode === "demo");
  if (!isDemo) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-gold-light px-2.5 py-1 text-xs font-bold text-gold-dark ring-1 ring-gold/30 hover:bg-[#efe1c4]"
      >
        <FlaskConical className="h-3.5 w-3.5" aria-hidden /> Mode demo
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Tentang mode demo" size="md">
        <div className="space-y-3 text-[15px] leading-relaxed text-charcoal">
          <p>
            Anda sedang memakai <strong>mode demo</strong>. Semua nama, transaksi, rekening dan nominal adalah <strong>data contoh fiktif</strong>.
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-muted">
            <li>Data demo hanya ada di peramban ini dan tidak dikirim ke server.</li>
            <li>Data pura sungguhan tidak tersentuh sama sekali.</li>
            <li>Donasi &quot;simulasi&quot; ditandai dengan jelas dan bukan uang sungguhan.</li>
            <li>Keluar dari mode demo melalui menu profil atau tombol &quot;Keluar demo&quot;.</li>
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
