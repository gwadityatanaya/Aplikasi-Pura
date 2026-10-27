"use client";
import { useEffect, useState } from "react";
import { Download, Share, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();

/** Registers the service worker (production only) and captures the browser's install prompt. */
export function PwaRegister() {
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferred = e as InstallEvent;
      listeners.forEach((l) => l());
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  return null;
}

export function InstallAppButton({ className }: { className?: string }) {
  const [, force] = useState(0);
  const [help, setHelp] = useState(false);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    return () => {
      listeners.delete(l);
    };
  }, []);
  if (installed) return <p className="text-sm font-semibold text-emerald-700">✓ Aplikasi sudah terpasang di perangkat ini.</p>;
  return (
    <>
      <Button
        className={className}
        variant="secondary"
        onClick={async () => {
          if (deferred) {
            await deferred.prompt();
            deferred = null;
          } else setHelp(true);
        }}
      >
        <Download className="h-4 w-4" /> Pasang aplikasi
      </Button>
      <Dialog open={help} onClose={() => setHelp(false)} title="Cara memasang PURA di HP">
        <div className="space-y-4 pb-2 text-[15px]">
          <div className="rounded-2xl bg-ivory p-4">
            <p className="flex items-center gap-2 font-bold"><Smartphone className="h-5 w-5 text-emerald-700" /> Android (Chrome)</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-charcoal/80">
              <li>Ketuk tombol menu <strong>⋮</strong> di kanan atas.</li>
              <li>Pilih <strong>Instal aplikasi</strong> atau <strong>Tambahkan ke layar utama</strong>.</li>
            </ol>
          </div>
          <div className="rounded-2xl bg-ivory p-4">
            <p className="flex items-center gap-2 font-bold"><Share className="h-5 w-5 text-emerald-700" /> iPhone (Safari)</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-charcoal/80">
              <li>Ketuk tombol <strong>Bagikan</strong> (kotak dengan panah ke atas).</li>
              <li>Pilih <strong>Tambah ke Layar Utama</strong>, lalu <strong>Tambah</strong>.</li>
            </ol>
          </div>
        </div>
      </Dialog>
    </>
  );
}
