"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Copy, Download, FileText, HandHeart, Info, Landmark, Mail, MapPin, Phone, Users } from "lucide-react";
import { toast } from "sonner";
import { TempleCover } from "@/components/brand/temple-cover";
import { OrnamentDivider } from "@/components/brand/ornament";
import { CampaignCard } from "@/components/shared/campaign-card";
import { ShareActions, QrBlock, useAbsoluteUrl } from "@/components/shared/share";
import { DonorList } from "@/components/public/donations";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button, buttonClass } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { usePublicData } from "@/lib/public";
import { exportPdf } from "@/lib/export";
import { snapshotDoc } from "@/lib/report-docs";
import { cn, formatDate, formatDateShort, rupiah } from "@/lib/format";

export default function TemplePage() {
  const { slug } = useParams<{ slug: string }>();
  const { hydrated, temples, campaigns, donations, reports } = usePublicData();
  const temple = temples.find((t) => t.slug === slug);
  const profileUrl = useAbsoluteUrl(`/pura/${slug}`);
  const [busy, setBusy] = useState<string | null>(null);

  if (!hydrated)
    return (
      <div className="container space-y-6 py-8">
        <Skeleton className="h-56 rounded-[2rem]" />
        <Skeleton className="h-40" />
      </div>
    );
  if (!temple)
    return (
      <div className="container py-16">
        <EmptyState icon={MapPin} title="Pura tidak ditemukan" description="Pura ini mungkin belum aktif atau tautannya salah." action={<Link href="/pura" className="font-semibold text-emerald-700">Kembali ke daftar pura</Link>} />
      </div>
    );

  const tp = temple.transparency;
  const own = donations.filter((d) => d.templeId === temple.id && !d.campaignId);
  const allOwn = donations.filter((d) => d.templeId === temple.id);
  const tc = campaigns.filter((c) => c.templeId === temple.id);
  const active = tc.filter((c) => c.status === "active");
  const pubReports = tp.showPublishedSummaries ? reports.filter((r) => r.templeId === temple.id).sort((a, b) => b.periodEnd.localeCompare(a.periodEnd)) : [];

  async function download(id: string) {
    const r = pubReports.find((x) => x.id === id)!;
    setBusy(id);
    try {
      await exportPdf(snapshotDoc(r, temple!));
      toast.success("PDF laporan diunduh");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="pb-28 lg:pb-10">
      <div className="container pt-4 md:pt-6">
        <TempleCover variant={temple.cover} image={temple.photo} alt={`Sampul ${temple.name}`} className="h-48 rounded-[2rem] md:h-72">
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 md:p-10">
            <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-extrabold text-white md:text-5xl">{temple.name}</motion.h1>
            <p className="mt-1.5 flex items-center gap-1.5 text-white/90"><MapPin className="h-4 w-4" aria-hidden /> {temple.village}, {temple.district}, {temple.regency}</p>
          </div>
        </TempleCover>
      </div>

      <div className="container mt-5 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3 py-1.5 text-sm font-semibold text-emerald-900">
          <Users className="h-4 w-4" /> Banjar Pengempon: {temple.banjarNames.join(", ") || "—"}
        </span>
        {!temple.hasPengurus && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4" /> Pengurus pura belum terdaftar
          </span>
        )}
      </div>

      <div className="container mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          {/* Cash position */}
          {temple.balance !== undefined && (
            <section aria-labelledby="kas" className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-forest p-6 text-white shadow-card">
              <p id="kas" className="text-sm font-medium text-white/80">Posisi kas pura</p>
              <p className="tabular mt-1 text-4xl font-extrabold">{rupiah(temple.balance)}</p>
              <p className="mt-2 flex items-start gap-1.5 text-sm text-gold-light">
                <Info className="mt-0.5 h-4 w-4 shrink-0" /> Berdasarkan pencatatan pengurus (bukan saldo bank){temple.balanceAsOf ? ` · catatan terakhir ${formatDate(temple.balanceAsOf)}` : ""}.
              </p>
            </section>
          )}

          {/* Recent transactions */}
          {temple.recentTransactions && (
            <Card>
              <CardHeader title="Transaksi terakhir" description="Pemasukan dan pengeluaran yang dicatat pengurus" />
              <ul className="divide-y divide-line px-5 pb-3 pt-2">
                {temple.recentTransactions.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-3">
                    <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", t.amount >= 0 ? "bg-mint text-emerald-700" : "bg-orange-50 text-orange-700")}>
                      {t.amount >= 0 ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{t.description}</p>
                      <p className="text-sm text-muted">{formatDateShort(t.date)}{t.category ? ` · ${t.category}` : ""}</p>
                    </div>
                    <p className={cn("tabular shrink-0 font-bold", t.amount >= 0 ? "text-income" : "text-expense")}>{rupiah(t.amount, { sign: true })}</p>
                  </li>
                ))}
                {!temple.recentTransactions.length && <li className="py-6 text-center text-muted">Belum ada transaksi tercatat.</li>}
              </ul>
            </Card>
          )}

          {/* Verified punia */}
          {tp.showDonorList && (
            <Card>
              <CardHeader title="Punia terverifikasi" description="Donatur yang memilih anonim tampil sebagai &quot;Anonim&quot;" />
              <CardBody><DonorList donations={own.length ? own : allOwn} /></CardBody>
            </Card>
          )}

          {active.length > 0 && (
            <section aria-labelledby="kegiatan">
              <h2 id="kegiatan" className="text-xl font-bold text-forest">Penggalangan dana / odalan</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {active.map((c) => <CampaignCard key={c.id} campaign={c} donations={donations} href={`/donasi/${c.slug}`} />)}
              </div>
            </section>
          )}

          {pubReports.length > 0 && (
            <section aria-labelledby="laporan">
              <h2 id="laporan" className="text-xl font-bold text-forest">Laporan keuangan</h2>
              <Card className="mt-3 divide-y divide-line">
                {pubReports.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mint text-emerald-700"><FileText className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                      <Link href={`/pura/${temple.slug}/laporan/${r.id}`} className="font-semibold hover:text-emerald-700">{r.title}</Link>
                      <p className="text-sm text-muted">Dipublikasikan {formatDateShort(r.publishedAt)}</p>
                    </div>
                    <Button size="sm" variant="secondary" className="h-10" onClick={() => download(r.id)} loading={busy === r.id}><Download className="h-4 w-4" /> PDF</Button>
                  </div>
                ))}
              </Card>
            </section>
          )}

          <Card>
            <CardBody>
              <h2 className="text-lg font-bold">Tentang pura</h2>
              <p className="mt-2 leading-relaxed text-charcoal/80">{temple.description || "—"}</p>
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <Card className="overflow-hidden">
            <div className="p-5">
              <h2 className="flex items-center gap-2 text-lg font-bold"><HandHeart className="h-5 w-5 text-emerald-700" /> Berpunia ke pura ini</h2>
              {temple.acceptsPunia ? (
                <>
                  <p className="mt-1 text-[15px] text-muted">Transfer lewat m-banking ke rekening resmi berikut, lalu unggah bukti transfer.</p>
                  <div className="mt-4 rounded-2xl bg-gradient-to-br from-emerald-600 to-forest p-4 text-white">
                    <p className="flex items-center gap-2 text-sm text-white/80"><Landmark className="h-4 w-4" /> {temple.bankName}</p>
                    <p className="tabular mt-2 text-2xl font-bold tracking-wider">{temple.bankAccountNumber}</p>
                    <p className="mt-1 text-sm">a.n. <strong>{temple.bankAccountHolder}</strong></p>
                    <p className="mt-2 text-xs text-white/75">Banjar Pengempon: {temple.banjarNames.join(", ")}</p>
                  </div>
                  <Button variant="outline" className="mt-2 w-full" onClick={() => { navigator.clipboard?.writeText((temple.bankAccountNumber ?? "").replace(/\D/g, "")); toast.success("Nomor rekening disalin"); }}>
                    <Copy className="h-4 w-4" /> Salin nomor rekening
                  </Button>
                  <Link href={`/pura/${temple.slug}/punia`} className={buttonClass("primary", "xl", "mt-3 w-full")}>Saya sudah transfer — unggah bukti</Link>
                  <p className="mt-2 text-xs text-muted">Pastikan nama pemilik rekening sesuai sebelum mentransfer. Aplikasi PURA tidak memegang uang.</p>
                </>
              ) : (
                <p className="mt-2 rounded-xl bg-amber-50 p-3 text-[15px] text-amber-900">Info rekening pura ini belum tersedia, jadi punia belum bisa dikirim lewat aplikasi. Hubungi pengurus pura.</p>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title="Kontak" />
            <CardBody className="space-y-3 text-[15px]">
              <p className="flex gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" /> {temple.address}</p>
              {temple.phone && <a href={`tel:${temple.phone.replace(/[^\d+]/g, "")}`} className="flex gap-3 hover:text-emerald-700"><Phone className="h-5 w-5 shrink-0 text-emerald-700" /> {temple.phone}</a>}
              {temple.email && <a href={`mailto:${temple.email}`} className="flex gap-3 break-all hover:text-emerald-700"><Mail className="h-5 w-5 shrink-0 text-emerald-700" /> {temple.email}</a>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Bagikan halaman pura" description="Gantikan broadcast di grup WhatsApp" />
            <CardBody>
              <QrBlock url={profileUrl} size={160} />
              <OrnamentDivider className="my-4" />
              <ShareActions compact path={`/pura/${temple.slug}`} title={temple.name} message={`🙏 Punia, posisi kas & laporan ${temple.name} bisa dilihat di sini:`} />
            </CardBody>
          </Card>
        </aside>
      </div>

      {temple.acceptsPunia && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
          <Link href={`/pura/${temple.slug}/punia`} className={buttonClass("primary", "xl", "w-full")}><HandHeart className="h-5 w-5" /> Berpunia</Link>
        </div>
      )}
    </div>
  );
}
