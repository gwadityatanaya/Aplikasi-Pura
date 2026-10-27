"use client";
import Link from "next/link";
import { CalendarClock, Users } from "lucide-react";
import { TempleCover } from "@/components/brand/temple-cover";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { campaignStats } from "@/lib/ledger";
import { cn, daysBetween, formatPercent, rupiah, todayISO } from "@/lib/format";
import type { Campaign, Donation, Temple } from "@/lib/types";

export function daysLeftLabel(end: string) {
  const d = daysBetween(todayISO(), end);
  if (d < 0) return "Telah berakhir";
  if (d === 0) return "Berakhir hari ini";
  return `${d} hari lagi`;
}

export function CampaignStatusBadge({ status }: { status: Campaign["status"] }) {
  if (status === "active") return <Badge tone="emerald" dot>Aktif</Badge>;
  if (status === "draft") return <Badge tone="gray" dot>Draf</Badge>;
  return <Badge tone="gold" dot>Selesai</Badge>;
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
          {showStatus && <CampaignStatusBadge status={campaign.status} />}
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
            <p className="tabular text-sm font-bold text-emerald-700">{formatPercent(s.progress)}</p>
          </div>
          <Progress value={s.progress} className="mt-2" label={`Progres ${campaign.title}`} />
          <div className="mt-3 flex items-center justify-between text-sm text-muted">
            <span className="tabular">dari {rupiah(campaign.target)}</span>
          </div>
          <div className="mt-3 flex items-center gap-4 border-t border-line pt-3 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" aria-hidden /> {s.contributors} donatur
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4" aria-hidden /> {campaign.status === "completed" ? "Selesai" : daysLeftLabel(campaign.endDate)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
