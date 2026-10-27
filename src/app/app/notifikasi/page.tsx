"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BellOff, CheckCheck, FileBarChart2, HandCoins, Info, PartyPopper, ReceiptText, Timer } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { useWorkspace } from "@/components/app/hooks";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import { useStore } from "@/lib/store";
import { notificationVisible } from "@/components/app/app-shell";
import { cn, relativeTime } from "@/lib/format";
import type { NotificationKind } from "@/lib/types";
import { toast } from "sonner";

const KIND: Record<NotificationKind, { icon: typeof Info; tone: string }> = {
  donation_pending: { icon: HandCoins, tone: "bg-amber-50 text-amber-700" },
  target_reached: { icon: PartyPopper, tone: "bg-gold-light text-gold-dark" },
  report_ready: { icon: FileBarChart2, tone: "bg-violet-50 text-violet-700" },
  tx_approval: { icon: ReceiptText, tone: "bg-sky-50 text-sky-700" },
  campaign_ending: { icon: Timer, tone: "bg-orange-50 text-orange-700" },
  info: { icon: Info, tone: "bg-mint text-emerald-700" },
};

export default function NotificationsPage() {
  const ws = useWorkspace();
  const router = useRouter();
  const markRead = useStore((s) => s.markNotificationRead);
  const markAll = useStore((s) => s.markAllNotificationsRead);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const prefs = useStore((s) => s.prefs.notifications);
  const visible = ws.notifications.filter((n) => notificationVisible(n.kind, prefs));
  const list = [...visible].sort((a, b) => b.date.localeCompare(a.date)).filter((n) => tab === "all" || !n.read);
  const unread = visible.filter((n) => !n.read).length;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifikasi"
        description={unread ? `${unread} belum dibaca` : "Semua sudah dibaca"}
        actions={
          <>
                        {unread > 0 && <Button variant="secondary" onClick={markAll}><CheckCheck className="h-4 w-4" /> Tandai semua dibaca</Button>}
          </>
        }
      />
      <Segmented value={tab} onChange={setTab} ariaLabel="Filter notifikasi" options={[{ value: "all", label: "Semua" }, { value: "unread", label: `Belum dibaca (${unread})` }]} />
      <Card className="mt-4 overflow-hidden">
        <ul className="divide-y divide-line">
          <AnimatePresence initial={false}>
            {list.map((n) => {
              const k = KIND[n.kind];
              return (
                <motion.li key={n.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                  <button
                    onClick={() => { markRead(n.id); if (n.href) router.push(n.href); }}
                    className={cn("flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-ivory md:p-5", !n.read && "bg-mint/25")}
                  >
                    <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", k.tone)}><k.icon className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-3">
                        <span className={cn("text-[15px]", n.read ? "font-semibold" : "font-bold")}>{n.title}</span>
                        <span className="shrink-0 text-xs text-muted">{relativeTime(n.date)}</span>
                      </span>
                      <span className="mt-0.5 block text-sm leading-relaxed text-muted">{n.body}</span>
                    </span>
                    {!n.read && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-600" aria-label="Belum dibaca" />}
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
        {!list.length && <EmptyState icon={BellOff} title="Tidak ada notifikasi" description="Kabar penting seperti donasi baru akan muncul di sini." />}
      </Card>
    </div>
  );
}
