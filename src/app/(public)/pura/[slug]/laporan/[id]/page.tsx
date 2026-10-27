"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Download, FileText, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { CategoryBars } from "@/components/shared/charts";
import { ShareActions } from "@/components/shared/share";
import { OrnamentDivider } from "@/components/brand/ornament";
import { usePublicData } from "@/lib/public";
import { exportPdf } from "@/lib/export";
import { snapshotDoc } from "@/lib/report-docs";
import { formatDate, formatDateShort, rupiah } from "@/lib/format";

export default function PublicReportPage() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const { hydrated, temples, reports } = usePublicData();
  const [busy, setBusy] = useState(false);
  const temple = temples.find((t) => t.slug === slug);
  const report = reports.find((r) => r.id === id && r.templeId === temple?.id);
  if (!hydrated) return <div className="container py-10"><Skeleton className="h-96" /></div>;
  if (!temple || !report || !temple.transparency.showPublishedSummaries)
    return <div className="container py-16"><EmptyState icon={FileText} title="Laporan tidak ditemukan" description="Laporan ini belum dipublikasikan atau sudah ditarik oleh pengurus." /></div>;
  const s = report.snapshot;
  const period = `${formatDate(report.periodStart)} – ${formatDate(report.periodEnd)}`;
  return (
    <div className="container max-w-4xl py-8">
      <Link href={`/pura/${temple.slug}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:underline">
        <ArrowLeft className="h-4 w-4" /> {temple.name}
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold text-forest">{report.title}</h1>
      <p className="mt-1 text-muted">{period} · Dipublikasikan {formatDateShort(report.publishedAt)}</p>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Saldo awal", s.openingBalance],
          ["Pemasukan", s.income],
          ["Pengeluaran", s.expense],
          ["Saldo akhir", s.closingBalance],
        ].map(([l, v]) => (
          <Card key={l as string} className="p-4">
            <p className="text-sm text-muted">{l}</p>
            <p className="tabular mt-1 text-lg font-extrabold">{rupiah(v as number)}</p>
          </Card>
        ))}
      </div>
      {s.note && <p className="mt-4 rounded-2xl bg-mint/60 p-4 text-[15px] text-emerald-900">{s.note}</p>}
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <Card><CardHeader title="Pemasukan per kategori" /><CardBody><CategoryBars rows={s.incomeByCategory} /></CardBody></Card>
        <Card><CardHeader title="Pengeluaran per kategori" /><CardBody><CategoryBars rows={s.expenseByCategory} tone="expense" /></CardBody></Card>
      </div>
      <OrnamentDivider className="my-8" />
      <div className="flex flex-wrap gap-2">
        <Button
          size="lg"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await exportPdf(snapshotDoc(report, temple));
            setBusy(false);
            toast.success("PDF diunduh");
          }}
        >
          <Download className="h-4 w-4" /> Unduh PDF
        </Button>
        <ShareActions compact path={`/pura/${temple.slug}/laporan/${report.id}`} title={report.title} message={`${report.title} — ${temple.name}\nPemasukan ${rupiah(s.income)}, pengeluaran ${rupiah(s.expense)}, saldo akhir ${rupiah(s.closingBalance)}.`} />
      </div>
      <p className="mt-6 flex items-start gap-2 text-sm text-muted">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /> Ringkasan ini adalah salinan beku yang dipublikasikan pengurus. Rincian transaksi internal tidak ditampilkan secara publik.
      </p>
    </div>
  );
}
