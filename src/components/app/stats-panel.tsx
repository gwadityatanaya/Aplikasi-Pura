"use client";
import { useEffect, useState } from "react";
import { BarChart3, Building2, Landmark, Users } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/store";
import { rupiah } from "@/lib/format";
import { monthLabel } from "@/lib/reconciliation";
import type { AppStats } from "@/app/api/admin/statistik/route";

/** Back Office → Angka: counts and sums for Admin Utama. No donor names anywhere. */
export function StatsPanel() {
  const [s, setS] = useState<AppStats | null>(null);
  useEffect(() => {
    api<{ stats: AppStats }>("/api/admin/statistik").then(({ json }) => json.ok && setS(json.stats));
  }, []);
  if (!s) return <Skeleton className="mt-4 h-64" />;
  const max = Math.max(1, ...s.months.map((m) => m.total));
  const tiles = [
    { icon: Landmark, label: "Banjar aktif", value: s.banjarActive },
    { icon: Building2, label: "Pura aktif", value: s.templeActive, sub: s.templeOther ? `+${s.templeOther} menunggu/arsip` : undefined },
    { icon: Users, label: "Pengguna", value: s.users, sub: `${s.staff} pengurus` },
  ];
  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-3" aria-label="Ringkasan angka">
        {tiles.map((x) => (
          <Card key={x.label} className="p-4">
            <x.icon className="h-5 w-5 text-emerald-700" />
            <p className="tabular mt-1 text-3xl font-extrabold">{x.value}</p>
            <p className="text-sm text-muted">{x.label}{x.sub ? ` · ${x.sub}` : ""}</p>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader title="Punia disahkan per bulan" description="12 bulan terakhir, semua pura. Koreksi tidak dihitung. Hanya jumlah dan nominal." />
        <CardBody>
          <ul className="space-y-2" aria-label="Punia per bulan">
            {s.months.map((m) => (
              <li key={m.month} className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-3 text-sm sm:grid-cols-[8rem_minmax(0,1fr)_auto]">
                <span className="font-semibold">{monthLabel(m.month)}</span>
                <span className="h-3 overflow-hidden rounded-full bg-stone-100"><span className="block h-full rounded-full bg-emerald-600" style={{ width: `${(m.total / max) * 100}%` }} /></span>
                <span className="tabular col-span-2 text-muted sm:col-span-1 sm:text-right">{m.count} punia · {rupiah(m.total)}</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Per banjar (12 bulan terakhir)" description="Angka saja. Pura yang diempon dua banjar terhitung di kedua banjar." />
        <CardBody className="overflow-x-auto">
          <table className="w-full min-w-[22rem] text-sm">
            <thead><tr className="text-left text-muted"><th className="py-1 pr-2">Banjar</th><th className="py-1 pr-2 text-right">Pura</th><th className="py-1 pr-2 text-right">Punia</th><th className="py-1 text-right">Nominal</th></tr></thead>
            <tbody className="divide-y divide-line">
              {s.perBanjar.map((r) => (
                <tr key={r.banjar}><td className="py-1.5 pr-2">{r.banjar}</td><td className="tabular py-1.5 pr-2 text-right">{r.temples}</td><td className="tabular py-1.5 pr-2 text-right">{r.count}</td><td className="tabular py-1.5 text-right">{rupiah(r.total)}</td></tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
      <p className="flex items-center gap-1.5 text-sm text-muted"><BarChart3 className="h-4 w-4" /> Dasbor ini tidak memuat nama donatur, pesan, atau bukti transfer.</p>
    </div>
  );
}
