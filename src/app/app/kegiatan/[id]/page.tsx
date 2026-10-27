"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Layers, Lock, Pencil, Plus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ActivityForm } from "@/components/app/activity-form";
import { TxRow } from "@/components/app/tx-row";
import { useCan, useWorkspace } from "@/components/app/hooks";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button, buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { CategoryBars } from "@/components/shared/charts";
import { activitySummary, byCategory } from "@/lib/ledger";
import { formatDate, formatPercent, rupiah } from "@/lib/format";

export default function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const ws = useWorkspace();
  const can = useCan();
  const [edit, setEdit] = useState(false);
  const a = ws.activities.find((x) => x.id === id);
  const rel = useMemo(() => ws.transactions.filter((t) => t.activityId === id).sort((x, y) => y.date.localeCompare(x.date)), [ws.transactions, id]);
  if (!a) return <Card><EmptyState icon={Layers} title="Kegiatan tidak ditemukan" action={<Link href="/app/kegiatan" className={buttonClass()}>Kembali</Link>} /></Card>;
  const s = activitySummary(a, ws.transactions);
  const campaigns = ws.campaigns.filter((c) => c.activityId === a.id);

  return (
    <div>
      <PageHeader
        back={{ href: "/app/kegiatan", label: "Kegiatan" }}
        title={a.name}
        description={`${formatDate(a.startDate)} – ${formatDate(a.endDate)}`}
        actions={
          can("activity.manage") && (
            <>
              <Button variant="outline" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" /> Ubah</Button>
              <Link href="/app/transaksi/baru?type=expense" className={buttonClass("primary")}><Plus className="h-4 w-4" /> Catat transaksi</Link>
            </>
          )
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {a.fundType === "restricted" ? <Badge tone="gold"><Lock className="h-3 w-3" /> Dana khusus — hanya untuk kegiatan ini</Badge> : <Badge tone="gray">Dana umum</Badge>}
      </div>
      {a.description && <p className="mb-5 max-w-3xl text-[15px] leading-relaxed text-charcoal/80">{a.description}</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Pemasukan", rupiah(s.income), "text-income"],
          ["Pengeluaran", rupiah(s.expense), "text-expense"],
          ["Sisa dana kegiatan", rupiah(s.net), ""],
          ["Anggaran", a.budget ? rupiah(a.budget) : "—", ""],
        ].map(([l, v, c]) => (
          <Card key={l} className="p-4">
            <p className="text-sm text-muted">{l}</p>
            <p className={`tabular mt-1 text-lg font-extrabold ${c}`}>{v}</p>
          </Card>
        ))}
      </div>
      {a.budget > 0 && (
        <Card className="mt-4 p-5">
          <div className="flex justify-between text-sm"><span className="font-semibold">Pemakaian anggaran</span><span className="tabular text-muted">{formatPercent(s.budgetUsed)}</span></div>
          <Progress value={s.budgetUsed} className="mt-2" height="h-3" label="Pemakaian anggaran" />
          <p className="mt-2 text-sm text-muted">Sisa anggaran {rupiah(Math.max(0, a.budget - s.expense))}</p>
        </Card>
      )}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card><CardHeader title="Pemasukan per kategori" /><CardBody><CategoryBars rows={byCategory(rel, ws.categories, "income")} /></CardBody></Card>
        <Card><CardHeader title="Pengeluaran per kategori" /><CardBody><CategoryBars rows={byCategory(rel, ws.categories, "expense")} tone="expense" /></CardBody></Card>
      </div>
      {campaigns.length > 0 && (
        <Card className="mt-5">
          <CardHeader title="Campaign terkait" />
          <CardBody className="space-y-2">
            {campaigns.map((c) => <Link key={c.id} href={`/app/campaign/${c.id}`} className="block rounded-xl p-2 font-semibold text-emerald-700 hover:bg-ivory">{c.title} →</Link>)}
          </CardBody>
        </Card>
      )}
      <Card className="mt-5">
        <CardHeader title={`Transaksi terkait (${rel.length})`} action={<Link href={`/app/transaksi?activity=${a.id}`} className="text-sm font-semibold text-emerald-700 hover:underline">Filter di daftar</Link>} />
        <div className="px-3 pb-3 pt-2">
          {rel.length ? rel.map((t) => <TxRow key={t.id} tx={t} category={ws.categories.find((c) => c.id === t.categoryId)} accountName={ws.accounts.find((x) => x.id === t.accountId)?.name} />) : <EmptyState icon={Layers} title="Belum ada transaksi" />}
        </div>
      </Card>
      <ActivityForm open={edit} onClose={() => setEdit(false)} activity={a} />
    </div>
  );
}
