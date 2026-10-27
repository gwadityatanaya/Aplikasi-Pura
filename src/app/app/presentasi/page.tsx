"use client";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Maximize, Minimize, X } from "lucide-react";
import { PatternBg, OrnamentDivider } from "@/components/brand/ornament";
import { PuraGlyph } from "@/components/brand/logo";
import { CategoryBars, ChartLegend, FlowChart } from "@/components/shared/charts";
import { Progress } from "@/components/ui/progress";
import { useWorkspace } from "@/components/app/hooks";
import { useStore } from "@/lib/store";
import { byCategory, campaignStats, monthlyCashflow, summarize } from "@/lib/ledger";
import { cn, formatDate, formatPercent, rupiah, todayISO } from "@/lib/format";

function Deck() {
  const params = useSearchParams();
  const hydrated = useStore((s) => s.hydrated);
  const ws = useWorkspace();
  const today = todayISO();
  const from = params.get("from") ?? `${today.slice(0, 4)}-01-01`;
  const to = params.get("to") ?? today;
  const auto = params.get("auto") === "1";
  const [i, setI] = useState(0);
  const [fs, setFs] = useState(false);

  const d = useMemo(() => {
    const s = summarize(ws.data, ws.templeId, { from, to });
    const rows = ws.transactions.filter((t) => t.date >= from && t.date <= to);
    return {
      s,
      inc: byCategory(rows, ws.categories, "income"),
      exp: byCategory(rows, ws.categories, "expense"),
      monthly: monthlyCashflow(ws.data, ws.templeId, from, to).map((r) => ({ label: r.month.split(" ")[0].slice(0, 3), income: r.income, expense: r.expense })),
      campaigns: ws.campaigns.filter((c) => c.status !== "draft").map((c) => ({ c, st: campaignStats(c, ws.donations) })),
    };
  }, [ws, from, to]);

  const period = `${formatDate(from)} – ${formatDate(to)}`;
  const slides = [
    { key: "cover", title: "" },
    { key: "summary", title: "Ringkasan keuangan" },
    { key: "income", title: "Dari mana dana berasal" },
    { key: "expense", title: "Untuk apa dana digunakan" },
    { key: "flow", title: "Arus kas per bulan" },
    { key: "campaign", title: "Penggalangan dana" },
    { key: "end", title: "" },
  ];
  const n = slides.length;
  const go = useCallback((k: number) => setI((x) => Math.max(0, Math.min(n - 1, x + k))), [n]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); go(1); }
      if (["ArrowLeft", "PageUp"].includes(e.key)) go(-1);
      if (e.key.toLowerCase() === "f") toggleFs();
      if (e.key === "Home") setI(0);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);
  useEffect(() => {
    const h = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setI((x) => (x < n - 1 ? x + 1 : x)), 1700);
    return () => clearInterval(t);
  }, [auto, n]);

  function toggleFs() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }

  if (!hydrated || !ws.temple) return <div className="grid min-h-dvh place-items-center bg-forest text-white">Memuat…</div>;
  const slide = slides[i];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ivory text-charcoal" role="region" aria-roledescription="presentasi" aria-label={`Presentasi laporan ${ws.temple.name}`}>
      <header className="no-print flex h-16 shrink-0 items-center gap-3 border-b border-line bg-white px-4 md:px-8">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-forest text-gold-light"><PuraGlyph className="h-6 w-6" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-forest">{ws.temple.name}</p>
          <p className="truncate text-xs text-muted">{period}</p>
        </div>
        <span className="tabular hidden text-sm font-semibold text-muted sm:inline">{i + 1} / {n}</span>
        <button onClick={toggleFs} className="press grid h-11 w-11 place-items-center rounded-xl hover:bg-black/5" aria-label={fs ? "Keluar layar penuh" : "Layar penuh"}>
          {fs ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
        </button>
        <Link href="/app/laporan" className="press grid h-11 w-11 place-items-center rounded-xl hover:bg-black/5" aria-label="Tutup presentasi"><X className="h-6 w-6" /></Link>
      </header>

      <main className="relative min-h-0 flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.section
            key={slide.key}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 overflow-y-auto"
            aria-live="polite"
          >
            {slide.key === "cover" && (
              <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-forest px-6 text-center text-white">
                <PatternBg />
                <PuraGlyph className="relative h-20 w-20 text-gold" />
                <p className="relative mt-6 text-lg font-semibold uppercase tracking-[0.3em] text-gold-light md:text-xl">Laporan Keuangan</p>
                <h1 className="relative mt-3 text-4xl font-extrabold md:text-7xl">{ws.temple.name}</h1>
                <OrnamentDivider className="relative my-8 w-full max-w-lg" />
                <p className="relative text-2xl text-white/85 md:text-3xl">{period}</p>
                <p className="relative mt-10 text-base text-white/60">Tekan → atau ketuk tombol di bawah untuk melanjutkan</p>
              </div>
            )}
            {slide.key !== "cover" && slide.key !== "end" && (
              <div className="mx-auto flex min-h-full max-w-6xl flex-col px-6 py-8 md:px-12 md:py-12">
                <h2 className="text-3xl font-extrabold text-forest md:text-5xl">{slide.title}</h2>
                <div className="mt-8 flex-1 md:mt-12">
                  {slide.key === "summary" && (
                    <div className="grid gap-5 md:grid-cols-2">
                      <Big label="Saldo awal" value={d.s.openingBalance} />
                      <Big label="Saldo akhir" value={d.s.closingBalance} accent />
                      <Big label="Total pemasukan" value={d.s.income} icon={<ArrowDownLeft className="h-8 w-8 text-income" />} />
                      <Big label="Total pengeluaran" value={d.s.expense} icon={<ArrowUpRight className="h-8 w-8 text-expense" />} />
                      <p className="text-xl text-muted md:col-span-2">
                        Saldo awal {rupiah(d.s.openingBalance)} + pemasukan {rupiah(d.s.income)} − pengeluaran {rupiah(d.s.expense)} = <strong className="text-forest">{rupiah(d.s.closingBalance)}</strong>
                      </p>
                    </div>
                  )}
                  {slide.key === "income" && <CategoryBars rows={d.inc} large limit={6} />}
                  {slide.key === "expense" && <CategoryBars rows={d.exp} tone="expense" large limit={6} />}
                  {slide.key === "flow" && (
                    <div>
                      <ChartLegend large />
                      <div className="mt-6"><FlowChart data={d.monthly} height={420} large /></div>
                    </div>
                  )}
                  {slide.key === "campaign" && (
                    <div className="grid gap-6 md:grid-cols-2">
                      {d.campaigns.map(({ c, st }) => (
                        <div key={c.id} className="rounded-3xl border border-line bg-white p-6 shadow-soft">
                          <p className="text-2xl font-bold leading-snug">{c.title}</p>
                          <p className="tabular mt-4 text-4xl font-extrabold text-forest">{rupiah(st.collected)}</p>
                          <p className="text-lg text-muted">dari {rupiah(c.target)} · {st.contributors} donatur</p>
                          <Progress value={st.progress} className="mt-4" height="h-4" label={c.title} />
                          <p className="tabular mt-2 text-xl font-bold text-emerald-700">{formatPercent(st.progress)}</p>
                        </div>
                      ))}
                      {!d.campaigns.length && <p className="text-2xl text-muted">Tidak ada penggalangan dana pada periode ini.</p>}
                    </div>
                  )}
                </div>
              </div>
            )}
            {slide.key === "end" && (
              <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-forest px-6 text-center text-white">
                <PatternBg />
                <p className="relative text-5xl font-extrabold md:text-7xl">Suksma</p>
                <OrnamentDivider className="relative my-8 w-full max-w-md" />
                <p className="relative max-w-2xl text-xl text-white/85 md:text-2xl">Terima kasih atas kepercayaan dan punia krama sekalian. Laporan lengkap dapat diunduh di halaman publik pura.</p>
                <p className="relative mt-8 text-lg text-gold-light">{ws.temple.branding.signatoryName} · {ws.temple.branding.signatoryRole}</p>
              </div>
            )}
          </motion.section>
        </AnimatePresence>
      </main>

      <footer className="no-print flex h-20 shrink-0 items-center justify-between gap-4 border-t border-line bg-white px-4 md:px-8">
        <button onClick={() => go(-1)} disabled={i === 0} className="press inline-flex h-14 items-center gap-2 rounded-2xl border border-line px-5 text-lg font-semibold disabled:opacity-40" aria-label="Slide sebelumnya">
          <ChevronLeft className="h-6 w-6" /> <span className="hidden sm:inline">Sebelumnya</span>
        </button>
        <div className="flex gap-2" role="tablist" aria-label="Slide">
          {slides.map((s, k) => (
            <button key={s.key} onClick={() => setI(k)} role="tab" aria-selected={k === i} aria-label={`Slide ${k + 1}`} className={cn("h-3 rounded-full transition-all", k === i ? "w-8 bg-emerald-600" : "w-3 bg-stone-300 hover:bg-stone-400")} />
          ))}
        </div>
        <button onClick={() => go(1)} disabled={i === n - 1} className="press inline-flex h-14 items-center gap-2 rounded-2xl bg-emerald-600 px-5 text-lg font-semibold text-white disabled:opacity-40" aria-label="Slide berikutnya">
          <span className="hidden sm:inline">Berikutnya</span> <ChevronRight className="h-6 w-6" />
        </button>
      </footer>
    </div>
  );
}

function Big({ label, value, accent, icon }: { label: string; value: number; accent?: boolean; icon?: React.ReactNode }) {
  return (
    <div className={cn("rounded-3xl p-6 md:p-8", accent ? "bg-forest text-white" : "border border-line bg-white shadow-soft")}>
      <p className={cn("flex items-center gap-3 text-xl md:text-2xl", accent ? "text-white/75" : "text-muted")}>{icon}{label}</p>
      <p className="tabular mt-2 text-4xl font-extrabold md:text-6xl">{rupiah(value)}</p>
    </div>
  );
}

export default function PresentationPage() {
  return (
    <Suspense>
      <Deck />
    </Suspense>
  );
}
