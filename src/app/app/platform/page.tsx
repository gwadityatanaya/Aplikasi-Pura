"use client";
import Link from "next/link";
import { useState } from "react";
import { Building2, CheckCircle2, MapPin, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, NoAccess } from "@/components/app/page-header";
import { useCan } from "@/components/app/hooks";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/ui/confirm";
import { useStore } from "@/lib/store";
import { formatDateShort } from "@/lib/format";

export default function PlatformPage() {
  const can = useCan();
  const temples = useStore((s) => s.data.temples);
  const users = useStore((s) => s.data.users);
  const txCount = useStore((s) => s.data.transactions.length);
  const setStatus = useStore((s) => s.setTempleStatus);
  const [action, setAction] = useState<{ id: string; status: "active" | "rejected" } | null>(null);
  const [cfg, setCfg] = useState({ registration: true, maintenance: false, simulation: true });
  if (!can("platform.manage")) return <NoAccess what="admin platform" />;
  const pending = temples.filter((t) => t.status === "pending");
  return (
    <div>
      <PageHeader title="Admin Platform" description="Tinjau pendaftaran pura dan konfigurasi sistem (simulasi)." />
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4"><p className="text-sm text-muted">Pura aktif</p><p className="text-2xl font-extrabold">{temples.filter((t) => t.status === "active").length}</p></Card>
        <Card className="p-4"><p className="text-sm text-muted">Pengguna</p><p className="text-2xl font-extrabold">{users.length}</p></Card>
        <Card className="p-4"><p className="text-sm text-muted">Transaksi</p><p className="text-2xl font-extrabold">{txCount}</p></Card>
      </div>
      <Card className="mt-5">
        <CardHeader title="Pendaftaran menunggu peninjauan" />
        <CardBody className="space-y-3">
          {pending.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
              <Building2 className="h-6 w-6 text-amber-700" />
              <div className="min-w-0 flex-1"><p className="font-bold">{t.name}</p><p className="flex items-center gap-1 text-sm text-muted"><MapPin className="h-3.5 w-3.5" /> {t.address} · daftar {formatDateShort(t.createdAt)}</p></div>
              <Button onClick={() => setAction({ id: t.id, status: "active" })}><CheckCircle2 className="h-4 w-4" /> Setujui</Button>
              <Button variant="outline" className="text-expense" onClick={() => setAction({ id: t.id, status: "rejected" })}><XCircle className="h-4 w-4" /> Tolak</Button>
            </div>
          ))}
          {!pending.length && <p className="text-muted">Tidak ada pendaftaran baru.</p>}
        </CardBody>
      </Card>
      <Card className="mt-5">
        <CardHeader title="Semua pura" />
        <CardBody className="divide-y divide-line py-1">
          {temples.map((t) => (
            <div key={t.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1"><Link href={`/pura/${t.slug}`} className="font-semibold hover:text-emerald-700">{t.name}</Link><p className="text-sm text-muted">{t.regency}, {t.province}</p></div>
              <Badge tone={t.status === "active" ? "green" : t.status === "pending" ? "amber" : "red"} dot>{t.status === "active" ? "Aktif" : t.status === "pending" ? "Menunggu" : "Ditolak"}</Badge>
            </div>
          ))}
        </CardBody>
      </Card>
      <Card className="mt-5">
        <CardHeader title="Konfigurasi sistem" description="Simulasi — tidak mengubah perilaku server mana pun." />
        <CardBody className="divide-y divide-line py-1">
          <Switch checked={cfg.registration} onChange={(v) => { setCfg({ ...cfg, registration: v }); toast.success("Disimpan (simulasi)"); }} label="Buka pendaftaran pura baru" />
          <Switch checked={cfg.simulation} onChange={(v) => { setCfg({ ...cfg, simulation: v }); toast.success("Disimpan (simulasi)"); }} label="Izinkan donasi simulasi" />
          <Switch checked={cfg.maintenance} onChange={(v) => { setCfg({ ...cfg, maintenance: v }); toast.success("Disimpan (simulasi)"); }} label="Mode pemeliharaan" />
        </CardBody>
      </Card>
      <p className="mt-4 flex items-center gap-2 text-sm text-muted"><ShieldCheck className="h-4 w-4" /> Di versi produksi, tindakan admin platform diotorisasi dan dicatat di server.</p>
      <ConfirmDialog open={!!action} onClose={() => setAction(null)} tone={action?.status === "rejected" ? "danger" : "primary"} title={action?.status === "active" ? "Setujui pendaftaran?" : "Tolak pendaftaran?"} description={action?.status === "active" ? "Pura akan tampil di direktori publik." : "Pura tidak akan tampil di direktori publik."} onConfirm={() => { if (action) setStatus(action.id, action.status); toast.success(action?.status === "active" ? "Pendaftaran disetujui" : "Pendaftaran ditolak"); setAction(null); }} />
    </div>
  );
}
