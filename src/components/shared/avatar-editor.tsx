"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Trash2 } from "lucide-react";
import { Avatar, avatarSrc } from "@/components/shared/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm";
import { useStore } from "@/lib/store";
import type { User } from "@/lib/types";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE = 15 * 1024 * 1024; // the original from the phone; it is made small before sending
const OUT = 256; // stored size in pixels
const TARGET = 50_000; // ≈ 50 KB
const VIEW = 240; // crop window on screen

/** Square crop + resize on the device, so only a small photo (≈256×256, ≈50 KB) is uploaded. */
export async function cropToDataUrl(img: HTMLImageElement, crop: { x: number; y: number; zoom: number }) {
  const base = VIEW / Math.min(img.naturalWidth, img.naturalHeight);
  const scale = base * crop.zoom;
  const canvas = document.createElement("canvas");
  canvas.width = OUT;
  canvas.height = OUT;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, OUT, OUT);
  g.imageSmoothingQuality = "high";
  g.drawImage(img, -crop.x / scale, -crop.y / scale, VIEW / scale, VIEW / scale, 0, 0, OUT, OUT);
  const bytes = (d: string) => Math.ceil(((d.length - d.indexOf(",") - 1) * 3) / 4);
  let out = "";
  for (const type of ["image/webp", "image/jpeg"]) {
    for (let q = 0.86; q >= 0.4; q -= 0.08) {
      out = canvas.toDataURL(type, q);
      if (!out.startsWith(`data:${type}`)) break; // this browser cannot write the type
      if (bytes(out) <= TARGET) return out;
    }
  }
  return out;
}

export function AvatarEditor({ user }: { user: User }) {
  const run = useStore((s) => s.run);
  const refresh = useStore((s) => s.refresh);
  const input = useRef<HTMLInputElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0, zoom: 1 });
  const [busy, setBusy] = useState(false);
  const [askRemove, setAskRemove] = useState(false);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  const size = img ? { w: (img.naturalWidth * VIEW * crop.zoom) / Math.min(img.naturalWidth, img.naturalHeight), h: (img.naturalHeight * VIEW * crop.zoom) / Math.min(img.naturalWidth, img.naturalHeight) } : { w: VIEW, h: VIEW };
  const clamp = (c: { x: number; y: number; zoom: number }) => {
    if (!img) return c;
    const k = (VIEW * c.zoom) / Math.min(img.naturalWidth, img.naturalHeight);
    const w = img.naturalWidth * k;
    const h = img.naturalHeight * k;
    return { zoom: c.zoom, x: Math.min(0, Math.max(VIEW - w, c.x)), y: Math.min(0, Math.max(VIEW - h, c.y)) };
  };
  useEffect(() => () => { if (img) URL.revokeObjectURL(img.src); }, [img]);

  function pick(file: File | undefined) {
    if (input.current) input.current.value = "";
    if (!file) return;
    if (!TYPES.includes(file.type)) return toast.error("Pilih foto berformat JPG, PNG, atau WEBP.");
    if (file.size > MAX_FILE) return toast.error("Foto terlalu besar (maks. 15 MB).");
    const el = new Image();
    el.onload = () => {
      const k = VIEW / Math.min(el.naturalWidth, el.naturalHeight);
      setCrop({ zoom: 1, x: (VIEW - el.naturalWidth * k) / 2, y: (VIEW - el.naturalHeight * k) / 2 });
      setImg(el);
    };
    el.onerror = () => toast.error("Foto ini tidak bisa dibuka. Coba foto lain (JPG atau PNG).");
    el.src = URL.createObjectURL(file);
  }

  async function save() {
    if (!img) return;
    setBusy(true);
    const r = await run("setMyAvatar", { image: await cropToDataUrl(img, crop) });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    setImg(null);
    await refresh();
    toast.success("Foto profil disimpan");
  }

  async function remove() {
    setAskRemove(false);
    const r = await run("removeMyAvatar", {});
    if (!r.ok) return toast.error(r.error);
    await refresh();
    toast.success("Foto profil dihapus");
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar name={user.name} color={user.avatarColor} src={avatarSrc(user)} size={72} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Foto profil</p>
        <p className="text-sm text-muted">Hanya terlihat oleh Anda, pengurus pura/banjar yang bekerja bersama Anda, dan Admin Utama. Tidak pernah tampil di halaman publik atau laporan.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => input.current?.click()}><Camera className="h-4 w-4" /> {user.avatarVersion ? "Ganti foto" : "Pilih foto"}</Button>
          {user.avatarVersion && <Button size="sm" variant="ghost" className="text-expense" onClick={() => setAskRemove(true)}><Trash2 className="h-4 w-4" /> Hapus foto</Button>}
        </div>
        <input ref={input} type="file" accept={TYPES.join(",")} className="sr-only" aria-label="Pilih foto profil" onChange={(e) => pick(e.target.files?.[0])} />
      </div>

      <Dialog open={!!img} onClose={() => setImg(null)} title="Potong foto" description="Geser foto dan atur besarnya. Bagian di dalam kotak yang disimpan." footer={<Button size="lg" className="w-full" loading={busy} onClick={save}>Simpan foto</Button>}>
        {img && (
          <div className="flex flex-col items-center gap-4">
            <div
              role="img"
              aria-label="Area potong foto. Geser untuk mengatur posisi, atau pakai tombol panah."
              tabIndex={0}
              className="relative touch-none select-none overflow-hidden rounded-2xl bg-stone-200 outline-none ring-emerald-500 focus-visible:ring-4"
              style={{ width: VIEW, height: VIEW }}
              onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { px: e.clientX, py: e.clientY, x: crop.x, y: crop.y }; }}
              onPointerMove={(e) => { const d = drag.current; if (d) setCrop(clamp({ ...crop, x: d.x + e.clientX - d.px, y: d.y + e.clientY - d.py })); }}
              onPointerUp={() => (drag.current = null)}
              onKeyDown={(e) => {
                const step = { ArrowLeft: [8, 0], ArrowRight: [-8, 0], ArrowUp: [0, 8], ArrowDown: [0, -8] }[e.key];
                if (step) { e.preventDefault(); setCrop(clamp({ ...crop, x: crop.x + step[0], y: crop.y + step[1] })); }
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.src} alt="" draggable={false} className="pointer-events-none absolute max-w-none" style={{ left: crop.x, top: crop.y, width: size.w, height: size.h }} />
              <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_0_0_2px_rgba(255,255,255,.9)]" />
              <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgba(0,0,0,.35)]" />
            </div>
            <label className="flex w-full max-w-[240px] items-center gap-3 text-sm font-semibold">
              Perbesar
              <input
                type="range" min={1} max={4} step={0.05} value={crop.zoom} className="flex-1 accent-emerald-600"
                onChange={(e) => {
                  // Zoom around the middle of the crop window.
                  const z = Number(e.target.value);
                  const r = z / crop.zoom;
                  setCrop(clamp({ zoom: z, x: VIEW / 2 - (VIEW / 2 - crop.x) * r, y: VIEW / 2 - (VIEW / 2 - crop.y) * r }));
                }}
              />
            </label>
          </div>
        )}
      </Dialog>
      <ConfirmDialog open={askRemove} onClose={() => setAskRemove(false)} title="Hapus foto profil?" description="Foto dihapus dari server. Inisial nama akan dipakai lagi." confirmLabel="Hapus foto" tone="danger" onConfirm={remove} />
    </div>
  );
}
