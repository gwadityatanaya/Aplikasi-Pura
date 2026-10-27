"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, Eye, Landmark, PartyPopper, Rocket } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, NoAccess } from "@/components/app/page-header";
import { useCan, useWorkspace } from "@/components/app/hooks";
import { Card } from "@/components/ui/card";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Switch } from "@/components/ui/switch";
import { ImageUpload } from "@/components/ui/file-upload";
import { ConfirmDialog } from "@/components/ui/confirm";
import { TempleCover } from "@/components/brand/temple-cover";
import { PrivacyPicker } from "@/components/public/donations";
import { useStore, type CampaignInput } from "@/lib/store";
import { cn, formatDate, rupiah, todayISO } from "@/lib/format";
import type { CoverVariant } from "@/lib/types";

const STEPS = ["Informasi dasar", "Target dana", "Cara berpunia", "Tinjau & terbitkan"];
const COVERS: CoverVariant[] = ["emerald", "gold", "forest", "ocean", "dusk"];

function Wizard() {
  const params = useSearchParams();
  const router = useRouter();
  const ws = useWorkspace();
  const can = useCan();
  const save = useStore((s) => s.saveCampaign);
  const editId = params.get("edit");
  const editing = ws.campaigns.find((c) => c.id === editId);
  const bank = ws.accounts.find((a) => a.type === "bank") ?? ws.accounts[0];
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const [published, setPublished] = useState<{ id: string; slug: string; status: string } | null>(null);
  const [f, setF] = useState<CampaignInput>(() =>
    editing
      ? { ...editing }
      : {
          title: "",
          description: "",
          cover: "emerald",
          activityId: "",
          target: 0,
          startDate: todayISO(),
          endDate: "",
          purpose: "",
          accountId: bank?.id ?? "",
          instructions: `Transfer ke rekening resmi pura, lalu kirim bukti transfer ke bendahara melalui WhatsApp ${ws.temple?.phone ?? ""}.`,
          manualVerification: true,
          showDonorList: true,
          defaultPrivacy: "public",
        }
  );
  const set = <K extends keyof CampaignInput>(k: K, v: CampaignInput[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };


  if (!can("campaign.manage")) return <NoAccess what="pembuatan campaign" />;

  function validate(s: number) {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (f.title.trim().length < 5) e.title = "Judul minimal 5 huruf";
      if (f.description.trim().length < 20) e.description = "Ceritakan tujuan penggalangan (min. 20 huruf)";
    }
    if (s === 1) {
      if (f.target < 100_000) e.target = "Target minimal Rp100.000";
      if (!f.startDate) e.startDate = "Pilih tanggal mulai";
      if (!f.endDate) e.endDate = "Pilih tanggal berakhir";
      else if (f.endDate <= f.startDate) e.endDate = "Harus setelah tanggal mulai";
      if (f.purpose.trim().length < 5) e.purpose = "Jelaskan penggunaan dana";
    }
    if (s === 2) {
      if (!f.accountId) e.accountId = "Pilih rekening resmi";
      if (f.instructions.trim().length < 10) e.instructions = "Tulis petunjuk berpunia";
    }
    setErrors(e);
    return !Object.keys(e).length;
  }
  async function submit(status: "draft" | "active") {
    for (let i = 0; i < 3; i++) if (!validate(i)) return setStep(i);
    const r = await save({ ...f, activityId: f.activityId || undefined }, status, editing?.id);
    setConfirm(false);
    if (!r.ok) return toast.error(r.error);
    const c = r.value;
    setPublished({ id: c.id, slug: c.slug, status });
    toast.success(status === "active" ? "Campaign diterbitkan!" : "Draf campaign disimpan");
  }

  if (published)
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <motion.div initial={{ scale: 0.4, rotate: -20, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", bounce: 0.5 }} className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-gold-light text-gold-dark">
          <PartyPopper className="h-12 w-12" />
        </motion.div>
        <h1 className="mt-6 text-2xl font-extrabold text-forest">{published.status === "active" ? "Campaign sudah tayang!" : "Draf tersimpan"}</h1>
        <p className="mt-2 text-[17px] text-muted">{published.status === "active" ? "Halaman donasi kini tampil di portal publik dan siap dibagikan ke krama." : "Anda dapat menerbitkannya kapan saja."}</p>
        <div className="mt-8 grid gap-2">
          {published.status === "active" && <Link href={`/donasi/${published.slug}`} target="_blank" className={buttonClass("primary", "xl")}><Eye className="h-5 w-5" /> Lihat halaman publik</Link>}
          <Link href={`/app/campaign/${published.id}`} className={buttonClass("outline", "xl")}>Kelola campaign</Link>
        </div>
      </div>
    );

  const bankAcc = ws.accounts.find((a) => a.id === f.accountId);
  return (
    <div className="mx-auto max-w-3xl" data-tour="campaign-wizard">
      <PageHeader back={{ href: "/app/campaign", label: "Penggalangan Dana" }} title={editing ? "Ubah campaign" : "Buat campaign baru"} description={`Langkah ${step + 1} dari 4 · ${STEPS[step]}`} />
      <ol className="mb-6 grid grid-cols-4 gap-2">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" onClick={() => i < step && setStep(i)} className="w-full text-left" disabled={i >= step}>
              <span className={cn("block h-1.5 rounded-full transition-colors duration-300", i <= step ? "bg-emerald-600" : "bg-stone-200")} />
              <span className={cn("mt-1.5 hidden text-xs font-semibold sm:block", i === step ? "text-emerald-800" : "text-muted")}>
                {i < step && <Check className="mr-1 inline h-3 w-3" />}{s}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <Card className="p-5 md:p-7">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }} className="space-y-5">
            {step === 0 && (
              <>
                <Field label="Judul campaign" htmlFor="c-title" required error={errors.title} hint="Singkat dan jelas, mis. Dana Punia Piodalan November 2026">
                  <Input id="c-title" value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={90} />
                </Field>
                <Field label="Cerita & tujuan" htmlFor="c-desc" required error={errors.description}>
                  <Textarea id="c-desc" rows={4} value={f.description} onChange={(e) => set("description", e.target.value)} />
                </Field>
                <Field label="Gambar sampul">
                  <div className="flex flex-wrap gap-2">
                    {COVERS.map((c) => (
                      <button key={c} type="button" onClick={() => { set("cover", c); set("coverImage", undefined); }} className={cn("overflow-hidden rounded-xl ring-offset-2", f.cover === c && !f.coverImage ? "ring-2 ring-emerald-600" : "")} aria-label={`Sampul ${c}`} aria-pressed={f.cover === c && !f.coverImage}>
                        <TempleCover variant={c} className="h-14 w-24" />
                      </button>
                    ))}
                  </div>
                  <div className="mt-3"><ImageUpload value={f.coverImage} onChange={(v) => set("coverImage", v)} label="Foto sampul" allowCamera={false} compact /></div>
                </Field>
                <Field label="Kegiatan terkait" htmlFor="c-act" hint="Donasi disahkan otomatis tercatat ke kegiatan ini.">
                  <Select id="c-act" value={f.activityId ?? ""} onChange={(e) => set("activityId", e.target.value)}>
                    <option value="">— Tidak ada —</option>
                    {ws.activities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </Select>
                </Field>
              </>
            )}
            {step === 1 && (
              <>
                <Field label="Target dana" required error={errors.target}>
                  <MoneyInput large value={f.target} onChange={(v) => set("target", v)} invalid={!!errors.target} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Mulai" htmlFor="c-start" error={errors.startDate}><Input id="c-start" type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field>
                  <Field label="Berakhir" htmlFor="c-end" error={errors.endDate}><Input id="c-end" type="date" value={f.endDate} onChange={(e) => set("endDate", e.target.value)} /></Field>
                </div>
                <Field label="Dana akan digunakan untuk" htmlFor="c-purpose" required error={errors.purpose}>
                  <Input id="c-purpose" value={f.purpose} onChange={(e) => set("purpose", e.target.value)} placeholder="Upakara, sewa tenda, konsumsi…" />
                </Field>
              </>
            )}
            {step === 2 && (
              <>
                <Field label="Rekening resmi pura" error={errors.accountId}>
                  <div className="grid gap-2">
                    {ws.accounts.map((a) => (
                      <button key={a.id} type="button" onClick={() => set("accountId", a.id)} className={cn("press flex items-center gap-3 rounded-2xl border p-4 text-left", f.accountId === a.id ? "border-emerald-500 bg-mint/50 ring-2 ring-emerald-500/20" : "border-line bg-white")}>
                        <Landmark className="h-5 w-5 text-emerald-700" />
                        <span className="flex-1">
                          <span className="block font-semibold">{a.name}</span>
                          <span className="block text-sm text-muted">{a.type === "bank" ? `${a.bankName} · ${a.accountNumber}` : "Tunai — diterima langsung di pura"}</span>
                        </span>
                        {f.accountId === a.id && <Check className="h-5 w-5 text-emerald-700" />}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Petunjuk berpunia" htmlFor="c-instr" error={errors.instructions}>
                  <Textarea id="c-instr" rows={3} value={f.instructions} onChange={(e) => set("instructions", e.target.value)} />
                </Field>
                <div className="divide-y divide-line rounded-2xl border border-line px-4">
                  <Switch checked={f.manualVerification} onChange={(v) => set("manualVerification", v)} label="Verifikasi manual oleh bendahara" description="Donasi baru dihitung setelah dicocokkan dengan mutasi rekening. (Disarankan)" />
                  <Switch checked={f.showDonorList} onChange={(v) => set("showDonorList", v)} label="Tampilkan daftar donatur" description="Nama ditampilkan sesuai izin masing-masing donatur." />
                </div>
                <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Aplikasi tidak memegang uang. Umat mentransfer langsung ke rekening pura lalu mengunggah bukti; pengurus memverifikasi.</p>
              </>
            )}
            {step === 3 && (
              <>
                <div className="overflow-hidden rounded-3xl border border-line">
                  <TempleCover variant={f.cover} image={f.coverImage} className="h-40" />
                  <div className="p-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">{ws.temple?.name}</p>
                    <h2 className="mt-1 text-xl font-bold">{f.title || "Judul campaign"}</h2>
                    <p className="mt-2 line-clamp-3 text-[15px] text-charcoal/80">{f.description}</p>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl bg-ivory p-3"><p className="text-muted">Target</p><p className="tabular font-bold">{rupiah(f.target)}</p></div>
                      <div className="rounded-xl bg-ivory p-3"><p className="text-muted">Periode</p><p className="font-bold">{f.startDate ? formatDate(f.startDate) : "—"} – {f.endDate ? formatDate(f.endDate) : "—"}</p></div>
                    </div>
                    {bankAcc && <p className="mt-3 text-sm text-muted">Rekening: <strong className="text-charcoal">{bankAcc.bankName ?? bankAcc.name} {bankAcc.accountNumber}</strong></p>}
                  </div>
                </div>
                <Field label="Privasi bawaan untuk donasi yang dicatat pengurus" hint="Tetap ikuti persetujuan dari tiap donatur.">
                  <PrivacyPicker value={f.defaultPrivacy} onChange={(v) => set("defaultPrivacy", v)} />
                </Field>
              </>
            )}
          </motion.div>
        </AnimatePresence>
        <div className="mt-7 flex flex-col gap-2 sm:flex-row-reverse">
          {step < 3 ? (
            <Button size="xl" className="flex-1" onClick={() => validate(step) && setStep(step + 1)}>Lanjut</Button>
          ) : (
            <>
              <Button size="xl" className="flex-1" onClick={() => setConfirm(true)}><Rocket className="h-5 w-5" /> Terbitkan</Button>
              <Button size="xl" variant="outline" className="flex-1" onClick={() => submit("draft")}>Simpan draf</Button>
            </>
          )}
          {step > 0 && <Button size="xl" variant="ghost" onClick={() => setStep(step - 1)}><ArrowLeft className="h-5 w-5" /> Kembali</Button>}
        </div>
      </Card>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Terbitkan campaign?"
        description={<>Halaman <strong>{f.title}</strong> akan langsung tampil di portal publik dan dapat dilihat siapa saja.</>}
        confirmLabel="Ya, terbitkan"
        onConfirm={() => submit("active")}
      />
    </div>
  );
}

export default function NewCampaignPage() {
  return (
    <Suspense>
      <Wizard />
    </Suspense>
  );
}
