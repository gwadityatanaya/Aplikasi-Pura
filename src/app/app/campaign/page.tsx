"use client";
import Link from "next/link";
import { useState } from "react";
import { Megaphone, Plus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { useCan, useWorkspace } from "@/components/app/hooks";
import { CampaignCard } from "@/components/shared/campaign-card";
import { Segmented } from "@/components/ui/segmented";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { campaignStats } from "@/lib/ledger";
import { rupiah } from "@/lib/format";
import type { CampaignStatus } from "@/lib/types";

export default function CampaignsAdminPage() {
  const ws = useWorkspace();
  const can = useCan();
  const [tab, setTab] = useState<CampaignStatus>("active");
  const counts = { active: 0, draft: 0, completed: 0 } as Record<CampaignStatus, number>;
  ws.campaigns.forEach((c) => counts[c.status]++);
  const list = ws.campaigns.filter((c) => c.status === tab);
  const all = ws.campaigns.filter((c) => c.status !== "draft").map((c) => campaignStats(c, ws.donations));
  const totalCollected = all.reduce((s, x) => s + x.collected, 0);
  const pending = ws.donations.filter((d) => d.status === "pending");

  return (
    <div>
      <PageHeader
        title="Penggalangan Dana"
        description="Kelola campaign, verifikasi donasi, dan pantau progres."
        actions={can("campaign.manage") && <Link href="/app/campaign/baru" className={buttonClass("primary")}><Plus className="h-4 w-4" /> Buat campaign</Link>}
      />
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Card className="p-4"><p className="text-sm text-muted">Total terverifikasi</p><p className="tabular mt-1 text-lg font-extrabold text-forest">{rupiah(totalCollected)}</p></Card>
        <Card className="p-4"><p className="text-sm text-muted">Donatur</p><p className="tabular mt-1 text-lg font-extrabold">{all.reduce((s, x) => s + x.contributors, 0)}</p></Card>
        <Card className="p-4"><p className="text-sm text-muted">Menunggu verifikasi</p><p className="tabular mt-1 text-lg font-extrabold text-amber-700">{pending.length}</p></Card>
      </div>
      <Segmented
        value={tab}
        onChange={setTab}
        ariaLabel="Status campaign"
        options={[
          { value: "active", label: `Aktif (${counts.active})` },
          { value: "draft", label: `Draf (${counts.draft})` },
          { value: "completed", label: `Selesai (${counts.completed})` },
        ]}
      />
      <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((c) => {
          const p = campaignStats(c, ws.donations).pending.length;
          return (
            <div key={c.id} className="relative">
              <CampaignCard campaign={c} donations={ws.donations} href={`/app/campaign/${c.id}`} showStatus />
              {p > 0 && <span className="absolute right-3 top-3 rounded-full bg-amber-400 px-2.5 py-1 text-xs font-bold text-charcoal shadow">{p} menunggu verifikasi</span>}
            </div>
          );
        })}
      </div>
      {list.length === 0 && (
        <Card className="mt-5"><EmptyState icon={Megaphone} title="Belum ada campaign di sini" description="Buat penggalangan dana untuk upacara atau pembangunan pura." action={can("campaign.manage") && <Link href="/app/campaign/baru" className={buttonClass("primary")}>Buat campaign</Link>} /></Card>
      )}
    </div>
  );
}
