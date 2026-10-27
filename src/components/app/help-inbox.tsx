"use client";
import { useCallback, useEffect, useState } from "react";
import { LifeBuoy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { HelpThread, STATUS_TONE } from "@/components/shared/help-thread";
import { api, useStore } from "@/lib/store";
import { cn, formatDateTime } from "@/lib/format";
import { HELP_CATEGORY_LABEL, HELP_STATUS_LABEL, type HelpStatus, type HelpTicket } from "@/lib/help";

/** Admin Utama's inbox for the Pusat bantuan (Back Office → Bantuan). */
export function HelpInbox() {
  const run = useStore((s) => s.run);
  const refresh = useStore((s) => s.refresh);
  const [tickets, setTickets] = useState<HelpTicket[] | null>(null);
  const [filter, setFilter] = useState<"semua" | HelpStatus>("semua");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { json } = await api<{ tickets: HelpTicket[] }>("/api/admin/bantuan");
    if (json.ok) setTickets(json.tickets);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function toggle(t: HelpTicket) {
    const next = openId === t.id ? null : t.id;
    setOpenId(next);
    if (next && t.unreadByAdmin) {
      await run("readHelp", { ticketId: t.id });
      await Promise.all([load(), refresh()]);
    }
  }
  const changed = async () => {
    await Promise.all([load(), refresh()]);
  };

  const count = (s: HelpStatus) => tickets?.filter((t) => t.status === s).length ?? 0;
  const list = (tickets ?? []).filter((t) => filter === "semua" || t.status === filter);
  return (
    <div className="mt-4">
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
        <Segmented
          value={filter}
          onChange={setFilter}
          ariaLabel="Saring status pesan"
          options={[
            { value: "semua", label: "Semua" },
            { value: "baru", label: `Baru (${count("baru")})` },
            { value: "diproses", label: `Diproses (${count("diproses")})` },
            { value: "selesai", label: "Selesai" },
          ]}
        />
      </div>
      {!tickets && <Skeleton className="mt-4 h-40" />}
      {tickets && !list.length && <Card className="mt-4"><EmptyState icon={LifeBuoy} title="Tidak ada pesan" description="Pesan dari tombol bantuan akan muncul di sini." /></Card>}
      <ul className="mt-4 space-y-3">
        {list.map((t) => (
          <li key={t.id}>
            <Card className={cn("p-4", t.unreadByAdmin && "border-gold ring-2 ring-gold-light")}>
              <button type="button" className="flex w-full flex-wrap items-center gap-2 text-left" aria-expanded={openId === t.id} onClick={() => toggle(t)}>
                <Badge tone={STATUS_TONE[t.status]}>{HELP_STATUS_LABEL[t.status]}</Badge>
                <span className="font-semibold">{HELP_CATEGORY_LABEL[t.category]}</span>
                {t.unreadByAdmin && <Badge tone="red">Belum dibaca</Badge>}
                <span className="ml-auto text-sm text-muted">{formatDateTime(t.updatedAt)}</span>
                <span className="w-full truncate text-[15px] text-muted">{t.user?.name} — {t.message}</span>
              </button>
              {openId === t.id && <div className="mt-4 border-t border-line pt-4"><HelpThread t={t} admin onChanged={changed} /></div>}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
