"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ImagePlus, Info, LifeBuoy, X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { compressImage } from "@/components/ui/file-upload";
import { useAccess, useStore } from "@/lib/store";
import { cn } from "@/lib/format";
import { HELP_CATEGORIES, HELP_IMAGE_MAX_BYTES, type HelpCategory } from "@/lib/help";

/** Pages without the button: sign-in/setup, the Bantuan page itself, the full-screen presentation. */
const HIDDEN = ["/masuk", "/setup", "/bantuan", "/app/presentasi", "/offline"];
const TYPES = ["image/jpeg", "image/png", "image/webp"];
const bytes = (d: string) => Math.ceil(((d.length - d.indexOf(",") - 1) * 3) / 4);

/**
 * Floating "Bantuan" button for signed-in people. On phones it sits above the bottom navigation
 * (and above the "Punia" bar of a temple page) and respects the safe area, so it never covers
 * those buttons and never makes the page wider.
 */
export function HelpButton() {
  const pathname = usePathname() ?? "/";
  const me = useStore((s) => s.me);
  const unread = useAccess().help.unread;
  const [open, setOpen] = useState(false);
  if (!me || HIDDEN.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  // Pages with a bar fixed to the bottom on phones: the app's navigation, a temple / campaign page.
  const raised = pathname.startsWith("/app") || /^\/(pura|donasi)\/[^/]+$/.test(pathname);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={unread ? `Bantuan (${unread} balasan baru)` : "Bantuan"}
        className={cn(
          "no-print fixed right-[max(1rem,env(safe-area-inset-right))] z-[41] grid h-12 w-12 place-items-center rounded-full bg-forest text-white shadow-lg shadow-black/20 ring-2 ring-white transition hover:bg-emerald-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400 lg:bottom-6 lg:right-6",
          raised ? "bottom-[calc(5.5rem+env(safe-area-inset-bottom))]" : "bottom-[calc(1rem+env(safe-area-inset-bottom))]"
        )}
      >
        <LifeBuoy className="h-6 w-6" />
        {unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-expense px-1 text-xs font-bold">{unread}</span>}
      </button>
      <HelpForm open={open} onClose={() => setOpen(false)} page={pathname} unread={unread} />
    </>
  );
}

export function HelpForm({ open, onClose, page, unread }: { open: boolean; onClose: () => void; page: string; unread: number }) {
  const run = useStore((s) => s.run);
  const refresh = useStore((s) => s.refresh);
  const [category, setCategory] = useState<HelpCategory>("cara_pakai");
  const [message, setMessage] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    setMessage("");
    setImage(null);
  }, [open]);

  async function pick(f: File | undefined) {
    if (file.current) file.current.value = "";
    if (!f) return;
    if (!TYPES.includes(f.type)) return toast.error("Lampiran harus gambar JPG, PNG, atau WEBP.");
    if (f.size > 15 * 1024 * 1024) return toast.error("Gambar terlalu besar (maks. 15 MB).");
    try {
      let out = await compressImage(f, 1280, 0.72);
      if (bytes(out) > HELP_IMAGE_MAX_BYTES) out = await compressImage(f, 1000, 0.55);
      if (bytes(out) > HELP_IMAGE_MAX_BYTES) return toast.error("Gambar terlalu besar. Coba tangkapan layar yang lebih kecil.");
      setImage(out);
    } catch {
      toast.error("Gambar ini tidak bisa dibuka. Coba gambar lain.");
    }
  }

  async function send() {
    setBusy(true);
    const r = await run("submitHelp", { category, message, page, screen: `${window.innerWidth}x${window.innerHeight}`, image });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    onClose();
    await refresh();
    toast.success("Pesan terkirim. Balasan Admin Utama akan muncul di halaman Bantuan.");
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Pusat bantuan"
      description="Tanya, laporkan masalah, atau usulkan sesuatu kepada Admin Utama."
      footer={<Button size="lg" className="w-full" loading={busy} disabled={message.trim().length < 10} onClick={send}>Kirim pesan</Button>}
    >
      <div className="space-y-4">
        <p className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-[15px] font-semibold text-red-900" role="note">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /> Jangan menulis kata sandi, PIN, kode OTP, atau kode rahasia apa pun di pesan ini.
        </p>
        <Field label="Jenis pesan" htmlFor="help-cat">
          <Select id="help-cat" value={category} onChange={(e) => setCategory(e.target.value as HelpCategory)}>
            {HELP_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        </Field>
        <Field label="Pesan" htmlFor="help-msg" hint="Ceritakan apa yang ingin dilakukan dan apa yang terjadi.">
          <Textarea id="help-msg" rows={4} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>
        <div>
          {image ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="Gambar lampiran" className="h-16 w-16 rounded-lg border border-line object-cover" />
              <Button size="sm" variant="ghost" onClick={() => setImage(null)}><X className="h-4 w-4" /> Hapus gambar</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => file.current?.click()}><ImagePlus className="h-4 w-4" /> Lampirkan gambar (opsional)</Button>
          )}
          <input ref={file} type="file" accept={TYPES.join(",")} className="sr-only" aria-label="Lampiran gambar" onChange={(e) => pick(e.target.files?.[0])} />
        </div>
        <p className="flex items-start gap-2 text-sm text-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Ikut terkirim otomatis agar Admin Utama mudah membantu: halaman ini (<code>{page}</code>), peran Anda, pura terkait, serta jenis perangkat dan browser. Tidak ada data keuangan atau nama donatur.</span>
        </p>
        <Link href="/bantuan" onClick={onClose} className="inline-block font-semibold text-emerald-800 underline">
          Lihat pesan & balasan saya{unread ? ` (${unread} baru)` : ""}
        </Link>
      </div>
    </Dialog>
  );
}
