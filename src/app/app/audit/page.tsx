"use client";
import { useMemo, useState } from "react";
import { History, Search } from "lucide-react";
import { PageHeader, NoAccess } from "@/components/app/page-header";
import { useCan, useWorkspace } from "@/components/app/hooks";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/format";
import Link from "next/link";

const ENTITY: Record<string, { label: string; tone: "emerald" | "gold" | "blue" | "violet" | "gray" | "amber" }> = {
  transaction: { label: "Transaksi", tone: "emerald" },
  donation: { label: "Donasi", tone: "gold" },
  campaign: { label: "Campaign", tone: "amber" },
  report: { label: "Laporan", tone: "violet" },
  activity: { label: "Kegiatan", tone: "blue" },
  settings: { label: "Pengaturan", tone: "gray" },
  user: { label: "Pengguna", tone: "gray" },
  session: { label: "Sesi", tone: "gray" },
};

export default function AuditPage() {
  const ws = useWorkspace();
  const can = useCan();
  const [q, setQ] = useState("");
  const [entity, setEntity] = useState("");
  const list = useMemo(
    () => [...ws.audit].sort((a, b) => b.at.localeCompare(a.at)).filter((a) => (!entity || a.entity === entity) && (!q || `${a.action} ${a.detail} ${a.actorName}`.toLowerCase().includes(q.toLowerCase()))),
    [ws.audit, q, entity]
  );
  if (!can("audit.view")) return <NoAccess what="riwayat audit" />;
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Riwayat Audit" description="Setiap perubahan penting tercatat otomatis dan tidak dapat diubah dari aplikasi." />
      <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input aria-label="Cari riwayat" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari tindakan, nama, atau keterangan…" className="h-12 w-full rounded-xl border border-line bg-white pl-12 pr-4 text-[16px] focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/15" />
        </div>
        <Select aria-label="Jenis" value={entity} onChange={(e) => setEntity(e.target.value)}>
          <option value="">Semua jenis</option>
          {Object.entries(ENTITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
      </div>
      <Card className="mt-4">
        <ol className="divide-y divide-line">
          {list.map((a) => (
            <li key={a.id} className="flex gap-4 p-4">
              <History className="mt-1 h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{a.action}</span>
                  <Badge tone={ENTITY[a.entity]?.tone ?? "gray"}>{ENTITY[a.entity]?.label ?? a.entity}</Badge>
                </div>
                <p className="mt-0.5 text-[15px] text-charcoal/80">
                  {a.entity === "transaction" && a.entityId ? <Link className="hover:text-emerald-700 hover:underline" href={`/app/transaksi/${a.entityId}`}>{a.detail}</Link> : a.detail}
                </p>
                <p className="mt-1 text-sm text-muted">{a.actorName} · {formatDateTime(a.at)}</p>
              </div>
            </li>
          ))}
        </ol>
        {!list.length && <EmptyState icon={History} title="Tidak ada catatan" />}
      </Card>
      <p className="mt-4 text-sm text-muted">Prototipe: riwayat tersimpan di peramban. Versi produksi akan menyimpan log audit di server secara permanen (append-only).</p>
    </div>
  );
}
