"use client";
import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { CalendarRange, Layers, Lock, Plus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ActivityForm } from "@/components/app/activity-form";
import { useCan, useWorkspace } from "@/components/app/hooks";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { activitySummary } from "@/lib/ledger";
import { formatDateShort, formatPercent, rupiah } from "@/lib/format";

const ACT_STATUS = { planned: { label: "Direncanakan", tone: "gray" }, ongoing: { label: "Berjalan", tone: "emerald" }, done: { label: "Selesai", tone: "gold" } } as const;

export default function ActivitiesPage() {
  const ws = useWorkspace();
  const can = useCan();
  const [open, setOpen] = useState(false);
  return (
    <div>
      <PageHeader
        title="Kegiatan"
        description="Kelompokkan pemasukan & pengeluaran per kegiatan. Semua tetap tercatat di satu buku kas pura — tidak dihitung ganda."
        actions={can("activity.manage") && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Kegiatan baru</Button>}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {ws.activities.map((a, i) => {
          const s = activitySummary(a, ws.transactions);
          const st = ACT_STATUS[a.status];
          return (
            <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Link href={`/app/kegiatan/${a.id}`} className="block h-full">
                <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-10 w-1.5 shrink-0 rounded-full" style={{ background: a.color }} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-bold leading-snug">{a.name}</h2>
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted"><CalendarRange className="h-4 w-4" /> {formatDateShort(a.startDate)} – {formatDateShort(a.endDate)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge tone={st.tone}>{st.label}</Badge>
                    {a.fundType === "restricted" ? <Badge tone="gold"><Lock className="h-3 w-3" /> Dana khusus</Badge> : <Badge tone="gray">Dana umum</Badge>}
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                    <div><p className="text-muted">Masuk</p><p className="tabular font-bold text-income">{rupiah(s.income)}</p></div>
                    <div><p className="text-muted">Keluar</p><p className="tabular font-bold text-expense">{rupiah(s.expense)}</p></div>
                    <div><p className="text-muted">Sisa</p><p className="tabular font-bold">{rupiah(s.net)}</p></div>
                  </div>
                  {a.budget > 0 && (
                    <div className="mt-4">
                      <div className="flex justify-between text-xs text-muted"><span>Pemakaian anggaran</span><span className="tabular">{formatPercent(s.budgetUsed)} dari {rupiah(a.budget)}</span></div>
                      <Progress value={s.budgetUsed} tone={s.budgetUsed > 100 ? "gold" : "emerald"} className="mt-1.5" height="h-2" label={`Anggaran ${a.name}`} />
                    </div>
                  )}
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </div>
      {ws.activities.length === 0 && <Card><EmptyState icon={Layers} title="Belum ada kegiatan" description="Buat kegiatan seperti Piodalan atau Pemeliharaan Pura untuk laporan yang lebih rapi." /></Card>}
      <ActivityForm open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
