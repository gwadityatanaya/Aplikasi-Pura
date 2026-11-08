"use client";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { formatDate, formatDateTime } from "@/lib/format";

export interface Verification {
  templeId: string;
  referenceContactedAt: string | null;
  videoCallAt: string | null;
  accountCheckedAt: string | null;
  accountHolderType: "pura" | "banjar" | "lain" | null;
  trialStart: string | null;
  trialEnd: string | null;
  notes: string;
  updatedAt: string;
}

export { verificationProgress } from "@/lib/verification";

const HOLDER = { pura: "Atas nama pura", banjar: "Atas nama banjar", lain: "Atas nama lain (perlu tindak lanjut)" } as const;

/** Back Office → Pura → Verifikasi: internal checklist with dates (Admin Utama only; logged). */
export function VerificationDialog({ temple, onClose, run }: { temple: { id: string; name: string; verification?: Verification } | null; onClose: () => void; run: (name: string, payload: unknown, msg: string) => Promise<boolean> }) {
  const [v, setV] = useState<Verification | null>(null);
  useEffect(() => setV(temple?.verification ?? null), [temple]);
  if (!temple || !v) return null;
  const set = <K extends keyof Verification>(k: K, val: Verification[K]) => setV({ ...v, [k]: val });
  const item = (label: string, k: "referenceContactedAt" | "videoCallAt" | "accountCheckedAt", id: string, hint?: string) => (
    <div className="rounded-2xl border border-line p-3">
      <label className="flex items-center gap-2 font-semibold">
        <input type="checkbox" className="h-5 w-5 accent-emerald-600" checked={!!v[k]} onChange={(e) => set(k, e.target.checked ? v[k] ?? new Date().toISOString().slice(0, 10) : null)} />
        {label}
      </label>
      {v[k] && <Field label="Tanggal" htmlFor={id} hint={hint} className="mt-2"><Input id={id} type="date" value={v[k] ?? ""} onChange={(e) => set(k, e.target.value || null)} /></Field>}
    </div>
  );
  return (
    <Dialog
      open
      onClose={onClose}
      title="Catatan verifikasi"
      description={`${temple.name} — internal, hanya Admin Utama. Setiap perubahan tercatat di Log Aktivitas.`}
      footer={<Button size="lg" className="w-full" onClick={async () => { if (await run("adminSaveVerification", { ...v, templeId: temple.id }, "Catatan verifikasi disimpan")) onClose(); }}>Simpan catatan verifikasi</Button>}
    >
      <div className="space-y-3">
        {item("Pemberi referensi sudah dihubungi", "referenceContactedAt", "vf-ref")}
        {item("Panggilan video dengan pengurus", "videoCallAt", "vf-video")}
        {item("Rekening resmi sudah dicek", "accountCheckedAt", "vf-acc")}
        {v.accountCheckedAt && (
          <Field label="Rekening atas nama" htmlFor="vf-holder">
            <Select id="vf-holder" value={v.accountHolderType ?? ""} onChange={(e) => set("accountHolderType", (e.target.value || null) as Verification["accountHolderType"])}>
              <option value="">— Pilih —</option>
              {(Object.keys(HOLDER) as (keyof typeof HOLDER)[]).map((k) => <option key={k} value={k}>{HOLDER[k]}</option>)}
            </Select>
          </Field>
        )}
        <fieldset className="rounded-2xl border border-line p-3">
          <legend className="px-1 font-semibold">Masa percobaan</legend>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mulai" htmlFor="vf-trial-start"><Input id="vf-trial-start" type="date" value={v.trialStart ?? ""} onChange={(e) => set("trialStart", e.target.value || null)} /></Field>
            <Field label="Selesai" htmlFor="vf-trial-end"><Input id="vf-trial-end" type="date" value={v.trialEnd ?? ""} onChange={(e) => set("trialEnd", e.target.value || null)} /></Field>
          </div>
        </fieldset>
        <Field label="Catatan bebas" htmlFor="vf-notes"><Textarea id="vf-notes" rows={3} maxLength={3000} value={v.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        {v.updatedAt && new Date(v.updatedAt).getTime() > 0 && <p className="text-sm text-muted">Terakhir diubah {formatDateTime(v.updatedAt)}.</p>}
      </div>
    </Dialog>
  );
}

/** Short badge text for the temple card. */
export function trialLabel(v?: Verification) {
  if (!v?.trialEnd) return null;
  return `Percobaan s.d. ${formatDate(v.trialEnd)}`;
}
