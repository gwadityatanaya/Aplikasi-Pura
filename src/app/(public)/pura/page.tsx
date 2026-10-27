"use client";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MapPin, Megaphone, Search, SearchX } from "lucide-react";
import { TempleCover } from "@/components/brand/temple-cover";
import { Select } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { usePublicData } from "@/lib/public";

function Directory() {
  const params = useSearchParams();
  const { hydrated, temples, campaigns } = usePublicData();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [regency, setRegency] = useState("");
  const regencies = useMemo(() => Array.from(new Set(temples.map((t) => t.regency))).sort(), [temples]);
  const list = temples.filter((t) => {
    const s = `${t.name} ${t.regency} ${t.district} ${t.village} ${t.province}`.toLowerCase();
    return (!q || s.includes(q.toLowerCase())) && (!regency || t.regency === regency);
  });

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-extrabold text-forest md:text-4xl">Direktori Pura</h1>
      <p className="mt-2 text-lg text-muted">Temukan pura, lihat penggalangan dana dan laporan keuangan yang dipublikasikan.</p>
      <div className="mt-6 grid gap-3 md:grid-cols-[1fr_260px]">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="q" className="sr-only">Cari nama pura</label>
          <input
            id="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama pura, desa, atau kecamatan…"
            className="h-12 w-full rounded-xl border border-line bg-white pl-12 pr-4 text-[16px] focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/15"
          />
        </div>
        <Select value={regency} onChange={(e) => setRegency(e.target.value)} aria-label="Filter lokasi">
          <option value="">Semua lokasi</option>
          {regencies.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </Select>
      </div>
      <p className="mt-4 text-sm text-muted" aria-live="polite">{hydrated ? `${list.length} pura ditemukan` : "Memuat…"}</p>
      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {!hydrated
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-3xl" />)
          : list.map((t) => {
              const n = campaigns.filter((c) => c.templeId === t.id && c.status === "active").length;
              return (
                <Link key={t.id} href={`/pura/${t.slug}`} className="group overflow-hidden rounded-3xl border border-line bg-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
                  <TempleCover variant={t.cover} image={t.photo} alt={`Sampul ${t.name}`} className="h-40" />
                  <div className="p-5">
                    <h2 className="text-lg font-bold text-charcoal group-hover:text-emerald-800">{t.name}</h2>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                      <MapPin className="h-4 w-4 shrink-0" aria-hidden /> {t.village}, {t.district}, {t.regency}
                    </p>
                    <div className="mt-4 flex items-center justify-between">
                      {n > 0 ? (
                        <Badge tone="emerald"><Megaphone className="h-3.5 w-3.5" /> {n} penggalangan aktif</Badge>
                      ) : (
                        <Badge tone="gray">Belum ada penggalangan aktif</Badge>
                      )}
                      <span className="text-sm font-semibold text-emerald-700">Lihat profil →</span>
                    </div>
                  </div>
                </Link>
              );
            })}
      </div>
      {hydrated && list.length === 0 && (
        <EmptyState icon={SearchX} title="Pura tidak ditemukan" description="Coba kata kunci lain atau hapus filter lokasi." />
      )}
    </div>
  );
}

export default function DirectoryPage() {
  return (
    <Suspense>
      <Directory />
    </Suspense>
  );
}
