"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, LifeBuoy, MessageSquarePlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { HelpForm } from "@/components/shared/help-button";
import { HelpThread, STATUS_TONE } from "@/components/shared/help-thread";
import { useRequireLogin } from "@/components/umat/use-umat";
import { api, useAccess, useStore } from "@/lib/store";
import { cn, formatDateTime } from "@/lib/format";
import { HELP_CATEGORY_LABEL, HELP_STATUS_LABEL, type HelpTicket } from "@/lib/help";

/** Bantuan: my messages to Admin Utama and the replies (for every signed-in person). */
export default function HelpPage() {
  const { ready, me } = useRequireLogin();
  const isStaff = useAccess().isStaff;
  const run = useStore((s) => s.run);
  const refresh = useStore((s) => s.refresh);
  const [tickets, setTickets] = useState<HelpTicket[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const load = useCallback(async () => {
    const { json } = await api<{ tickets: HelpTicket[] }>("/api/bantuan");
    if (json.ok) setTickets(json.tickets);
  }, []);
  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function toggle(t: HelpTicket) {
    const next = openId === t.id ? null : t.id;
    setOpenId(next);
    if (next && t.unreadByUser) {
      await run("readHelp", { ticketId: t.id });
      await Promise.all([load(), refresh()]);
    }
  }

  if (!ready || !me) return <div className="container max-w-2xl py-10"><Skeleton className="h-64 rounded-3xl" /></div>;
  return (
    <div className="container max-w-2xl py-8">
      <Link href={isStaff ? "/app" : "/umat"} className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-800"><ArrowLeft className="h-4 w-4" /> Kembali</Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-forest">Bantuan</h1>
          <p className="text-[15px] text-muted">Pesan Anda kepada Admin Utama dan balasannya.</p>
        </div>
        <Button onClick={() => setNewOpen(true)}><MessageSquarePlus className="h-5 w-5" /> Kirim pesan baru</Button>
      </div>

      {!tickets && <Skeleton className="mt-6 h-40 rounded-3xl" />}
      {tickets && !tickets.length && <Card className="mt-6"><EmptyState icon={LifeBuoy} title="Belum ada pesan" description="Tekan tombol bantuan (pelampung) di pojok layar kapan saja untuk bertanya atau melaporkan masalah." /></Card>}
      <ul className="mt-6 space-y-3">
        {tickets?.map((t) => (
          <li key={t.id}>
            <Card className={cn("p-4", t.unreadByUser && "border-emerald-400 ring-2 ring-emerald-100")}>
              <button type="button" className="flex w-full flex-wrap items-center gap-2 text-left" aria-expanded={openId === t.id} onClick={() => toggle(t)}>
                <Badge tone={STATUS_TONE[t.status]}>{HELP_STATUS_LABEL[t.status]}</Badge>
                <span className="font-semibold">{HELP_CATEGORY_LABEL[t.category]}</span>
                {t.unreadByUser && <Badge tone="emerald">Balasan baru</Badge>}
                <span className="ml-auto text-sm text-muted">{formatDateTime(t.updatedAt)}</span>
                <span className="w-full truncate text-[15px] text-muted">{t.message}</span>
              </button>
              {openId === t.id && <div className="mt-4 border-t border-line pt-4"><HelpThread t={t} onChanged={load} /></div>}
            </Card>
          </li>
        ))}
      </ul>
      <HelpForm open={newOpen} onClose={() => { setNewOpen(false); load(); }} page="/bantuan" unread={0} />
    </div>
  );
}
