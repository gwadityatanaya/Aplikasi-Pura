"use client";
import * as React from "react";
import { Camera, FileImage, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/format";
import { toast } from "sonner";

/** Compress an image file into a JPEG data URL so it fits comfortably in LocalStorage. */
export async function compressImage(file: File, maxSize = 900, quality = 0.72): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

export function ImageUpload({
  value,
  onChange,
  label = "Foto nota / bukti",
  allowCamera = true,
  compact,
}: {
  value?: string;
  onChange: (dataUrl?: string, name?: string) => void;
  label?: string;
  allowCamera?: boolean;
  compact?: boolean;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const camRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  async function handle(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Untuk prototipe ini, unggah file gambar (JPG/PNG). PDF belum didukung.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast.error("Ukuran file terlalu besar (maks. 12 MB).");
      return;
    }
    setBusy(true);
    try {
      const url = await compressImage(file);
      onChange(url, file.name);
    } catch {
      toast.error("Gambar tidak dapat dibaca. Coba file lain.");
    } finally {
      setBusy(false);
    }
  }

  if (value) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-line bg-ivory">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value} alt={label} className={cn("w-full object-contain", compact ? "max-h-40" : "max-h-64")} />
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="press absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-sm font-semibold text-expense shadow"
        >
          <Trash2 className="h-4 w-4" /> Hapus
        </button>
      </div>
    );
  }

  return (
    <div className={cn("grid gap-2", allowCamera ? "grid-cols-2" : "grid-cols-1")}>
      <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => handle(e.target.files?.[0])} aria-label={`Unggah ${label}`} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => handle(e.target.files?.[0])} aria-label={`Foto ${label} dengan kamera`} />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="press flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-ivory/60 px-3 py-5 text-sm font-semibold text-charcoal hover:border-emerald-400 hover:bg-mint/50"
      >
        {busy ? <FileImage className="h-6 w-6 animate-pulse text-emerald-600" /> : <Upload className="h-6 w-6 text-emerald-600" />}
        Pilih dari galeri
      </button>
      {allowCamera && (
        <button
          type="button"
          onClick={() => camRef.current?.click()}
          disabled={busy}
          className="press flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-ivory/60 px-3 py-5 text-sm font-semibold text-charcoal hover:border-emerald-400 hover:bg-mint/50"
        >
          <Camera className="h-6 w-6 text-emerald-600" />
          Foto dengan kamera
        </button>
      )}
    </div>
  );
}
