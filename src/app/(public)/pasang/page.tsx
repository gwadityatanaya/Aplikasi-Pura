"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Download, EllipsisVertical, PlusSquare, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/format";

type Platform = "android" | "iphone";
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** A simple phone frame with one highlighted element, drawn in CSS so it loads instantly. */
function Phone({ children, caption }: { children: React.ReactNode; caption: string }) {
  return (
    <figure className="mx-auto w-full max-w-[220px]">
      <div className="relative aspect-[9/16] overflow-hidden rounded-[28px] border-[6px] border-charcoal bg-white shadow-lift">{children}</div>
      <figcaption className="mt-2 text-center text-sm text-muted">{caption}</figcaption>
    </figure>
  );
}
const Bar = ({ className }: { className?: string }) => <div className={cn("h-2.5 rounded-full bg-stone-200", className)} />;
const Pulse = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={cn("absolute grid place-items-center rounded-full bg-emerald-600 text-white ring-8 ring-emerald-500/25", className)}>{children}</div>
);

function Page() {
  return (
    <div className="space-y-2 p-3 pt-10">
      <div className="h-16 rounded-xl bg-gradient-to-br from-emerald-600 to-forest" />
      <Bar className="w-3/4" />
      <Bar className="w-1/2" />
      <Bar className="w-2/3" />
    </div>
  );
}

const STEPS: Record<Platform, { title: string; body: React.ReactNode; art: React.ReactNode }[]> = {
  android: [
    {
      title: "Buka aplikasi ini di Google Chrome",
      body: "Ketik alamat aplikasi di Chrome (ikon bulat merah-kuning-hijau).",
      art: <Phone caption="Halaman PURA di Chrome"><div className="absolute inset-x-0 top-0 flex h-8 items-center gap-1 bg-stone-100 px-2"><div className="h-4 flex-1 rounded-full bg-white" /><EllipsisVertical className="h-4 w-4 text-stone-500" /></div><Page /></Phone>,
    },
    {
      title: "Ketuk tombol titik tiga ⋮ di kanan atas",
      body: "Letaknya di sebelah kanan kotak alamat.",
      art: <Phone caption="Ketuk ⋮"><div className="absolute inset-x-0 top-0 flex h-8 items-center gap-1 bg-stone-100 px-2"><div className="h-4 flex-1 rounded-full bg-white" /></div><Pulse className="right-1 top-1 h-7 w-7"><EllipsisVertical className="h-4 w-4" /></Pulse><Page /></Phone>,
    },
    {
      title: "Pilih \"Instal aplikasi\" atau \"Tambahkan ke layar utama\"",
      body: "Lalu ketuk \"Instal\". Ikon PURA akan muncul di layar HP Anda.",
      art: (
        <Phone caption="Pilih Instal aplikasi">
          <Page />
          <div className="absolute right-2 top-9 w-[75%] space-y-2 rounded-xl bg-white p-3 text-[11px] shadow-lift ring-1 ring-black/5">
            <Bar className="w-2/3" /><Bar className="w-1/2" />
            <div className="flex items-center gap-1.5 rounded-lg bg-mint p-1.5 font-bold text-emerald-900"><Download className="h-3.5 w-3.5" /> Instal aplikasi</div>
            <Bar className="w-3/5" />
          </div>
        </Phone>
      ),
    },
  ],
  iphone: [
    {
      title: "Buka aplikasi ini di Safari",
      body: "Harus Safari (ikon kompas biru). Di Chrome iPhone tombolnya tidak ada.",
      art: <Phone caption="Halaman PURA di Safari"><Page /><div className="absolute inset-x-0 bottom-0 flex h-9 items-center justify-around bg-stone-100"><Share className="h-4 w-4 text-sky-600" /><div className="h-3 w-3 rounded bg-stone-300" /></div></Phone>,
    },
    {
      title: "Ketuk tombol Bagikan",
      body: "Kotak dengan panah ke atas, di bawah layar (iPad: di atas).",
      art: <Phone caption="Ketuk Bagikan"><Page /><div className="absolute inset-x-0 bottom-0 h-9 bg-stone-100" /><Pulse className="bottom-0.5 left-1/2 h-8 w-8 -translate-x-1/2"><Share className="h-4 w-4" /></Pulse></Phone>,
    },
    {
      title: "Gulir ke bawah, pilih \"Tambah ke Layar Utama\"",
      body: "Lalu ketuk \"Tambah\" di kanan atas. Ikon PURA muncul di layar HP Anda.",
      art: (
        <Phone caption="Tambah ke Layar Utama">
          <div className="absolute inset-x-0 bottom-0 space-y-2 rounded-t-2xl bg-stone-50 p-3 text-[11px] shadow-lift">
            <Bar className="w-1/2" /><Bar className="w-2/3" />
            <div className="flex items-center gap-1.5 rounded-lg bg-mint p-1.5 font-bold text-emerald-900"><PlusSquare className="h-3.5 w-3.5" /> Tambah ke Layar Utama</div>
            <Bar className="w-1/2" />
          </div>
        </Phone>
      ),
    },
  ],
};

export default function InstallGuide() {
  const [platform, setPlatform] = useState<Platform>("android");
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) setPlatform("iphone");
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  return (
    <div className="container max-w-3xl py-8">
      <h1 className="text-3xl font-extrabold text-forest">Pasang PURA di HP</h1>
      <p className="mt-2 text-lg text-muted">Tanpa Play Store, gratis, dan hemat kuota. Setelah dipasang, PURA terbuka seperti aplikasi biasa dari layar HP.</p>

      {installed && <p className="mt-4 flex items-center gap-2 rounded-2xl bg-mint p-4 font-semibold text-emerald-900"><CheckCircle2 className="h-5 w-5" /> PURA sudah terpasang di perangkat ini.</p>}
      {prompt && !installed && (
        <Card className="mt-5 p-5">
          <p className="font-bold">HP Anda bisa memasang langsung</p>
          <Button size="xl" className="mt-3 w-full" onClick={async () => { await prompt.prompt(); const c = await prompt.userChoice; if (c.outcome === "accepted") setInstalled(true); setPrompt(null); }}>
            <Download className="h-5 w-5" /> Pasang sekarang
          </Button>
        </Card>
      )}

      <div className="mt-6">
        <Segmented<Platform>
          value={platform}
          onChange={setPlatform}
          className="flex w-full"
          ariaLabel="Jenis HP"
          options={[{ value: "android", label: "HP Android (Chrome)" }, { value: "iphone", label: "iPhone (Safari)" }]}
        />
      </div>

      <ol className="mt-6 space-y-8">
        {STEPS[platform].map((s, i) => (
          <li key={s.title} className="grid items-center gap-4 sm:grid-cols-[1fr_220px]">
            <div>
              <p className="flex items-center gap-3 text-xl font-bold"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">{i + 1}</span>{s.title}</p>
              <p className="mt-2 pl-12 text-[17px] text-muted">{s.body}</p>
            </div>
            {s.art}
          </li>
        ))}
      </ol>

      <Card className="mt-10 p-5 text-[15px]">
        <p className="font-bold">Tips untuk HP sederhana</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          <li>Tampilan aplikasi (ikon, huruf, kode) disimpan di HP, jadi berikutnya terbuka lebih cepat dan hemat kuota.</li>
          <li>Jika sinyal hilang, PURA memberi tahu dan tidak ada data yang hilang — coba lagi saat sinyal kembali.</li>
          <li>Foto bukti otomatis diperkecil sebelum dikirim agar hemat kuota.</li>
          <li>Jika tombol pasang tidak muncul, perbarui Chrome atau Safari ke versi terbaru.</li>
        </ul>
      </Card>
    </div>
  );
}
