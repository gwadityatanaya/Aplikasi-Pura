"use client";
import { AlertTriangle, PenLine } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { PAPER_LABEL, type Paper, type SignatureBlock, type Signer } from "@/lib/export";
import { POSITION_LABEL, positionName } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import type { DataState, Temple, User } from "@/lib/types";

export type SignPreset = "none" | "ketua" | "ketua_sekretaris" | "ketua_bendahara" | "semua";
export const SIGN_PRESETS: { value: SignPreset; label: string; roles: ("ketua" | "sekretaris" | "bendahara")[] }[] = [
  { value: "none", label: "Tanpa tanda tangan", roles: [] },
  { value: "ketua", label: "Ketua saja", roles: ["ketua"] },
  { value: "ketua_sekretaris", label: "Ketua dan Sekretaris", roles: ["ketua", "sekretaris"] },
  { value: "ketua_bendahara", label: "Ketua dan Bendahara", roles: ["ketua", "bendahara"] },
  { value: "semua", label: "Ketua, Sekretaris, dan Bendahara", roles: ["ketua", "sekretaris", "bendahara"] },
];

export interface SignOptions {
  preset: SignPreset;
  /** "" = no "Mengetahui"; "kosong" = Kelian Banjar with a blank line; otherwise a banjar-member id */
  acknowledger: string;
  paper: Paper;
  /** Print missing names as dotted lines to fill in by hand */
  allowBlank: boolean;
}
export const defaultSignOptions: SignOptions = { preset: "semua", acknowledger: "", paper: "a4", allowBlank: false };

type WS = { data: DataState; temple?: Temple; templeId: string; users: User[] };

/** People who can sign "Mengetahui": the Pengurus Banjar of the banjar(s) supporting this temple. */
export function acknowledgerChoices(ws: WS) {
  const banjarIds = ws.temple?.banjarIds ?? [];
  return ws.data.banjarMembers
    .filter((m) => banjarIds.includes(m.banjarId) && m.status === "active")
    .map((m) => {
      const name = ws.users.find((u) => u.id === m.userId)?.name;
      const banjar = ws.data.banjars.find((b) => b.id === m.banjarId)?.name ?? "";
      const role = `${positionName(m.position, m.positionTitle) || "Pengurus Banjar"} ${banjar}`.trim();
      return { id: m.id, role, name, label: `${role} — ${name ?? "?"}` };
    });
}

/**
 * Builds the signature block from the jabatan filled in by Admin Utama in the Back Office.
 * `missing` lists jabatan that have no person yet (they print as a dotted line if allowed).
 */
export function signatureBlock(ws: WS, o: SignOptions): { block?: SignatureBlock; missing: string[] } {
  const preset = SIGN_PRESETS.find((p) => p.value === o.preset)!;
  if (!preset.roles.length && !o.acknowledger) return { missing: [] };
  const missing: string[] = [];
  const holder = (pos: string) => {
    const m = ws.data.memberships.find((x) => x.templeId === ws.templeId && x.position === pos && x.status === "active");
    return m ? ws.users.find((u) => u.id === m.userId)?.name : undefined;
  };
  const signers: Signer[] = preset.roles.map((r) => {
    const name = holder(r);
    if (!name) missing.push(POSITION_LABEL[r]);
    return { role: POSITION_LABEL[r], name };
  });
  let acknowledger: Signer | undefined;
  if (o.acknowledger === "kosong") {
    acknowledger = { role: "Kelian Banjar" };
  } else if (o.acknowledger) {
    const c = acknowledgerChoices(ws).find((x) => x.id === o.acknowledger);
    if (c) acknowledger = { role: c.role, name: c.name };
  }
  const t = ws.temple;
  const place = t?.village || t?.district || (t?.regency ?? "").replace(/^(Kabupaten|Kota)\s+/, "");
  return { block: { place, date: formatDate(new Date()), signers, acknowledger }, missing };
}

/** "Tanda tangan & kertas" options on the Laporan page. */
export function ReportSignOptions({ ws, value, onChange, missing }: { ws: WS; value: SignOptions; onChange: (v: SignOptions) => void; missing: string[] }) {
  const ack = acknowledgerChoices(ws);
  return (
    <Card className="mt-4 p-4 md:p-5">
      <p className="mb-3 flex items-center gap-2 font-bold"><PenLine className="h-5 w-5 text-emerald-700" /> Tanda tangan & kertas</p>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Penanda tangan" htmlFor="r-sign">
          <Select id="r-sign" value={value.preset} onChange={(e) => onChange({ ...value, preset: e.target.value as SignPreset })}>
            {SIGN_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </Select>
        </Field>
        <Field label="Mengetahui (opsional)" htmlFor="r-ack">
          <Select id="r-ack" value={value.acknowledger} onChange={(e) => onChange({ ...value, acknowledger: e.target.value })}>
            <option value="">— Tidak ada —</option>
            {ack.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            <option value="kosong">Kelian Banjar (nama diisi tangan)</option>
          </Select>
        </Field>
        <Field label="Ukuran kertas" htmlFor="r-paper">
          <Select id="r-paper" value={value.paper} onChange={(e) => onChange({ ...value, paper: e.target.value as Paper })}>
            {(Object.keys(PAPER_LABEL) as Paper[]).map((p) => <option key={p} value={p}>{PAPER_LABEL[p]}</option>)}
          </Select>
        </Field>
      </div>
      {missing.length > 0 && (
        <div className="mt-3 rounded-xl bg-amber-50 p-3 text-[15px] text-amber-900" role="alert">
          <p className="flex items-start gap-2 font-semibold"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /> Jabatan {missing.join(", ")} belum diisi.</p>
          <p className="mt-1 text-sm">Admin Utama dapat mengisinya di Back Office → Pura → Pengurus. Atau cetak dengan garis kosong untuk diisi tangan.</p>
          <label className="mt-2 flex items-center gap-2 font-semibold">
            <input type="checkbox" className="h-5 w-5 accent-emerald-600" checked={value.allowBlank} onChange={(e) => onChange({ ...value, allowBlank: e.target.checked })} />
            Cetak dengan garis kosong (titik-titik)
          </label>
        </div>
      )}
    </Card>
  );
}
