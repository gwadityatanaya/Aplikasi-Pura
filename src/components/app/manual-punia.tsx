"use client";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { ImageUpload } from "@/components/ui/file-upload";
import { PrivacyPicker } from "@/components/public/donations";
import { useWorkspace } from "@/components/app/hooks";
import { useStore } from "@/lib/store";
import { PURPOSE_LABEL } from "@/lib/permissions";
import { todayISO } from "@/lib/format";

const schema = z.object({
  donorName: z.string().trim().min(2, "Isi nama donatur"),
  donorEmail: z.string().trim().email("Format email belum benar").optional().or(z.literal("")),
  amount: z.number().min(1_000, "Isi nominal"),
  transferDate: z.string().min(1).refine((d) => d <= todayISO(), "Tanggal tidak boleh di masa depan"),
  channel: z.enum(["tunai", "whatsapp", "transfer"]),
  privacy: z.enum(["public", "anonymous", "private"]),
  purpose: z.enum(["umum", "odalan", "pembangunan", "lainnya"]),
  campaignId: z.string().optional(),
  referenceNo: z.string().max(60).optional(),
  evidence: z.string().optional(),
  message: z.string().max(300).optional(),
});

/** Records a punia received outside the app (cash, WhatsApp, or a transfer reported by phone). */
export function ManualPuniaDialog({ open, onClose, campaignId }: { open: boolean; onClose: () => void; campaignId?: string }) {
  const ws = useWorkspace();
  const add = useStore((s) => s.addManualPunia);
  const me = useStore((s) => s.me);
  const { register, control, handleSubmit, formState, reset, watch } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { donorName: "", donorEmail: "", amount: 0, transferDate: todayISO(), channel: "tunai", privacy: "public", purpose: "umum", campaignId: campaignId ?? "" },
  });
  const email = watch("donorEmail");
  const isSelf = !!email && !!me && email.trim().toLowerCase() === me.email.toLowerCase();
  const onSubmit = handleSubmit(async (v) => {
    const r = await add({
      donorName: v.donorName, donorEmail: v.donorEmail || undefined, amount: v.amount, transferDate: v.transferDate, anonymous: v.privacy !== "public",
      purpose: v.purpose, channel: v.channel, campaignId: v.campaignId || undefined, referenceNo: v.referenceNo || undefined, evidence: v.evidence, message: v.message || undefined,
    });
    if (!r.ok) return toast.error(r.error);
    const val = r.value as unknown as { verified: boolean; number?: string };
    toast.success(val.verified ? `Punia tercatat & disahkan (${val.number})` : "Punia tercatat — menunggu disahkan pengurus lain");
    reset();
    onClose();
  });
  return (
    <Dialog open={open} onClose={onClose} title="Input punia manual" description="Untuk punia tunai, lewat WhatsApp, atau transfer yang dilaporkan langsung." footer={<Button size="lg" className="w-full" loading={formState.isSubmitting} onClick={onSubmit}>Simpan punia</Button>}>
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field label="Nominal" required error={formState.errors.amount?.message}>
          <Controller control={control} name="amount" render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />} />
        </Field>
        <Field label="Nama donatur" htmlFor="mp-name" required error={formState.errors.donorName?.message} hint="Tulis bebas, donatur tidak perlu punya akun. Jika memilih ANONIM, nama ini hanya terlihat oleh pengurus."><Input id="mp-name" {...register("donorName")} /></Field>
        <Field label="Email donatur (opsional)" htmlFor="mp-email" error={formState.errors.donorEmail?.message} hint="Jika diisi, punia ini muncul di riwayat punia akun donatur.">
          <Input id="mp-email" type="email" {...register("donorEmail")} />
        </Field>
        {isSelf && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Ini punia Anda sendiri — akan menunggu disahkan pengurus lain.</p>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal diterima" htmlFor="mp-date" error={formState.errors.transferDate?.message}><Input id="mp-date" type="date" max={todayISO()} {...register("transferDate")} /></Field>
          <Field label="Diterima lewat" htmlFor="mp-ch">
            <Select id="mp-ch" {...register("channel")}><option value="tunai">Tunai</option><option value="whatsapp">WhatsApp</option><option value="transfer">Transfer</option></Select>
          </Field>
        </div>
        <Field label="Tujuan punia" htmlFor="mp-purpose">
          <Select id="mp-purpose" {...register("purpose")}>{(Object.keys(PURPOSE_LABEL) as (keyof typeof PURPOSE_LABEL)[]).map((k) => <option key={k} value={k}>{PURPOSE_LABEL[k]}</option>)}</Select>
        </Field>
        {!campaignId && ws.campaigns.some((c) => c.status === "active") && (
          <Field label="Kegiatan / odalan (opsional)" htmlFor="mp-camp">
            <Select id="mp-camp" {...register("campaignId")}>
              <option value="">— Tidak terkait —</option>
              {ws.campaigns.filter((c) => c.status === "active").map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Tampilkan nama donatur?">
          <Controller control={control} name="privacy" render={({ field }) => <PrivacyPicker value={field.value} onChange={field.onChange} />} />
        </Field>
        <Field label="No. referensi transfer (opsional)" htmlFor="mp-ref"><Input id="mp-ref" {...register("referenceNo")} /></Field>
        <Field label="Foto bukti (opsional)">
          <Controller control={control} name="evidence" render={({ field }) => <ImageUpload value={field.value} onChange={(v) => field.onChange(v)} label="Bukti punia" compact />} />
        </Field>
        <Field label="Catatan (opsional)" htmlFor="mp-msg"><Textarea id="mp-msg" rows={2} {...register("message")} /></Field>
        <p className="text-sm text-muted">Nama Anda tercatat sebagai pencatat (&quot;dicatat oleh {me?.name}&quot;) — hanya terlihat oleh pengurus, Pengurus Banjar, dan Admin Utama, tidak oleh umat.</p>
      </form>
    </Dialog>
  );
}
