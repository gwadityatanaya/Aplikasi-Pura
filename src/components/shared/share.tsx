"use client";
import { useEffect, useState } from "react";
import { Check, Copy, QrCode, Share2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/format";

export function useAbsoluteUrl(path: string) {
  const [url, setUrl] = useState(path);
  useEffect(() => setUrl(`${window.location.origin}${path}`), [path]);
  return url;
}

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  );
}

export function whatsappLink(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function ShareActions({
  path,
  title,
  message,
  className,
  compact,
}: {
  path: string;
  title: string;
  message: string;
  className?: string;
  compact?: boolean;
}) {
  const url = useAbsoluteUrl(path);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator !== "undefined" && !!navigator.share), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Tautan disalin");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Tidak dapat menyalin. Salin manual: " + url);
    }
  }
  async function nativeShare() {
    try {
      await navigator.share({ title, text: message, url });
    } catch {
      /* cancelled */
    }
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <a
        href={whatsappLink(`${message}\n\n${url}`)}
        target="_blank"
        rel="noopener noreferrer"
        className="press inline-flex h-11 items-center gap-2 rounded-xl bg-[#1FAF55] px-4 text-sm font-bold text-white hover:bg-[#199a4a]"
      >
        <WhatsAppIcon className="h-5 w-5" /> {compact ? "WhatsApp" : "Bagikan ke WhatsApp"}
      </a>
      <Button variant="outline" onClick={copy} className="h-11">
        {copied ? <Check className="h-4 w-4 text-income" /> : <Copy className="h-4 w-4" />} Salin tautan
      </Button>
      <Button variant="outline" onClick={() => setQr(true)} className="h-11">
        <QrCode className="h-4 w-4" /> Kode QR
      </Button>
      {canShare && (
        <Button variant="outline" onClick={nativeShare} className="h-11" aria-label="Bagikan lainnya">
          <Share2 className="h-4 w-4" />
        </Button>
      )}
      <Dialog open={qr} onClose={() => setQr(false)} title="Pindai untuk membuka" description={title} size="sm">
        <QrBlock url={url} />
      </Dialog>
    </div>
  );
}

export function QrBlock({ url, size = 220 }: { url: string; size?: number }) {
  function download() {
    const svg = document.getElementById("pura-qr");
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "kode-qr-pura.svg";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <div className="rounded-3xl border border-line bg-white p-5 shadow-soft">
        <QRCodeSVG id="pura-qr" value={url} size={size} fgColor="#064E3B" level="M" includeMargin={false} />
      </div>
      <p className="max-w-xs break-all text-center text-xs text-muted">{url}</p>
      <Button variant="secondary" onClick={download}>
        Unduh kode QR
      </Button>
    </div>
  );
}
