"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Copy, FlaskConical, HandHeart, Landmark, MapPin, Megaphone, Target, Users } from "lucide-react";
import { toast } from "sonner";
import { TempleCover } from "@/components/brand/temple-cover";
import { OrnamentDivider } from "@/components/brand/ornament";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button, buttonClass } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { AnimatedRupiah } from "@/components/ui/animated-number";
import { CampaignEndNotice, CampaignStatusBadge, daysLeftLabel } from "@/components/shared/campaign-card";
import { campaignPhase, hasTarget } from "@/lib/campaign";
import { ShareActions } from "@/components/shared/share";
import { BankChoice } from "@/components/public/bank-choice";
import { DonationFeed, DonorList } from "@/components/public/donations";
import { usePublicData } from "@/lib/public";
import { campaignStats } from "@/lib/ledger";
import { formatDate, formatDateShort, formatPercent, rupiah, todayISO } from "@/lib/format";

export default function CampaignPage() {
  const { slug } = useParams<{ slug: string }>();
  const { hydrated, temples, campaigns, donations } = usePublicData();
  const campaign = campaigns.find((c) => c.slug === slug);
  const temple = temples.find((t) => t.id === campaign?.templeId);

  if (!hydrated)
    return (
      <div className="container space-y-6 py-8">
        <Skeleton className="h-72 rounded-[2rem]" />
        <Skeleton className="h-48" />
      </div>
    );
  if (!campaign || !temple)
    return (
      <div className="container py-16">
        <EmptyState icon={Megaphone} title="Penggalangan dana tidak ditemukan" description="Mungkin belum dipublikasikan atau tautannya salah." action={<Link href="/donasi" className="font-semibold text-emerald-700">Lihat penggalangan lain</Link>} />
      </div>
    );

  const own = donations.filter((d) => d.campaignId === campaign.id);
  const s = campaignStats(campaign, own);
  const showBank = temple.acceptsPunia;
  const puniaHref = `/pura/${temple.slug}/punia?campaign=${campaign.id}`;
  const showDonors = campaign.showDonorList && temple.transparency.showDonorList;
  const phase = campaignPhase(campaign, todayISO());
  const open = phase === "active";
  const target = hasTarget(campaign);
  const shareMsg = `🙏 ${campaign.title}\n${temple.name}\nTerkumpul ${rupiah(s.collected)}${target ? ` dari ${rupiah(campaign.target)} (${formatPercent(s.progress)})` : ""}.${open ? " Mari berpunia bersama:" : ""}`;
  const facts = [
    campaign.purpose && { icon: Target, label: "Dana digunakan untuk", value: campaign.purpose },
    { icon: CalendarDays, label: "Mulai", value: formatDate(campaign.startDate) },
    campaign.endDate && { icon: CalendarDays, label: "Berakhir", value: formatDate(campaign.endDate) },
  ].filter(Boolean) as { icon: typeof Target; label: string; value: string }[];

  return (
    <div className="pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-12">
      <div className="container pt-4 md:pt-6">
        <TempleCover variant={campaign.cover} image={campaign.coverImage} alt={`Sampul ${campaign.title}`} className="h-56 rounded-[2rem] md:h-[340px]">
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
          <div className="absolute left-5 top-5"><CampaignStatusBadge campaign={campaign} /></div>
        </TempleCover>
      </div>
      <div className="container mt-6 grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="min-w-0 space-y-6">
          <div>
            <Link href={`/pura/${temple.slug}`} className="inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-emerald-700 hover:underline">
              <MapPin className="h-4 w-4" /> {temple.name}
            </Link>
            <h1 className="mt-2 text-balance text-3xl font-extrabold leading-tight text-forest md:text-4xl">{campaign.title}</h1>
            <CampaignEndNotice campaign={campaign} className="mt-4" />
            {campaign.description && <p className="mt-4 whitespace-pre-line text-[1.0625rem] leading-relaxed text-charcoal/80">{campaign.description}</p>}
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {facts.map((f) => <Info key={f.label} icon={f.icon} label={f.label} value={f.value} />)}
            </div>
          </div>

          <Card data-tour="donor-list">
            <CardHeader title="Daftar donatur" description="Ditampilkan sesuai izin masing-masing donatur" action={<span className="rounded-full bg-mint px-2.5 py-1 text-xs font-bold text-emerald-800">{s.contributors} donatur</span>} />
            <CardBody>{showDonors ? <DonorList donations={own} /> : <p className="text-muted">Pengurus memilih tidak menampilkan daftar donatur.</p>}</CardBody>
          </Card>

          <Card>
            <CardHeader title="Kabar terbaru" />
            <CardBody>
              {campaign.updates.length ? (
                <ol className="relative space-y-6 border-l-2 border-mint pl-6">
                  {campaign.updates.map((u) => (
                    <li key={u.id} className="relative">
                      <span className="absolute -left-[33px] top-1 h-4 w-4 rounded-full border-4 border-white bg-emerald-600 shadow" aria-hidden />
                      <p className="text-xs font-semibold text-muted">{formatDateShort(u.date)}</p>
                      <h3 className="font-bold text-charcoal">{u.title}</h3>
                      <p className="mt-1 leading-relaxed text-charcoal/80">{u.body}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-muted">Belum ada kabar terbaru.</p>
              )}
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <Card className="overflow-hidden" data-tour="public-progress">
            <div className="p-6">
              <p className="text-sm font-medium text-muted">Terkumpul &amp; disahkan</p>
              <AnimatedRupiah value={s.collected} className="tabular mt-1 block text-4xl font-extrabold tracking-tight text-forest" />
              {target && (
                <>
                  <p className="mt-1 text-sm text-muted">dari target <span className="tabular font-semibold text-charcoal">{rupiah(campaign.target)}</span></p>
                  <Progress value={s.progress} className="mt-4" height="h-3.5" label="Progres penggalangan" />
                </>
              )}
              <div className={`mt-4 grid gap-2 text-center ${target ? "grid-cols-3" : "grid-cols-2"}`}>
                {target && <Stat value={formatPercent(s.progress)} label="tercapai" />}
                <Stat value={String(s.contributors)} label="donatur" icon={Users} />
                <Stat value={phase === "closed" ? "Ditutup" : phase === "ended" ? "Berakhir" : campaign.endDate ? daysLeftLabel(campaign.endDate).replace(" lagi", "") : "Tanpa batas"} label={open && campaign.endDate ? "tersisa" : phase === "active" ? "waktu" : ""} />
              </div>
              {open && (
                showBank ? (
                  <Link href={puniaHref} className={buttonClass("primary", "xl", "mt-5 w-full")}>
                    <HandHeart className="h-5 w-5" /> Saya sudah transfer — unggah bukti
                  </Link>
                ) : (
                  <p className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Info rekening pura belum tersedia.</p>
                )
              )}
            </div>
            {showBank && open && (
              <div className="border-t border-line bg-ivory/70 p-6">
                <h2 className="font-bold">Cara berpunia</h2>
                {campaign.instructions && <p className="mt-1 text-[0.9375rem] leading-relaxed text-charcoal/80">{campaign.instructions}</p>}
                <div className="mt-3"><BankChoice temple={temple} /></div>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Aktivitas terbaru" />
            <CardBody>
              <DonationFeed donations={own} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Bagikan" description="Ajak krama ikut berpunia" />
            <CardBody>
              <ShareActions path={`/donasi/${campaign.slug}`} title={campaign.title} message={shareMsg} />
            </CardBody>
          </Card>
        </aside>
      </div>
      <OrnamentDivider className="container mt-12 max-w-md" />
      {open && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="tabular truncate text-sm font-extrabold text-forest">{rupiah(s.collected)} {target && <span className="font-medium text-muted">· {formatPercent(s.progress)}</span>}</p>
              {target && <Progress value={s.progress} className="mt-1.5" height="h-1.5" label="Progres penggalangan" />}
            </div>
            <Link href={puniaHref} className={buttonClass("primary", "lg")}><HandHeart className="h-5 w-5" /> Berpunia</Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted"><Icon className="h-3.5 w-3.5" /> {label}</p>
      <p className="mt-1 font-semibold leading-snug text-charcoal">{value}</p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string; icon?: typeof Users }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-ivory px-2 py-2.5">
      <p className="tabular text-base font-extrabold text-charcoal">{value}</p>
      {label && <p className="text-xs text-muted">{label}</p>}
    </motion.div>
  );
}
