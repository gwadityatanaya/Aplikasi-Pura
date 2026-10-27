"use client";
import { useState } from "react";
import { Megaphone } from "lucide-react";
import { CampaignCard } from "@/components/shared/campaign-card";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { usePublicData } from "@/lib/public";

export default function CampaignsPage() {
  const { hydrated, temples, campaigns, donations } = usePublicData();
  const [tab, setTab] = useState<"active" | "completed">("active");
  const list = campaigns.filter((c) => c.status === tab);
  return (
    <div className="container py-10">
      <h1 className="text-3xl font-extrabold text-forest md:text-4xl">Penggalangan Dana</h1>
      <p className="mt-2 text-lg text-muted">Semua total hanya menghitung donasi yang sudah diverifikasi pengurus pura.</p>
      <Segmented
        className="mt-6"
        value={tab}
        onChange={setTab}
        ariaLabel="Status penggalangan"
        options={[
          { value: "active", label: "Sedang berjalan" },
          { value: "completed", label: "Selesai" },
        ]}
      />
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {!hydrated
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-96 rounded-3xl" />)
          : list.map((c) => (
              <CampaignCard key={c.id} campaign={c} temple={temples.find((t) => t.id === c.templeId)} donations={donations} href={`/donasi/${c.slug}`} />
            ))}
      </div>
      {hydrated && list.length === 0 && <EmptyState icon={Megaphone} title="Belum ada penggalangan" description="Penggalangan dana yang dipublikasikan pura akan tampil di sini." />}
    </div>
  );
}
