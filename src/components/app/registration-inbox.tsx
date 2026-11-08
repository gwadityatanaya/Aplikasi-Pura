"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, ClipboardList, Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/confirm";
import { api, useStore } from "@/lib/store";
import { cn, formatDateTime } from "@/lib/format";
import { REGISTRATION_STATUS_LABEL, type RegistrationRequest, type RegistrationStatus } from "@/lib/registration";
import type { Banjar } from "@/lib/types";

const TONE: Record<RegistrationStatus, "gold" | "blue" | "green" | "red"> = { baru: "gold", verifikasi: "blue", disetujui: "green", ditolak: "red" };

/** Back Office → Pengajuan: registration requests from the public form (Admin Utama only). */
export function RegistrationInbox({ banjars, onChanged, onCount }: { banjars: Banjar[]; onChanged: () => void; onCount?: (n: number) => void }) {
  const run = useStore((s) => s.run);
  const [list, setList] = useState<RegistrationRequest[] | null>(null);
  const [filter, setFilter] = useState<"aktif" | RegistrationStatus>("aktif");
  const [openId, setOpenId] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { json } = await api<{ requests: RegistrationRequest[] }>("/api/admin/pendaftaran");
    if (json.ok) {
      setList(json.requests);
      onCount?.(json.requests.filter((r) => r.status === "baru").length);
    }
  }, [onCount]);
  useEffect(() => {
    load();
  }, [load]);

  const shown = (list ?? []).filter((r) => (filter === "aktif" ? r.status === "baru" || r.status === "verifikasi" : r.status === filter));
  return (
    <div className="mt-4">
      <p className="mb-3 rounded-xl bg-ivory p-3 text-sm text-muted">Pengajuan dari halaman publik <b>/ajukan-pendaftaran</b>. Hanya Admin Utama yang bisa melihatnya. Pengajuan tidak memberi akses apa pun; akun pengurus tetap didaftarkan manual setelah disetujui.</p>
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
        <Segmented value={filter} onChange={setFilter} ariaLabel="Saring pengajuan" options={[{ value: "aktif", label: "Perlu diproses" }, { value: "disetujui", label: "Disetujui" }, { value: "ditolak", label: "Ditolak" }]} />
      </div>
      {!list && <Skeleton className="mt-4 h-40" />}
      {list && !shown.length && <Card className="mt-4"><EmptyState icon={ClipboardList} title="Tidak ada pengajuan" description="Pengajuan baru dari formulir publik akan muncul di sini." /></Card>}
      <ul className="mt-4 space-y-3">
        {shown.map((r) => (
          <li key={r.id}>
            <Card className={cn("p-4", r.status === "baru" && "border-gold ring-2 ring-gold-light")}>
              <button type="button" className="flex w-full flex-wrap items-center gap-2 text-left" aria-expanded={openId === r.id} onClick={() => setOpenId(openId === r.id ? null : r.id)}>
                <Badge tone={TONE[r.status]}>{REGISTRATION_STATUS_LABEL[r.status]}</Badge>
                <span className="font-bold">{r.banjarName}</span>
                <span className="text-muted">— {r.templeName}</span>
                <span className="ml-auto text-sm text-muted">{formatDateTime(r.createdAt)}</span>
              </button>
              {openId === r.id && <Detail r={r} banjars={banjars} run={run} onDone={async () => { await load(); onChanged(); }} />}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Detail({ r, banjars, run, onDone }: { r: RegistrationRequest; banjars: Banjar[]; run: (name: string, payload?: unknown) => Promise<{ ok: boolean; error?: string }>; onDone: () => void }) {
  const [status, setStatus] = useState<RegistrationStatus>(r.status);
  const [note, setNote] = useState(r.internalNote);
  const [banjarId, setBanjarId] = useState(banjars.find((b) => b.name.trim().toLowerCase() === r.banjarName.trim().toLowerCase())?.id ?? "");
  const [banjarName, setBanjarName] = useState(r.banjarName);
  const [templeName, setTempleName] = useState(r.templeName);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const place = [r.village, r.district, r.regency, r.province].filter(Boolean).join(", ") || "—";

  async function go(name: string, payload: unknown, msg: string) {
    setBusy(true);
    const res = await run(name, payload);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(msg);
    onDone();
  }

  return (
    <div className="mt-4 space-y-4 border-t border-line pt-4 text-[15px]">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
        <dt className="text-muted">Wilayah</dt><dd>{place}</dd>
        <dt className="text-muted">Pemohon</dt><dd>{r.applicantName} ({r.applicantPosition})</dd>
        <dt className="text-muted">WhatsApp</dt><dd className="break-all">{r.whatsapp}</dd>
        <dt className="text-muted">Email Google</dt><dd className="break-all">{r.googleEmail}</dd>
        <dt className="text-muted">Referensi</dt><dd className="break-words">{r.referrerName} — {r.referrerContact}</dd>
        <dt className="text-muted">Alasan</dt><dd className="whitespace-pre-wrap break-words">{r.reason}</dd>
        <dt className="text-muted">Persetujuan data</dt><dd>{formatDateTime(r.consentAt)}</dd>
      </dl>

      <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
        <Field label="Status" htmlFor={`rg-st-${r.id}`}>
          <Select id={`rg-st-${r.id}`} value={status} disabled={!!r.convertedTempleId} onChange={(e) => setStatus(e.target.value as RegistrationStatus)}>
            <option value="baru">Baru</option>
            <option value="verifikasi">Sedang diverifikasi</option>
            <option value="ditolak">Ditolak</option>
            {r.convertedTempleId && <option value="disetujui">Disetujui</option>}
          </Select>
        </Field>
        <Field label="Catatan internal (hanya Admin Utama)" htmlFor={`rg-note-${r.id}`}>
          <Textarea id={`rg-note-${r.id}`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button size="sm" variant="outline" loading={busy} disabled={status === r.status && note === r.internalNote} onClick={() => go("adminUpdateRegistration", { id: r.id, status: status === r.status ? undefined : status, internalNote: note }, "Pengajuan disimpan")}>
          <Save className="h-4 w-4" /> Simpan status & catatan
        </Button>
      </div>

      {r.convertedTempleId ? (
        <p className="rounded-xl bg-mint/60 p-3 text-emerald-900">Sudah dijadikan banjar & pura. Pura dibuat dengan status <b>menunggu</b> (belum tampil di publik). Lanjutkan di tab <b>Pura</b>: isi rekening, daftarkan pengurus, lalu aktifkan.</p>
      ) : r.status !== "ditolak" && (
        <fieldset className="space-y-3 rounded-2xl border border-emerald-200 bg-mint/30 p-4">
          <legend className="px-1 font-bold">Jadikan banjar & pura</legend>
          <Field label="Banjar" htmlFor={`rg-bj-${r.id}`}>
            <Select id={`rg-bj-${r.id}`} value={banjarId} onChange={(e) => setBanjarId(e.target.value)}>
              <option value="">+ Banjar baru dari pengajuan</option>
              {banjars.map((b) => <option key={b.id} value={b.id}>{b.name} (sudah ada)</option>)}
            </Select>
          </Field>
          {!banjarId && <Field label="Nama banjar baru" htmlFor={`rg-bjn-${r.id}`}><Input id={`rg-bjn-${r.id}`} value={banjarName} onChange={(e) => setBanjarName(e.target.value)} /></Field>}
          <Field label="Nama pura" htmlFor={`rg-tn-${r.id}`}><Input id={`rg-tn-${r.id}`} value={templeName} onChange={(e) => setTempleName(e.target.value)} /></Field>
          <p className="text-sm text-muted">Wilayah diisi otomatis dari pengajuan. Tidak ada akun atau akses yang dibuat.</p>
          <div className="flex justify-end"><Button onClick={() => setConfirm(true)}><Building2 className="h-4 w-4" /> Jadikan banjar & pura</Button></div>
        </fieldset>
      )}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Jadikan banjar & pura?"
        description={`${banjarId ? banjars.find((b) => b.id === banjarId)?.name : `Banjar baru "${banjarName}"`} dan pura "${templeName}" dibuat (pura berstatus menunggu). Pengajuan ditandai Disetujui.`}
        confirmLabel="Ya, buat"
        onConfirm={async () => {
          setConfirm(false);
          await go("adminConvertRegistration", { id: r.id, banjarId: banjarId || undefined, banjarName: banjarId ? undefined : banjarName, templeName }, "Banjar & pura dibuat dari pengajuan");
        }}
      />
    </div>
  );
}
