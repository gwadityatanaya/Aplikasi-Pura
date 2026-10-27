"use client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ChevronRight, Landmark, Users } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useAccess, useStore } from "@/lib/store";
import { cn } from "@/lib/format";
import type { Temple } from "@/lib/types";

/** Pengurus Banjar: every temple the banjar supports, with what needs attention first. */
export default function BanjarOverview() {
  const access = useAccess();
  const temples = useStore((s) => s.data.temples);
  const banjars = useStore((s) => s.data.banjars);
  const activeId = useStore((s) => s.session?.activeTempleId);
  const setActive = useStore((s) => s.setActiveTemple);
  const router = useRouter();

  const myBanjars = access.isSuperAdmin ? banjars : banjars.filter((b) => access.banjarIds.includes(b.id));
  const totalPending = temples.reduce((n, t) => n + (t.pendingCount ?? 0), 0);
  const noPengurus = temples.filter((t) => (t.pengurusCount ?? 0) === 0);

  async function open(t: Temple, to: string) {
    if (t.id !== activeId) {
      const r = await setActive(t.id);
      if (!r.ok) return toast.error(r.error);
    }
    router.push(to);
  }

  if (!myBanjars.length) return <EmptyState icon={Users} title="Anda belum terdaftar sebagai Pengurus Banjar" description="Minta Admin Utama mendaftarkan email Anda di Back Office." />;

  return (
    <div>
      <PageHeader title="Pura Banjar Saya" description="Semua pura yang diempon banjar Anda. Ketuk pura untuk memverifikasi punia atau melihat kasnya." />
      <div className="mb-5 grid grid-cols-2 gap-3">
        <Card className="p-4"><p className="text-sm text-muted">Punia menunggu</p><p className="text-3xl font-extrabold text-amber-700">{totalPending}</p></Card>
        <Card className="p-4"><p className="text-sm text-muted">Pura tanpa pengurus</p><p className="text-3xl font-extrabold text-sky-800">{noPengurus.length}</p></Card>
      </div>
      {noPengurus.length > 0 && (
        <p className="mb-5 flex gap-2 rounded-2xl bg-sky-50 p-4 text-[15px] text-sky-900">
          <AlertTriangle className="h-5 w-5 shrink-0" /> Punia untuk pura yang belum punya pengurus diverifikasi oleh Pengurus Banjar.
        </p>
      )}

      {myBanjars.map((b) => {
        const list = temples.filter((t) => t.banjarIds?.includes(b.id));
        return (
          <section key={b.id} className="mb-6">
            <h2 className="mb-2 text-lg font-bold">{/^banjar/i.test(b.name) ? b.name : `Banjar ${b.name}`}</h2>
            {!list.length && <p className="text-muted">Belum ada pura untuk banjar ini.</p>}
            <ul className="space-y-2">
              {list.map((t) => {
                const pending = t.pendingCount ?? 0;
                const shared = (t.banjarIds?.length ?? 0) > 1;
                return (
                  <li key={t.id}>
                    <Card className={cn("flex items-center gap-3 p-4", t.id === activeId && "ring-2 ring-emerald-500/40")}>
                      <Landmark className="h-6 w-6 shrink-0 text-emerald-700" />
                      <button className="min-w-0 flex-1 text-left" onClick={() => open(t, "/app")}>
                        <p className="font-bold">{t.name}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {(t.pengurusCount ?? 0) === 0 ? <Badge tone="blue">Pengurus pura belum terdaftar</Badge> : <Badge tone="gray">{t.pengurusCount} pengurus</Badge>}
                          {shared && <Badge tone="violet">Diempon {t.banjarIds!.length} banjar</Badge>}
                          {!t.bankAccountNumber && <Badge tone="red">Rekening belum diisi</Badge>}
                        </div>
                      </button>
                      <button
                        onClick={() => open(t, "/app/punia")}
                        className={cn("press flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-sm font-bold", pending ? "bg-amber-100 text-amber-900" : "bg-stone-100 text-stone-600")}
                      >
                        {pending} menunggu <ChevronRight className="h-4 w-4" />
                      </button>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
