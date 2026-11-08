"use client";
import Link from "next/link";
import { CalendarClock, Users } from "lucide-react";
import { TempleCover } from "@/components/brand/temple-cover";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { campaignStats } from "@/lib/ledger";
import { cn, daysBetween, formatDate, formatPercent, rupiah, todayISO } from "@/lib/format";
import { campaignPhase, hasTarget } from "@/lib/campaign";
import type { Campaign, Donation, Temple } from "@/lib/types";

export function daysLeftLabel(end?: string) {
  if (!end) return "Tanpa batas waktu";
  const d = daysBetween(todayISO(), end);
  if (d < 0) return "Telah berakhir";
  if (d === 0) return "Berakhir hari ini";
  return `${d} hari lagi`;
}

/** Aktif / Draf / Berakhir (end date passed) / Ditutup (closed early, with a public reason). */
export function CampaignStatusBadge({ campaign }: { campaign: Campaign }) {
  const phase = campaignPhase(campaign, todayISO());
  if (phase === "active") return <Badge tone="emerald" dot>Aktif</Badge>;
  if (phase === "draft") return <Badge tone="gray" dot>Draf</Badge>;
  if (phase === "ended") return <Badge tone="gold" dot>Berakhir</Badge>;
  return <Badge tone="dark" dot>Ditutup</Badge>;
}

/** Short line under a campaign: days left, "Berakhir", or "Ditutup <tanggal>". */
export function campaignTimeLabel(c: Campaign) {
  const phase = campaignPhase(c, todayISO());
  if (phase === "closed") return c.closedAt ? `Ditutup ${formatDate(c.closedAt)}` : "Ditutup";
  if (phase === "ended") return `Berakhir ${formatDate(c.endDate!)}`;
  return daysLeftLabel(c.endDate);
}

export function CampaignCard({
  campaign,
  temple,
  donations,
  href,
  showStatus,
  className,
}: {
  campaign: Campaign;
  temple?: Temple;
  donations: Donation[];
  href: string;
  showStatus?: boolean;
  className?: string;
}) {
  const s = campaignStats(campaign, donations);
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col overflow-hidden rounded-3xl border border-line/80 bg-white shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift focus-visible:ring-2 focus-visible:ring-emerald-500",
        className
      )}
    >
      <TempleCover variant={campaign.cover} image={campaign.coverImage} className="aspect-[16/8] w-full">
        <div className="absolute left-3 top-3 flex gap-2">
          {(showStatus || campaignPhase(campaign, todayISO()) !== "active") && <CampaignStatusBadge campaign={campaign} />}
        </div>
      </TempleCover>
      <div className="flex flex-1 flex-col p-5">
        {temple && <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">{temple.name}</p>}
        <h3 className="mt-1 line-clamp-2 text-lg font-bold leading-snug text-charcoal group-hover:text-emerald-800">{campaign.title}</h3>
        <div className="mt-auto pt-4">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-xs text-muted">Terkumpul</p>
              <p className="tabular text-lg font-extrabold text-charcoal">{rupiah(s.collected)}</p>
            </div>
            {hasTarget(campaign) && <p className="tabular text-sm font-bold text-emerald-700">{formatPercent(s.progress)}</p>}
          </div>
          {hasTarget(campaign) && (
            <>
              <Progress value={s.progress} className="mt-2" label={`Progres ${campaign.title}`} />
              <div className="mt-3 flex items-center justify-between text-sm text-muted">
                <span className="tabular">dari {rupiah(campaign.target)}</span>
              </div>
            </>
          )}
          <div className="mt-3 flex items-center gap-4 border-t border-line pt-3 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" aria-hidden /> {s.contributors} donatur
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4" aria-hidden /> {campaignTimeLabel(campaign)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/** "Ditutup" / "Berakhir" notice with the public reason and any later notes (shown to everyone). */
export function CampaignEndNotice({ campaign, className }: { campaign: Campaign; className?: string }) {
  const phase = campaignPhase(campaign, todayISO());
  if (phase !== "closed" && phase !== "ended") return null;
  return (
    <div role="status" className={cn("rounded-2xl border border-stone-300 bg-stone-50 p-4 text-[0.9375rem] text-stone-800", className)}>
      {phase === "closed" ? (
        <>
          <p className="font-bold">Penggalangan ini ditutup{campaign.closedAt ? ` pada ${formatDate(campaign.closedAt)}` : ""} dan tidak lagi menerima punia baru.</p>
          {campaign.closeReason && <p className="mt-1">Alasan: {campaign.closeReason}</p>}
          {!!campaign.closeNotes?.length && (
            <ul className="mt-2 space-y-1 border-t border-stone-200 pt-2 text-sm">
              {campaign.closeNotes.map((n) => <li key={n.at}><span className="font-semibold">Catatan tambahan {formatDate(n.at)}:</span> {n.text}</li>)}
            </ul>
          )}
        </>
      ) : (
        <p className="font-bold">Penggalangan ini berakhir pada {formatDate(campaign.endDate!)} dan tidak lagi menerima punia baru.</p>
      )}
    </div>
  );
}
