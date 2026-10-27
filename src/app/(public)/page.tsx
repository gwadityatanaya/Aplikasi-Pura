"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpenCheck,
  Camera,
  FileBarChart2,
  HandCoins,
  MapPin,
  Megaphone,
  Presentation,
  Search,
  ShieldCheck,
  Smartphone,
  Users,
} from "lucide-react";
import { TempleCover } from "@/components/brand/temple-cover";
import { OrnamentDivider, PatternBg } from "@/components/brand/ornament";
import { CampaignCard } from "@/components/shared/campaign-card";
import { buttonClass } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { DemoButton } from "@/components/demo/demo-tour";
import { usePublicData } from "@/lib/public";
import { campaignStats } from "@/lib/ledger";
import { formatPercent, rupiah } from "@/lib/format";

const fade = { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-60px" }, transition: { duration: 0.5 } };

export default function HomePage() {
  const { hydrated, temples, campaigns, donations } = usePublicData();
  const router = useRouter();
  const [q, setQ] = useState("");
  const active = campaigns.filter((c) => c.status === "active");
  const hero = active.find((c) => c.id === "cp_piodalan") ?? active[0];
  const heroStats = hero ? campaignStats(hero, donations) : null;

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 -z-10 h-[620px] bg-gradient-to-b from-mint/70 via-ivory to-ivory" />
        <div className="container grid items-center gap-10 pb-16 pt-10 md:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-white/80 px-3 py-1.5 text-sm font-semibold text-gold-dark">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" /> Kas pura yang terbuka untuk krama
            </span>
            <h1 className="mt-5 text-balance text-4xl font-extrabold leading-[1.1] tracking-tight text-forest sm:text-5xl lg:text-[3.6rem]">
              Semudah menulis di buku, sekuat sistem keuangan modern.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-charcoal/75">
              PURA membantu pengurus pura mencatat dana punia, pengeluaran upacara, dan menyusun laporan keuangan secara otomatis —
              lalu membagikannya dengan transparan kepada umat.
            </p>
            <form
              className="mt-7 flex max-w-xl items-center gap-2 rounded-2xl border border-line bg-white p-2 shadow-soft focus-within:ring-4 focus-within:ring-emerald-500/15"
              onSubmit={(e) => {
                e.preventDefault();
                router.push(`/pura${q ? `?q=${encodeURIComponent(q)}` : ""}`);
              }}
              role="search"
            >
              <Search className="ml-2 h-5 w-5 shrink-0 text-muted" aria-hidden />
              <label htmlFor="cari-pura" className="sr-only">Cari pura</label>
              <input
                id="cari-pura"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari nama pura atau kabupaten…"
                className="h-11 min-w-0 flex-1 bg-transparent text-[16px] focus:outline-none"
              />
              <button className={buttonClass("primary", "md")} type="submit">Cari</button>
            </form>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <DemoButton variant="dark" className="h-12 px-5" />
              <Link href="/daftar" className={buttonClass("outline", "lg", "h-12")}>
                Daftarkan Pura Anda <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>

          {/* Wallet-style preview */}
          <motion.div initial={{ opacity: 0, y: 30, rotate: -1 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ duration: 0.7, delay: 0.15 }} className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-gold/25 to-emerald-300/30 blur-2xl" />
            {hero && heroStats ? (
              <Link href={`/donasi/${hero.slug}`} className="block overflow-hidden rounded-[2rem] bg-white shadow-lift ring-1 ring-black/5">
                <TempleCover variant={hero.cover} className="h-44">
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-5 pt-12">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gold-light">Penggalangan dana aktif</p>
                    <p className="mt-1 text-lg font-bold leading-snug text-white">{hero.title}</p>
                  </div>
                </TempleCover>
                <div className="p-5 pb-8">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-sm text-muted">Terkumpul (terverifikasi)</p>
                      <p className="tabular text-3xl font-extrabold text-forest">{rupiah(heroStats.collected)}</p>
                    </div>
                    <span className="tabular rounded-full bg-mint px-3 py-1 text-sm font-bold text-emerald-800">{formatPercent(heroStats.progress)}</span>
                  </div>
                  <Progress value={heroStats.progress} className="mt-3" height="h-3" />
                  <div className="mt-3 flex justify-between text-sm text-muted">
                    <span>Target {rupiah(hero.target)}</span>
                    <span>{heroStats.contributors} donatur</span>
                  </div>
                </div>
              </Link>
            ) : hydrated ? (
              <div className="overflow-hidden rounded-[2rem] bg-white shadow-lift ring-1 ring-black/5">
                <TempleCover variant="emerald" className="h-44" />
                <div className="p-5">
                  <p className="font-bold text-forest">Penggalangan dana pura akan tampil di sini</p>
                  <p className="mt-1 text-sm text-muted">Setiap rupiah yang terkumpul ditampilkan setelah diverifikasi pengurus pura.</p>
                </div>
              </div>
            ) : (
              <Skeleton className="h-[330px] rounded-[2rem]" />
            )}
            <div className="relative -mt-3 ml-auto mr-4 w-[78%] overflow-hidden rounded-3xl bg-forest p-5 text-white shadow-card">
              <PatternBg />
              <p className="relative text-xs font-medium text-white/70">Laporan keuangan</p>
              <p className="relative mt-1 text-sm font-semibold">Dipublikasikan untuk krama</p>
              <div className="relative mt-3 flex items-center gap-2 text-xs text-gold-light">
                <ShieldCheck className="h-4 w-4" /> Setiap angka berasal dari transaksi tercatat
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* STATS STRIP */}
      <section className="container">
        <div className="grid grid-cols-2 gap-3 rounded-3xl border border-line bg-white p-5 shadow-soft md:grid-cols-4 md:p-6">
          {[
            { label: "Pura terdaftar", value: hydrated ? temples.length : "–" },
            { label: "Penggalangan aktif", value: hydrated ? active.length : "–" },
            { label: "Dana punia terverifikasi", value: hydrated ? rupiah(campaigns.reduce((s, c) => s + campaignStats(c, donations).collected, 0)) : "–" },
            { label: "Donatur", value: hydrated ? donations.filter((d) => d.status === "verified").length : "–" },
          ].map((s) => (
            <div key={s.label} className="px-1">
              <p className="tabular text-xl font-extrabold text-forest md:text-2xl">{s.value}</p>
              <p className="text-sm text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CAMPAIGNS */}
      <section className="container mt-20">
        <motion.div {...fade} className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-gold-dark">Penggalangan dana</p>
            <h2 className="mt-1 text-3xl font-extrabold text-forest">Mari berpunia bersama</h2>
          </div>
          <Link href="/donasi" className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 hover:underline">
            Lihat semua <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {!hydrated
            ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-96 rounded-3xl" />)
            : active.slice(0, 3).map((c) => (
                <CampaignCard key={c.id} campaign={c} temple={temples.find((t) => t.id === c.templeId)} donations={donations} href={`/donasi/${c.slug}`} />
              ))}
        </div>
        {hydrated && active.length === 0 && <p className="mt-2 rounded-2xl border border-dashed border-line p-8 text-center text-muted">Belum ada penggalangan dana yang aktif.</p>}
      </section>

      {/* FEATURED TEMPLES */}
      <section className="container mt-20">
        <motion.div {...fade} className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-gold-dark">Direktori</p>
            <h2 className="mt-1 text-3xl font-extrabold text-forest">Pura yang terbuka untuk umat</h2>
          </div>
          <Link href="/pura" className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 hover:underline">
            Semua pura <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
        <div className="no-scrollbar -mx-4 mt-6 flex snap-x gap-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
          {!hydrated
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 w-72 shrink-0 rounded-3xl lg:w-auto" />)
            : temples.slice(0, 4).map((t) => (
                <Link key={t.id} href={`/pura/${t.slug}`} className="group w-72 shrink-0 snap-start overflow-hidden rounded-3xl border border-line bg-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift lg:w-auto">
                  <TempleCover variant={t.cover} image={t.photo} className="h-36" />
                  <div className="p-4">
                    <h3 className="font-bold text-charcoal group-hover:text-emerald-800">{t.name}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                      <MapPin className="h-4 w-4" aria-hidden /> {t.regency}, {t.province === "Nusa Tenggara Barat" ? "NTB" : t.province}
                    </p>
                  </div>
                </Link>
              ))}
        </div>
        {hydrated && temples.length === 0 && <p className="mt-2 rounded-2xl border border-dashed border-line p-8 text-center text-muted">Belum ada pura yang dipublikasikan.</p>}
      </section>

      {/* BENEFITS */}
      <section className="container mt-24">
        <OrnamentDivider className="mx-auto mb-10 max-w-md" />
        <motion.div {...fade} className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold text-forest">Dibuat untuk pengurus pura, bukan akuntan</h2>
          <p className="mt-3 text-lg text-muted">Tidak perlu paham Excel. Tombol besar, bahasa sederhana, dan semua hitungan dilakukan otomatis.</p>
        </motion.div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: BookOpenCheck, title: "Catat seperti di buku kas", body: "Isi nominal, pilih jenis, selesai. Saldo kas dan bank dihitung otomatis dari setiap catatan." },
            { icon: Camera, title: "Foto nota langsung", body: "Bukti pengeluaran tersimpan rapi bersama transaksinya. Tidak ada lagi nota tercecer." },
            { icon: Megaphone, title: "Penggalangan dana terbuka", body: "Halaman donasi dengan progres langsung, daftar donatur sesuai izin, dan kabar terbaru." },
            { icon: FileBarChart2, title: "Laporan sekali tekan", body: "Laporan bulanan, per kegiatan, atau per campaign — unduh PDF, Excel, atau bagikan ke WhatsApp." },
            { icon: Presentation, title: "Mode presentasi paruman", body: "Tampilkan laporan di proyektor dengan huruf besar saat rapat atau sebelum upacara." },
            { icon: ShieldCheck, title: "Setiap rupiah tercatat", body: "Transaksi tidak bisa dihapus diam-diam. Koreksi tercatat sebagai entri baru dengan riwayat audit." },
          ].map((f, i) => (
            <motion.div key={f.title} {...fade} transition={{ duration: 0.5, delay: i * 0.05 }} className="rounded-3xl border border-line bg-white p-6 shadow-soft">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-mint text-emerald-700">
                <f.icon className="h-6 w-6" aria-hidden />
              </div>
              <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
              <p className="mt-1.5 leading-relaxed text-muted">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="cara-kerja" className="container mt-24 scroll-mt-24">
        <div className="relative overflow-hidden rounded-[2rem] bg-forest px-6 py-12 text-white md:px-12">
          <PatternBg />
          <div className="relative">
            <p className="text-sm font-bold uppercase tracking-wider text-gold">Cara kerja</p>
            <h2 className="mt-1 text-3xl font-extrabold">Tiga langkah menuju kas yang transparan</h2>
            <div className="mt-10 grid gap-8 md:grid-cols-3">
              {[
                { icon: Smartphone, n: "01", title: "Catat", body: "Pengurus mencatat pemasukan dan pengeluaran dari ponsel, lengkap dengan foto nota." },
                { icon: HandCoins, n: "02", title: "Verifikasi", body: "Donasi diverifikasi dengan mutasi rekening. Hanya donasi terverifikasi yang masuk ke total." },
                { icon: Users, n: "03", title: "Bagikan", body: "Laporan dipublikasikan ke halaman pura dan dibagikan ke grup WhatsApp krama." },
              ].map((s) => (
                <div key={s.n}>
                  <div className="flex items-center gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-gold-light ring-1 ring-white/15">
                      <s.icon className="h-6 w-6" />
                    </span>
                    <span className="text-sm font-bold text-gold">{s.n}</span>
                  </div>
                  <h3 className="mt-4 text-xl font-bold">{s.title}</h3>
                  <p className="mt-1.5 leading-relaxed text-white/75">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="untuk-pengurus" className="container mt-24 scroll-mt-24">
        <div className="grid items-center gap-8 rounded-[2rem] border border-gold/30 bg-gradient-to-br from-gold-light to-white p-8 md:grid-cols-[1.4fr_1fr] md:p-12">
          <div>
            <h2 className="text-3xl font-extrabold text-forest">Untuk Ketua, Bendahara &amp; Sekretaris pura</h2>
            <p className="mt-3 max-w-xl text-lg text-charcoal/75">
              Daftarkan pura Anda dalam 5 menit. Undang pengurus lain dengan peran masing-masing, dan mulai mencatat hari ini juga.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:flex-col lg:flex-row">
            <Link href="/daftar" className={buttonClass("primary", "xl", "flex-1")}>Daftarkan Pura</Link>
            <Link href="/masuk" className={buttonClass("outline", "xl", "flex-1")}>Masuk Pengurus</Link>
          </div>
        </div>
      </section>
    </>
  );
}
