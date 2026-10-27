"use client";
import { Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon, whatsappLink } from "@/components/shared/share";

/** Shows a one-time activation / reset link so the admin can send it via WhatsApp. */
export function LinkDialog({ link, name, hours, purpose, onClose }: { link: string | null; name?: string; hours?: number; purpose: "activation" | "reset"; onClose: () => void }) {
  const msg =
    purpose === "activation"
      ? `Om Swastyastu ${name ?? ""}. Anda ditambahkan sebagai pengurus di aplikasi PURA. Buka tautan ini untuk membuat kata sandi (berlaku ${hours ?? 72} jam, sekali pakai):\n${link}`
      : `Om Swastyastu ${name ?? ""}. Ini tautan untuk membuat kata sandi baru di aplikasi PURA (berlaku ${hours ?? 24} jam, sekali pakai):\n${link}`;
  return (
    <Dialog open={!!link} onClose={onClose} title={purpose === "activation" ? "Kirim tautan aktivasi" : "Kirim tautan atur ulang sandi"} description="Tautan ini hanya ditampilkan sekarang. Kirimkan langsung ke orang yang bersangkutan.">
      <div className="space-y-4 pb-2">
        <div className="flex items-start gap-3 rounded-2xl bg-ivory p-4">
          <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <p className="break-all font-mono text-sm">{link}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <a href={whatsappLink(msg)} target="_blank" rel="noopener noreferrer" className="press inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#1FAF55] font-semibold text-white">
            <WhatsAppIcon className="h-5 w-5" /> Kirim via WhatsApp
          </a>
          <Button size="lg" variant="outline" onClick={() => { navigator.clipboard?.writeText(link ?? ""); toast.success("Tautan disalin"); }}>
            <Copy className="h-4 w-4" /> Salin tautan
          </Button>
        </div>
        <p className="text-sm text-muted">Berlaku {hours ?? (purpose === "activation" ? 72 : 24)} jam dan hanya bisa dipakai sekali. Jangan bagikan di grup umum.</p>
      </div>
    </Dialog>
  );
}
