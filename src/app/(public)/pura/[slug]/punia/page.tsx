"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Copy, Landmark, MapPin } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ImageUpload } from "@/components/ui/file-upload";
import { MoneyInput, QuickAmounts } from "@/components/ui/money-input";
import { Skeleton } from "@/components/ui/skeleton";
import { PrivacyPicker } from "@/components/public/donations";
import { useRequireLogin } from "@/components/umat/use-umat";
import { usePublicData } from "@/lib/public";
import { useStore } from "@/lib/store";
import { PURPOSE_LABEL } from "@/lib/permissions";
import { rupiah, todayISO } from "@/lib/format";
import type { DonorPrivacy, PuniaPurpose } from "@/lib/types";

function PuniaForm() {
  const { slug } = useParams<{ slug: string }>();
  const params = useSearchParams();
  const { ready, me } = useRequireLogin();
  const { hydrated, temples, campaigns } = usePublicData();
  const run = useStore((s) => s.run);
  const temple = temples.find((t) => t.slug === slug);
  const active = campaigns.filter((c) => c.templeId === temple?.id && c.status === "active");

  const [amount, setAmount] = useState(0);
  const [transferDate, setTransferDate] = useState(todayISO());
  const [evidence, setEvidence] = useState<string>();
  const [privacy, setPrivacy] = useState<DonorPrivacy>("public");
  const [purpose, setPurpose] = useState<PuniaPurpose>("umum");
  const [campaignId, setCampaignId] = useState(params.get("campaign") ?? "");
  const [referenceNo, setReferenceNo] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  if (!ready || !hydrated) return <div className="container max-w-xl space-y-4 py-8"><Skeleton className="h-40 rounded-3xl" /><Skeleton className="h-64 rounded-3xl" /></div>;
  if (!temple)
    return <div className="container py-16"><EmptyState icon={MapPin} title="Pura tidak ditemukan" action={<Link href="/pura" className="font-semibold text-emerald-700">Kembali ke daftar pura</Link>} /></div>;
  if (!temple.acceptsPunia)
    return (
      <div className="container max-w-xl py-16">
        <EmptyState icon={Landmark} title="Belum bisa menerima punia" description="Info rekening pura ini belum diisi oleh Admin Utama. Hubungi pengurus pura." action={<Link href={`/pura/${temple.slug}`} className="font-semibold text-emerald-700">Kembali ke halaman pura</Link>} />
      </div>
    );

  if (sent)
    return (
      <div className="container max-w-xl py-12 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-600" />
        <h1 className="mt-4 text-2xl font-extrabold text-forest">Suksma! Punia terkirim</h1>
        <p className="mt-2 text-lg text-muted">
          {rupiah(amount)} ke {temple.name} sedang <b>menunggu verifikasi</b> pengurus. Anda dapat memantau statusnya di Riwayat Punia.
        </p>
        <div className="mt-6 grid gap-3">
          <Link href="/umat/punia" className={buttonClass("primary", "xl", "w-full")}>Lihat riwayat punia</Link>
          <Link href={`/pura/${temple.slug}`} className={buttonClass("outline", "lg", "w-full")}>Kembali ke halaman pura</Link>
        </div>
      </div>
    );

  async function submit() {
    const e: Record<string, string> = {};
    if (amount < 1000) e.amount = "Isi nominal punia (minimal Rp1.000).";
    if (!transferDate || transferDate > todayISO()) e.transferDate = "Tanggal transfer tidak boleh di masa depan.";
    if (!evidence) e.evidence = "Unggah foto atau tangkapan layar bukti transfer.";
    setErrors(e);
    if (Object.keys(e).length) return toast.error(Object.values(e)[0]);
    setBusy(true);
    const r = await run("submitPunia", {
      templeId: temple!.id, amount, transferDate, evidence, anonymous: privacy !== "public", purpose,
      campaignId: campaignId || null, referenceNo: referenceNo || null, message: message || null,
    });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    setSent(true);
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="container max-w-xl py-6">
      <Link href={`/pura/${temple.slug}`} className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-800"><ArrowLeft className="h-4 w-4" /> {temple.name}</Link>
      <h1 className="mt-2 text-3xl font-extrabold text-forest">Kirim punia</h1>
      <p className="text-muted">Berpunia sebagai <b>{me?.name}</b></p>

      <Card className="mt-5 p-5">
        <p className="font-bold"><span className="mr-2 inline-grid h-7 w-7 place-items-center rounded-full bg-emerald-600 text-sm text-white">1</span>Transfer ke rekening pura</p>
        <div className="mt-3 rounded-2xl bg-gradient-to-br from-emerald-600 to-forest p-4 text-white">
          <p className="flex items-center gap-2 text-sm text-white/80"><Landmark className="h-4 w-4" /> {temple.bankName}</p>
          <p className="tabular mt-1 text-2xl font-bold tracking-wider">{temple.bankAccountNumber}</p>
          <p className="mt-1">a.n. <strong>{temple.bankAccountHolder}</strong></p>
        </div>
        <Button variant="outline" className="mt-2 w-full" onClick={() => { navigator.clipboard?.writeText((temple.bankAccountNumber ?? "").replace(/\D/g, "")); toast.success("Nomor rekening disalin"); }}>
          <Copy className="h-4 w-4" /> Salin nomor rekening
        </Button>
        <p className="mt-2 text-sm text-muted">Periksa nama pemilik rekening di m-banking sebelum menekan kirim.</p>
      </Card>

      <Card className="mt-4 space-y-5 p-5">
        <p className="font-bold"><span className="mr-2 inline-grid h-7 w-7 place-items-center rounded-full bg-emerald-600 text-sm text-white">2</span>Isi data transfer</p>
        <Field label="Nominal yang ditransfer" required error={errors.amount}>
          <MoneyInput large value={amount} onChange={setAmount} invalid={!!errors.amount} />
          <div className="mt-2"><QuickAmounts onPick={setAmount} /></div>
        </Field>
        <Field label="Tanggal transfer" htmlFor="pn-date" required error={errors.transferDate}>
          <Input id="pn-date" type="date" max={todayISO()} value={transferDate} onChange={(e) => setTransferDate(e.target.value)} />
        </Field>
        <Field label="Foto bukti transfer" required error={errors.evidence} hint="Tangkapan layar dari m-banking sudah cukup.">
          <ImageUpload value={evidence} onChange={(v) => setEvidence(v)} label="Bukti transfer" />
        </Field>
        <Field label="Tampilkan nama Anda?">
          <PrivacyPicker value={privacy} onChange={setPrivacy} />
        </Field>
        <Field label="Tujuan punia" htmlFor="pn-purpose">
          <Select id="pn-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value as PuniaPurpose)}>
            {(Object.keys(PURPOSE_LABEL) as PuniaPurpose[]).map((k) => <option key={k} value={k}>{PURPOSE_LABEL[k]}</option>)}
          </Select>
        </Field>
        {active.length > 0 && (
          <Field label="Untuk kegiatan / odalan (opsional)" htmlFor="pn-camp">
            <Select id="pn-camp" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
              <option value="">— Tidak terkait kegiatan —</option>
              {active.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Select>
          </Field>
        )}
        <Field label="No. referensi transfer (opsional)" htmlFor="pn-ref" hint="Tertera di bukti m-banking. Membantu pengurus mencocokkan.">
          <Input id="pn-ref" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
        </Field>
        <Field label="Pesan untuk pengurus (opsional)" htmlFor="pn-msg">
          <Textarea id="pn-msg" rows={2} maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>
      </Card>

      <Button size="xl" className="mt-5 w-full" loading={busy} onClick={submit}>Kirim punia {amount >= 1000 ? rupiah(amount) : ""}</Button>
      <p className="mt-2 text-center text-sm text-muted">Punia akan diperiksa pengurus pura sebelum tampil di halaman pura.</p>
    </div>
  );
}

export default function PuniaPage() {
  return (
    <Suspense>
      <PuniaForm />
    </Suspense>
  );
}
