"use client";
import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { cn, todayISO } from "@/lib/format";

const RUN_KEY = "pura-demo-running";

interface Step {
  title: string;
  body: string;
  path: string | (() => string);
  target?: string;
  duration: number;
  run?: () => void;
}

interface DemoCtx {
  running: boolean;
  paused: boolean;
  index: number;
  start: () => void;
  exit: () => void;
}

const Ctx = React.createContext<DemoCtx>({ running: false, paused: false, index: 0, start: () => {}, exit: () => {} });
export const useDemo = () => React.useContext(Ctx);

// Mutable refs shared by step actions (ids created during the demo)
const demoRefs: { donationId?: string; campaignId?: string } = {};

const STEPS: Step[] = [
  {
    title: "Membuka dashboard",
    body: "Inilah beranda pengurus pura. Semua angka dihitung otomatis dari catatan transaksi — tidak ada yang diketik ulang.",
    path: "/app",
    duration: 6500,
  },
  {
    title: "Melihat saldo",
    body: "Kartu saldo menunjukkan total kas tunai dan rekening bank pura, beserta pemasukan dan pengeluaran bulan ini.",
    path: "/app",
    target: "balance",
    duration: 6500,
  },
  {
    title: "Mencatat pengeluaran",
    body: "Mencatat pengeluaran semudah menulis di buku: isi nominal, pilih jenisnya, lalu foto notanya.",
    path: "/app/transaksi/baru?type=expense&demo=1",
    target: "tx-form",
    duration: 8500,
  },
  {
    title: "Dashboard langsung diperbarui",
    body: "Setelah disimpan, saldo berkurang otomatis dan transaksi muncul di daftar terbaru.",
    path: "/app",
    target: "balance",
    duration: 7000,
    run: () => {
      const s = useStore.getState();
      const cat = s.data.categories.find((c) => c.id === "c_durgandhini_upakara");
      s.addTransaction(
        {
          type: "expense",
          amount: 425_000,
          date: todayISO(),
          categoryId: cat?.id,
          description: "Bunga, janur & buah untuk banten Piodalan",
          accountId: "acc_dg_kas",
          activityId: "a_piodalan",
          status: "confirmed",
          notes: "Dicatat saat demo",
        },
        "demo-expense"
      );
      toast.success("Pengeluaran Rp425.000 tersimpan", { description: "Saldo kas diperbarui otomatis." });
    },
  },
  {
    title: "Membuat campaign penggalangan dana",
    body: "Wizard 4 langkah membantu membuat halaman donasi: judul, target, rekening resmi, lalu publikasikan.",
    path: "/app/campaign/baru?demo=1",
    target: "campaign-wizard",
    duration: 9000,
  },
  {
    title: "Simulasi donasi masuk",
    body: "Contoh: I Made Surya mengirim dana punia Rp500.000. Donasi masuk dulu sebagai \"menunggu verifikasi\" — belum dihitung.",
    path: "/app/campaign/cp_piodalan?tab=verifikasi",
    target: "pending-donations",
    duration: 7500,
    run: () => {
      const s = useStore.getState();
      if (!s.data.campaigns.some((c) => c.title === "Punia Penjor Galungan Banjar (Demo)")) {
        const c = s.saveCampaign(
          {
            title: "Punia Penjor Galungan Banjar (Demo)",
            description: "Campaign contoh yang dibuat selama demo.",
            cover: "gold",
            activityId: "a_operasional",
            target: 5_000_000,
            startDate: todayISO(),
            endDate: "2026-12-20",
            purpose: "Penjor dan banten Galungan",
            accountId: "acc_dg_bank",
            instructions: "Transfer ke rekening resmi pura.",
            manualVerification: true,
            showDonorList: true,
            defaultPrivacy: "public",
          },
          "active"
        );
        c.then((r) => r.ok && (demoRefs.campaignId = r.value.id));
        toast.success("Campaign dipublikasikan", { description: "Langsung tampil di portal publik." });
      }
      const r = s.addDonation({
        campaignId: "cp_piodalan",
        donorName: "I Made Surya",
        amount: 500_000,
        date: todayISO(),
        privacy: "public",
        channel: "simulasi",
        simulated: true,
        message: "Rahajeng Piodalan! (simulasi)",
      });
      r.then((x) => x.ok && (demoRefs.donationId = x.value.id));
      toast("Donasi baru (simulasi)", { description: "I Made Surya — Rp500.000 menunggu verifikasi." });
    },
  },
  {
    title: "Memverifikasi donasi",
    body: "Bendahara mengecek mutasi rekening, lalu menekan Verifikasi. Sistem otomatis membuat satu catatan pemasukan — tidak bisa tercatat ganda.",
    path: "/app/campaign/cp_piodalan?tab=verifikasi",
    target: "campaign-progress",
    duration: 7500,
    run: () => {
      const s = useStore.getState();
      if (demoRefs.donationId) {
        s.verifyDonation(demoRefs.donationId).then((r) => r.ok && toast.success("Donasi terverifikasi", { description: `Tercatat sebagai ${r.value.number}.` }));
      }
    },
  },
  {
    title: "Progres campaign bertambah",
    body: "Total terkumpul, jumlah donatur, dan persentase target langsung diperbarui dari donasi yang sudah terverifikasi.",
    path: "/app/campaign/cp_piodalan",
    target: "campaign-progress",
    duration: 6500,
  },
  {
    title: "Halaman publik campaign",
    body: "Umat dapat melihat progres dan daftar donatur — sesuai izin masing-masing donatur — tanpa perlu membuat akun.",
    path: "/donasi/dana-punia-piodalan-november-2026",
    target: "donor-list",
    duration: 8000,
  },
  {
    title: "Membuat laporan keuangan",
    body: "Pilih periode, lalu laporan tersusun otomatis. Bisa diunduh PDF, Excel, CSV, atau dibagikan ringkasannya lewat WhatsApp.",
    path: "/app/laporan?preset=bulan-ini",
    target: "report-preview",
    duration: 8000,
  },
  {
    title: "Mode presentasi",
    body: "Untuk paruman atau sangkep: tampilkan laporan layar penuh dengan huruf besar di proyektor. Gunakan tombol panah untuk berpindah slide.",
    path: "/app/presentasi?auto=1",
    duration: 12000,
  },
];

export function DemoTourProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useStore((s) => s.hydrated);
  const [running, setRunning] = React.useState(false);
  const [paused, setPaused] = React.useState(false);
  const [index, setIndex] = React.useState(0);
  const [finished, setFinished] = React.useState(false);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const [elapsed, setElapsed] = React.useState(0);
  const ranRef = React.useRef<Set<number>>(new Set());

  // On load: resume a running demo, or restore a backup left behind by an interrupted demo.
  React.useEffect(() => {
    if (!hydrated) return;
    const runFlag = sessionStorage.getItem(RUN_KEY);
    if (runFlag && useStore.getState().mode === "demo") {
      const st = JSON.parse(runFlag) as { index: number; ran: number[] };
      ranRef.current = new Set(st.ran);
      setIndex(st.index);
      setRunning(true);
      setPaused(true);
    } else if (runFlag) sessionStorage.removeItem(RUN_KEY);
  }, [hydrated]);

  const persistRun = React.useCallback((i: number) => {
    sessionStorage.setItem(RUN_KEY, JSON.stringify({ index: i, ran: Array.from(ranRef.current) }));
  }, []);

  const goTo = React.useCallback(
    (i: number) => {
      const step = STEPS[i];
      if (!step) return;
      // run actions for any skipped steps up to i, in order, once
      for (let k = 0; k <= i; k++) {
        if (STEPS[k].run && !ranRef.current.has(k)) {
          ranRef.current.add(k);
          STEPS[k].run!();
        }
      }
      setIndex(i);
      setElapsed(0);
      setFinished(false);
      persistRun(i);
      const path = typeof step.path === "function" ? step.path() : step.path;
      router.push(path);
    },
    [router, persistRun]
  );

  const start = React.useCallback(() => {
    useStore.getState().enterDemo("u_made");
    ranRef.current = new Set();
    demoRefs.donationId = undefined;
    setRunning(true);
    setPaused(false);
    goTo(0);
  }, [goTo]);

  const exit = React.useCallback(async () => {
    sessionStorage.removeItem(RUN_KEY);
    setRunning(false);
    setFinished(false);
    setRect(null);
    await useStore.getState().exitDemo();
    toast.success("Demo selesai", { description: "Kembali ke data sungguhan. Data demo tidak disimpan." });
    router.push(useStore.getState().session ? "/app" : "/");
  }, [router]);

  const restart = React.useCallback(() => {
    start();
  }, [start]);

  // Auto-advance timer
  React.useEffect(() => {
    if (!running || paused || finished) return;
    const tick = 100;
    const t = setInterval(() => {
      setElapsed((e) => {
        const n = e + tick;
        if (n >= STEPS[index].duration) {
          if (index < STEPS.length - 1) {
            setTimeout(() => goTo(index + 1), 0);
          } else {
            setFinished(true);
          }
          return 0;
        }
        return n;
      });
    }, tick);
    return () => clearInterval(t);
  }, [running, paused, finished, index, goTo]);

  // Spotlight target tracking
  React.useEffect(() => {
    if (!running) return;
    const key = STEPS[index]?.target;
    if (!key) {
      setRect(null);
      return;
    }
    let scrolled = false;
    const update = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${key}"]`);
      if (!el) return setRect(null);
      if (!scrolled) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        scrolled = true;
      }
      setRect(el.getBoundingClientRect());
    };
    const t = setInterval(update, 250);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      clearInterval(t);
      window.removeEventListener("scroll", update);
    };
  }, [running, index, pathname]);

  // Keyboard shortcuts while the demo runs (not inside presentation mode, which has its own keys)
  React.useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector('[role="dialog"]')) exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, exit]);

  const step = STEPS[index];
  const value = React.useMemo(() => ({ running, paused, index, start, exit }), [running, paused, index, start, exit]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {running && rect && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[70] rounded-3xl ring-4 ring-gold transition-all duration-300"
          style={{
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            boxShadow: "0 0 0 9999px rgba(23,33,43,0.28)",
          }}
        />
      )}
      <AnimatePresence>
        {running && (
          <motion.aside
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[75] mx-auto max-w-lg md:bottom-6 md:left-auto md:right-6 md:mx-0 md:w-[420px]"
            aria-live="polite"
            aria-label="Panduan demo"
          >
            <div className="overflow-hidden rounded-3xl bg-charcoal text-white shadow-lift ring-1 ring-white/10">
              <div className="h-1 w-full bg-white/10">
                <div
                  className="h-full bg-gold transition-[width] duration-100 ease-linear"
                  style={{ width: finished ? "100%" : `${((index + elapsed / step.duration) / STEPS.length) * 100}%` }}
                />
              </div>
              <div className="p-4 sm:p-5">
                {finished ? (
                  <>
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold">
                      <Sparkles className="h-4 w-4" /> Demo selesai
                    </p>
                    <h3 className="mt-1.5 text-lg font-bold">Suksma telah mencoba PURA!</h3>
                    <p className="mt-1 text-sm leading-relaxed text-white/75">
                      Data demo hanya contoh dan tidak tersimpan ke server. Data pura sungguhan tidak tersentuh.
                    </p>
                    <div className="mt-4 flex gap-2">
                      <button onClick={restart} className="press inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-white/10 text-sm font-semibold hover:bg-white/20">
                        <RotateCcw className="h-4 w-4" /> Ulangi
                      </button>
                      <button onClick={exit} className="press inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gold text-sm font-bold text-charcoal">
                        Selesai
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gold">
                        Demo · Langkah {index + 1} dari {STEPS.length}
                      </p>
                      <button onClick={exit} className="press -mr-1 -mt-1 grid h-8 w-8 place-items-center rounded-full text-white/70 hover:bg-white/10" aria-label="Keluar dari demo">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <AnimatePresence mode="wait">
                      <motion.div key={index} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
                        <h3 className="mt-1 text-lg font-bold leading-snug">{step.title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-white/75">{step.body}</p>
                      </motion.div>
                    </AnimatePresence>
                    <div className="mt-4 flex items-center gap-2">
                      <button onClick={() => index > 0 && goTo(index - 1)} disabled={index === 0} className="press grid h-11 w-11 place-items-center rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40" aria-label="Langkah sebelumnya">
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button onClick={() => setPaused((p) => !p)} className="press inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-white/10 text-sm font-semibold hover:bg-white/20">
                        {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                        {paused ? "Lanjutkan" : "Jeda"}
                      </button>
                      <button onClick={restart} className="press grid h-11 w-11 place-items-center rounded-xl bg-white/10 hover:bg-white/20" aria-label="Mulai ulang demo">
                        <RotateCcw className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => (index < STEPS.length - 1 ? goTo(index + 1) : setFinished(true))}
                        className={cn("press inline-flex h-11 items-center justify-center gap-1 rounded-xl bg-gold px-4 text-sm font-bold text-charcoal")}
                      >
                        Lanjut <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
            <p className="mt-2 text-center text-xs font-medium text-charcoal/70 md:text-right">
              Mode demo memakai data contoh terpisah · Tekan Esc untuk keluar
            </p>
          </motion.aside>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  );
}

export function DemoButton({ className, variant = "dark" }: { className?: string; variant?: "dark" | "light" | "gold" }) {
  const { start, running } = useDemo();
  return (
    <button
      type="button"
      onClick={start}
      disabled={running}
      className={cn(
        "press inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold disabled:opacity-50",
        variant === "dark" && "bg-charcoal text-white hover:bg-black",
        variant === "light" && "bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/25",
        variant === "gold" && "bg-gold text-charcoal hover:bg-[#bf9b58]",
        className
      )}
    >
      <Play className="h-4 w-4 fill-current" /> Jalankan Demo
    </button>
  );
}
