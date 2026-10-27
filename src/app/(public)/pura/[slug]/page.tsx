"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Copy, Download, FileText, Landmark, Mail, MapPin, Phone, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { TempleCover } from "@/components/brand/temple-cover";
import { OrnamentDivider } from "@/components/brand/ornament";
import { CampaignCard } from "@/components/shared/campaign-card";
import { ShareActions, QrBlock, useAbsoluteUrl } from "@/components/shared/share";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { usePublicData } from "@/lib/public";
import { exportPdf } from "@/lib/export";
import { snapshotDoc } from "@/lib/report-docs";
import { formatDate, formatDateShort, rupiah } from "@/lib/format";

export default function TempleProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const { hydrated, temples, campaigns, donations, reports, accounts } = usePublicData();
  const temple = temples.find((t) => t.slug === slug);
  const profileUrl = useAbsoluteUrl(`/pura/${slug}`);
  const [busy, setBusy] = useState<string | null>(null);

  if (!hydrated) {
    return (
      <div className="container space-y-6 py-8">
        <Skeleton className="h-64 rounded-[2rem]" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (!temple) {
    return (
      <div className="container py-16">
        <EmptyState icon={MapPin} title="Profil pura tidak ditemukan" description="Pura ini mungkin belum dipublikasikan atau tautannya salah." action={<Link href="/pura" className="font-semibold text-emerald-700">Kembali ke direktori</Link>} />
      </div>
    );
  }
  const tc = campaigns.filter((c) => c.templeId === temple.id);
  const active = tc.filter((c) => c.status === "active");
  const done = tc.filter((c) => c.status === "completed");
  const pubReports = temple.transparency.showPublishedSummaries
    ? reports.filter((r) => r.templeId === temple.id).sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))
    : [];
  const latest = pubReports[0];
  const bank = temple.transparency.showBankAccount ? accounts.find((a) => a.templeId === temple.id && a.type === "bank" && a.isPublic) : undefined;

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
    <div className="pb-10">
      <div className="container pt-4 md:pt-6">
        <TempleCover variant={temple.cover} image={temple.photo} alt={`Sampul ${temple.name}`} className="h-56 rounded-[2rem] md:h-80">
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 md:p-10">
            <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-extrabold text-white md:text-5xl">
              {temple.name}
            </motion.h1>
            <p className="mt-2 flex items-center gap-1.5 text-white/85">
              <MapPin className="h-4 w-4" aria-hidden /> {temple.regency}, {temple.province}
            </p>
          </div>
        </TempleCover>
      </div>

      <div className="container mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardBody>
              <h2 className="text-lg font-bold">Tentang pura</h2>
              <p className="mt-2 leading-relaxed text-charcoal/80">{temple.description}</p>
              {temple.established && <p className="mt-3 text-sm text-muted">Berdiri sejak {temple.established}</p>}
            </CardBody>
          </Card>

          {/* Published summary */}
          <section aria-labelledby="ringkasan">
            <div className="flex items-end justify-between">
              <h2 id="ringkasan" className="text-xl font-bold text-forest">Ringkasan keuangan yang dipublikasikan</h2>
            </div>
            {latest ? (
              <div className="mt-3 overflow-hidden rounded-3xl bg-forest p-6 text-white shadow-card">
                <p className="text-sm text-white/70">{latest.title}</p>
                <p className="text-xs text-white/60">
                  {formatDate(latest.periodStart)} – {formatDate(latest.periodEnd)}
                </p>
                <p className="mt-4 text-sm text-white/70">Saldo akhir periode</p>
                <p className="tabular text-3xl font-extrabold">{rupiah(latest.snapshot.closingBalance)}</p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white/10 p-3">
                    <p className="flex items-center gap-1 text-xs text-white/70"><ArrowDownRight className="h-3.5 w-3.5 text-emerald-300" /> Pemasukan</p>
                    <p className="tabular mt-1 font-bold">{rupiah(latest.snapshot.income)}</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3">
                    <p className="flex items-center gap-1 text-xs text-white/70"><ArrowUpRight className="h-3.5 w-3.5 text-red-300" /> Pengeluaran</p>
                    <p className="tabular mt-1 font-bold">{rupiah(latest.snapshot.expense)}</p>
                  </div>
                </div>
                <p className="mt-4 flex items-center gap-1.5 text-xs text-gold-light">
                  <ShieldCheck className="h-4 w-4" /> Hanya ringkasan yang dipublikasikan pengurus yang ditampilkan di sini.
                </p>
              </div>
            ) : (
              <Card className="mt-3"><EmptyState icon={FileText} title="Belum ada laporan publik" description="Pengurus pura belum mempublikasikan laporan keuangan." /></Card>
            )}
          </section>

          {/* Campaigns */}
          <section aria-labelledby="campaign">
            <h2 id="campaign" className="text-xl font-bold text-forest">Penggalangan dana aktif</h2>
            {active.length ? (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {active.map((c) => (
                  <CampaignCard key={c.id} campaign={c} donations={donations} href={`/donasi/${c.slug}`} />
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-2xl border border-dashed border-line p-6 text-center text-muted">Belum ada penggalangan dana yang aktif.</p>
            )}
            {done.length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted">Selesai</h3>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {done.map((c) => (
                    <CampaignCard key={c.id} campaign={c} donations={donations} href={`/donasi/${c.slug}`} showStatus />
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Reports */}
          {pubReports.length > 0 && (
            <section aria-labelledby="laporan">
              <h2 id="laporan" className="text-xl font-bold text-forest">Laporan keuangan publik</h2>
              <Card className="mt-3 divide-y divide-line">
                {pubReports.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mint text-emerald-700">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link href={`/pura/${temple.slug}/laporan/${r.id}`} className="font-semibold hover:text-emerald-700">{r.title}</Link>
                      <p className="text-sm text-muted">Dipublikasikan {formatDateShort(r.publishedAt)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/pura/${temple.slug}/laporan/${r.id}`} className="press inline-flex h-10 items-center rounded-xl border border-line px-3 text-sm font-semibold hover:bg-ivory">Lihat</Link>
                      <Button size="sm" variant="secondary" className="h-10" onClick={() => download(r.id)} loading={busy === r.id}>
                        <Download className="h-4 w-4" /> PDF
                      </Button>
                    </div>
                  </div>
                ))}
              </Card>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          {bank && (
            <Card>
              <CardHeader title="Informasi dana punia" description="Rekening resmi pura" />
              <CardBody>
                <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-forest p-5 text-white">
                  <p className="flex items-center gap-2 text-sm text-white/80"><Landmark className="h-4 w-4" /> {bank.bankName}</p>
                  <p className="tabular mt-3 text-2xl font-bold tracking-wider">{bank.accountNumber}</p>
                  <p className="mt-1 text-sm text-white/80">a.n. {bank.accountHolder}</p>
                </div>
                <Button
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={() => {
                    navigator.clipboard?.writeText((bank.accountNumber ?? "").replace(/\s/g, ""));
                    toast.success("Nomor rekening disalin");
                  }}
                >
                  <Copy className="h-4 w-4" /> Salin nomor rekening
                </Button>
                <p className="mt-3 flex gap-2 text-xs text-muted">
                  <Wallet className="h-4 w-4 shrink-0" /> Pastikan nama penerima sesuai. Bila ragu, konfirmasi langsung ke pengurus pura.
                </p>
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader title="Kontak resmi" />
            <CardBody className="space-y-3 text-[15px]">
              <p className="flex gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" /> {temple.address}</p>
              <a href={`tel:${temple.phone.replace(/[^\d+]/g, "")}`} className="flex gap-3 hover:text-emerald-700"><Phone className="h-5 w-5 shrink-0 text-emerald-700" /> {temple.phone}</a>
              {temple.email && <a href={`mailto:${temple.email}`} className="flex gap-3 break-all hover:text-emerald-700"><Mail className="h-5 w-5 shrink-0 text-emerald-700" /> {temple.email}</a>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Bagikan profil pura" description="Pindai kode QR atau bagikan tautan" />
            <CardBody>
              <QrBlock url={profileUrl} size={180} />
              <OrnamentDivider className="my-4" />
              <ShareActions compact path={`/pura/${temple.slug}`} title={temple.name} message={`Profil & laporan keuangan ${temple.name} di PURA:`} />
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
