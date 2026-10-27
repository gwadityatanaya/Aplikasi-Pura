"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  ChevronRight,
  FileBarChart2,
  Landmark,
  Lock,
  Megaphone,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { PatternBg } from "@/components/brand/ornament";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { AnimatedRupiah } from "@/components/ui/animated-number";
import { ChartLegend, FlowChart } from "@/components/shared/charts";
import { TxRow } from "@/components/app/tx-row";
import { useCan, useWorkspace } from "@/components/app/hooks";
import { useCurrentUser } from "@/lib/store";
import { activitySummary, campaignStats, flowSeries, summarize, type Period } from "@/lib/ledger";
import { cn, formatDateLong, formatPercent, greeting, rupiah, todayISO } from "@/lib/format";

export default function DashboardPage() {
  const ws = useWorkspace();
  const user = useCurrentUser();
  const can = useCan();
  const [period, setPeriod] = useState<Period>("monthly");
  const today = todayISO();
  const monthStart = today.slice(0, 8) + "01";

  const stats = useMemo(() => {
    const total = summarize(ws.data, ws.templeId);
    const month = summarize(ws.data, ws.templeId, { from: monthStart, to: today });
    const restricted = ws.activities
      .filter((a) => a.fundType === "restricted")
      .map((a) => ({ a, s: activitySummary(a, ws.transactions) }))
      .filter((r) => r.s.net > 0);
    const restrictedTotal = restricted.reduce((s, r) => s + r.s.net, 0);
    return { total, month, restricted, restrictedTotal };
  }, [ws, monthStart, today]);

  const series = useMemo(() => flowSeries(ws.transactions, period, today), [ws.transactions, period, today]);
  const seriesTotals = series.reduce((acc, r) => ({ income: acc.income + r.income, expense: acc.expense + r.expense }), { income: 0, expense: 0 });
  const recent = useMemo(
    () => [...ws.transactions].sort((a, b) => (b.date === a.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date))).slice(0, 6),
    [ws.transactions]
  );
  const pendingDonations = ws.donations.filter((d) => d.status === "pending");
  const drafts = ws.transactions.filter((t) => t.status === "draft");
  const activeCampaigns = ws.campaigns.filter((c) => c.status === "active");
  const catName = (id?: string) => ws.categories.find((c) => c.id === id);
  const accName = (id: string) => ws.accounts.find((a) => a.id === id)?.name;
  const actName = (id?: string) => ws.activities.find((a) => a.id === id)?.name;

  const quick = [
    { href: "/app/transaksi/baru?type=income", label: "Catat Pemasukan", icon: ArrowDownLeft, tone: "bg-mint text-emerald-700", show: can("tx.create") || can("tx.draft") },
    { href: "/app/transaksi/baru?type=expense", label: "Catat Pengeluaran", icon: ArrowUpRight, tone: "bg-orange-50 text-orange-700", show: can("tx.create") || can("tx.draft") },
    { href: "/app/campaign/baru", label: "Buat Campaign", icon: Megaphone, tone: "bg-gold-light text-gold-dark", show: can("campaign.manage") },
    { href: "/app/laporan", label: "Buat Laporan", icon: FileBarChart2, tone: "bg-violet-50 text-violet-700", show: can("report.view") },
  ].filter((q) => q.show);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted">{formatDateLong(today)}</p>
        <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-forest md:text-3xl">
          {greeting()}, {user?.callName}!
        </h1>
        <p className="text-[15px] text-muted">{ws.temple?.name}</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        {/* BALANCE CARD */}
        <motion.section
          data-tour="balance"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-emerald-600 via-emerald-800 to-forest p-6 text-white shadow-card md:p-7"
          aria-label="Saldo kas"
        >
          <PatternBg />
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold/20 blur-3xl" aria-hidden />
          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-white/75">Saldo Kas Terkini</p>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-gold-light ring-1 ring-white/15">Kas + Bank</span>
            </div>
            <AnimatedRupiah value={stats.total.closingBalance} className="tabular mt-1 block text-[2.4rem] font-extrabold leading-tight tracking-tight md:text-5xl" />
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/10 p-3.5 ring-1 ring-white/10">
                <p className="flex items-center gap-1.5 text-xs font-medium text-white/70"><Banknote className="h-4 w-4" /> Kas tunai</p>
                <AnimatedRupiah value={stats.total.cash} className="tabular mt-1 block text-lg font-bold" />
              </div>
              <div className="rounded-2xl bg-white/10 p-3.5 ring-1 ring-white/10">
                <p className="flex items-center gap-1.5 text-xs font-medium text-white/70"><Landmark className="h-4 w-4" /> Rekening bank</p>
                <AnimatedRupiah value={stats.total.bank} className="tabular mt-1 block text-lg font-bold" />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/15 pt-4 text-sm">
              <span className="flex items-center gap-1.5 text-white/80">
                <ArrowDownLeft className="h-4 w-4 text-emerald-300" /> Masuk bulan ini <strong className="tabular text-white">{rupiah(stats.month.income)}</strong>
              </span>
              <span className="flex items-center gap-1.5 text-white/80">
                <ArrowUpRight className="h-4 w-4 text-orange-300" /> Keluar <strong className="tabular text-white">{rupiah(stats.month.expense)}</strong>
              </span>
            </div>
            {stats.restrictedTotal > 0 && (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-black/15 px-3 py-2 text-xs text-white/80">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-light" />
                Termasuk dana khusus {rupiah(stats.restrictedTotal)} ({stats.restricted.map((r) => r.a.name).join(", ")}). Dana umum yang bebas dipakai: {rupiah(stats.total.closingBalance - stats.restrictedTotal)}.
              </p>
            )}
          </div>
        </motion.section>

        {/* QUICK ACTIONS + ALERTS */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {quick.map((q, i) => (
              <motion.div key={q.href} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}>
                <Link href={q.href} className="press flex h-full flex-col gap-3 rounded-2xl border border-line bg-white p-4 shadow-soft hover:border-emerald-300 hover:shadow-lift">
                  <span className={cn("grid h-12 w-12 place-items-center rounded-2xl", q.tone)}><q.icon className="h-6 w-6" /></span>
                  <span className="text-[15px] font-bold leading-tight">{q.label}</span>
                </Link>
              </motion.div>
            ))}
          </div>
          {(pendingDonations.length > 0 || drafts.length > 0) && (
            <Card className="divide-y divide-line">
              {pendingDonations.length > 0 && (
                <Link href={`/app/campaign/${pendingDonations[0].campaignId}?tab=verifikasi`} className="flex items-center gap-3 p-4 hover:bg-ivory">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><AlertCircle className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{pendingDonations.length} donasi menunggu verifikasi</span>
                    <span className="block text-sm text-muted">Total {rupiah(pendingDonations.reduce((s, d) => s + d.amount, 0))}</span>
                  </span>
                  <ChevronRight className="h-5 w-5 text-muted" />
                </Link>
              )}
              {drafts.length > 0 && (
                <Link href="/app/transaksi?status=draft" className="flex items-center gap-3 p-4 hover:bg-ivory">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><ReceiptText className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{drafts.length} draf transaksi perlu dikonfirmasi</span>
                    <span className="block text-sm text-muted">Belum dihitung dalam saldo</span>
                  </span>
                  <ChevronRight className="h-5 w-5 text-muted" />
                </Link>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* CHART */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h2 className="text-base font-bold">Arus kas</h2>
            <p className="text-sm text-muted">
              Masuk <span className="tabular font-semibold text-charcoal">{rupiah(seriesTotals.income)}</span> · Keluar{" "}
              <span className="tabular font-semibold text-charcoal">{rupiah(seriesTotals.expense)}</span>
            </p>
          </div>
          <Segmented
            size="sm"
            value={period}
            onChange={setPeriod}
            ariaLabel="Periode grafik"
            options={[
              { value: "weekly", label: "Mingguan" },
              { value: "monthly", label: "Bulanan" },
              { value: "yearly", label: "Tahunan" },
            ]}
          />
        </div>
        <CardBody className="pt-3">
          <ChartLegend />
          <div className="mt-3"><FlowChart data={series} height={260} /></div>
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Transaksi terbaru" action={<Link href="/app/transaksi" className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline">Semua <ArrowRight className="h-4 w-4" /></Link>} />
          <div className="px-3 pb-3 pt-2">
            {recent.length ? (
              recent.map((t) => <TxRow key={t.id} tx={t} category={catName(t.categoryId)} accountName={accName(t.accountId)} activityName={actName(t.activityId)} />)
            ) : (
              <EmptyState icon={Wallet} title="Belum ada transaksi" description="Mulai dengan mencatat pemasukan atau pengeluaran pertama." />
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Penggalangan aktif" action={<Link href="/app/campaign" className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline">Kelola <ArrowRight className="h-4 w-4" /></Link>} />
          <CardBody className="space-y-5">
            {activeCampaigns.length ? (
              activeCampaigns.map((c) => {
                const s = campaignStats(c, ws.donations);
                return (
                  <Link key={c.id} href={`/app/campaign/${c.id}`} className="block rounded-2xl p-1 hover:bg-ivory">
                    <p className="font-semibold leading-snug">{c.title}</p>
                    <div className="mt-1 flex justify-between text-sm">
                      <span className="tabular font-bold text-forest">{rupiah(s.collected)}</span>
                      <span className="tabular text-muted">{formatPercent(s.progress)} dari {rupiah(c.target)}</span>
                    </div>
                    <Progress value={s.progress} className="mt-2" label={c.title} />
                    {s.pending.length > 0 && <p className="mt-2 text-xs font-semibold text-amber-700">{s.pending.length} donasi menunggu verifikasi</p>}
                  </Link>
                );
              })
            ) : (
              <EmptyState icon={Megaphone} title="Belum ada campaign aktif" className="py-6" />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
