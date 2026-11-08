"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Ban, CheckCircle2, ImagePlus, Landmark, Pencil, QrCode, Star, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { compressImage } from "@/components/ui/file-upload";
import type { Account, Temple } from "@/lib/types";

export type BankTemple = Temple & { bankAccountsAll: Account[] };
const empty = { id: "", label: "", bankName: "", accountNumber: "", accountHolder: "", isPublic: true };

/**
 * Back Office → Pura → Rekening: every bank account of a temple (Admin Utama only; each change is
 * logged). Umat choose between the active ones when sending punia; the primary one is shown first.
 */
export function BankAccountsDialog({
  temple,
  onClose,
  run,
}: {
  temple: BankTemple | null;
  onClose: () => void;
  /** Runs a command, shows the result, reloads the Back Office; true when it worked */
  run: (name: string, payload: unknown, msg: string) => Promise<boolean>;
}) {
  const [f, setF] = useState(empty);
  const [confirm, setConfirm] = useState(false);
  const [deactivate, setDeactivate] = useState<{ a: Account; reason: string } | null>(null);
  const [qris, setQris] = useState<{ image: string | null; accountId: string }>({ image: null, accountId: "" });
  const file = useRef<HTMLInputElement>(null);
  const tid = temple?.id;
  useEffect(() => {
    setF(empty);
    setQris({ image: temple?.qrisImage ?? null, accountId: temple?.qrisAccountId ?? "" });
    // Reset only when another temple is opened, not after every reload of the same one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tid]);
  if (!temple) return null;
  const accounts = temple.bankAccountsAll;
  const active = accounts.filter((a) => !a.archived);
  const ok = f.label.trim().length >= 2 && f.bankName.trim().length >= 2 && /\d/.test(f.accountNumber) && f.accountHolder.trim().length >= 3;

  async function pickQris(fl: File | undefined) {
    if (file.current) file.current.value = "";
    if (!fl) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(fl.type)) return toast.error("QRIS harus gambar JPG, PNG, atau WEBP.");
    try {
      const img = await compressImage(fl, 900, 0.85);
      setQris((q) => ({ ...q, image: img }));
    } catch {
      toast.error("Gambar ini tidak bisa dibuka.");
    }
  }

  return (
    <>
      <Dialog open={!!temple} onClose={onClose} title="Rekening pura" description={temple.name}>
        <div className="space-y-5">
          {/* Focus starts here (not in the form below), so the list of accounts stays in view. */}
          <p data-autofocus tabIndex={-1} className="rounded-xl bg-mint/60 p-3 text-sm text-emerald-900 focus:outline-none">
            Rekening aktif ditampilkan ke umat untuk transfer punia; jika lebih dari satu, umat memilih rekening yang ia transfer. Hanya Admin Utama yang dapat menambah, mengubah, atau menonaktifkan rekening, dan setiap perubahan tercatat di Log Aktivitas. Saldo awal tiap rekening diisi pengurus.
          </p>

          {accounts.length > 0 && (
            <ul className="divide-y divide-line rounded-2xl border border-line" aria-label="Daftar rekening">
              {accounts.map((a) => (
                <li key={a.id} className={a.archived ? "p-3 opacity-60" : "p-3"}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Landmark className="h-4 w-4 text-emerald-700" />
                    <span className="font-bold">{a.label || a.name}</span>
                    {a.isPrimary && <Badge tone="gold"><Star className="h-3 w-3" /> Utama</Badge>}
                    {a.archived && <Badge tone="gray">Nonaktif</Badge>}
                    {!a.archived && !a.isPublic && <Badge tone="gray">Tidak tampil ke umat</Badge>}
                    {temple.qrisAccountId === a.id && <Badge tone="emerald"><QrCode className="h-3 w-3" /> QRIS</Badge>}
                  </div>
                  <p className="mt-0.5 text-sm text-muted">{a.bankName ?? "—"} · {a.accountNumber ?? "—"} · a.n. {a.accountHolder ?? "—"}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {!a.archived && <Button size="sm" variant="ghost" onClick={() => setF({ id: a.id, label: a.label ?? "", bankName: a.bankName ?? "", accountNumber: a.accountNumber ?? "", accountHolder: a.accountHolder ?? "", isPublic: a.isPublic !== false })}><Pencil className="h-4 w-4" /> Ubah</Button>}
                    {!a.archived && !a.isPrimary && <Button size="sm" variant="ghost" onClick={() => run("adminSetPrimaryBankAccount", { id: a.id }, "Rekening utama diganti")}><Star className="h-4 w-4" /> Jadikan utama</Button>}
                    {a.archived ? (
                      <Button size="sm" variant="ghost" onClick={() => run("adminSetBankAccountActive", { id: a.id, active: true }, "Rekening aktif kembali")}><CheckCircle2 className="h-4 w-4" /> Aktifkan</Button>
                    ) : (
                      <Button size="sm" variant="ghost" className="text-expense" onClick={() => setDeactivate({ a, reason: "" })}><Ban className="h-4 w-4" /> Nonaktifkan</Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <fieldset className="space-y-3 rounded-2xl border border-line p-4">
            <legend className="px-1 text-[15px] font-bold">{f.id ? "Ubah rekening" : accounts.length ? "Tambah rekening" : "Rekening pertama"}</legend>
            <Field label="Label singkat" htmlFor="bk-label" hint='Mis. "Kas Umum" atau "Pembangunan". Tampil ke umat.'><Input id="bk-label" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} maxLength={40} /></Field>
            <Field label="Nama bank" htmlFor="bk-name"><Input id="bk-name" value={f.bankName} onChange={(e) => setF({ ...f, bankName: e.target.value })} placeholder="BPD Bali, BRI, …" /></Field>
            <Field label="Nomor rekening" htmlFor="bk-no"><Input id="bk-no" inputMode="numeric" value={f.accountNumber} onChange={(e) => setF({ ...f, accountNumber: e.target.value })} /></Field>
            <Field label="Nama pemilik rekening (atas nama)" htmlFor="bk-holder" hint="Ditampilkan ke umat, misalnya &quot;Pengurus Pura Dalem …&quot;."><Input id="bk-holder" value={f.accountHolder} onChange={(e) => setF({ ...f, accountHolder: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-[15px] font-semibold">
              <input type="checkbox" className="h-5 w-5 accent-emerald-600" checked={f.isPublic} onChange={(e) => setF({ ...f, isPublic: e.target.checked })} />
              Tampil untuk umat (bisa dipilih saat berpunia)
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              {f.id && <Button variant="ghost" onClick={() => setF(empty)}>Batal ubah</Button>}
              <Button disabled={!ok} onClick={() => setConfirm(true)}>Simpan rekening</Button>
            </div>
          </fieldset>

          <fieldset className="space-y-3 rounded-2xl border border-line p-4">
            <legend className="flex items-center gap-1.5 px-1 text-[15px] font-bold"><QrCode className="h-4 w-4" /> QRIS (opsional)</legend>
            <p className="text-sm text-muted">Gambar QRIS pura dan rekening tujuannya. Pengurus tidak bisa menggantinya. Umat diingatkan memeriksa nama merchant.</p>
            {qris.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qris.image} alt="QRIS pura" className="max-h-56 rounded-xl border border-line" />
            ) : (
              <p className="text-sm italic text-muted">Belum ada QRIS.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => file.current?.click()}><ImagePlus className="h-4 w-4" /> {qris.image ? "Ganti gambar" : "Pilih gambar QRIS"}</Button>
              {temple.qrisImage && <Button size="sm" variant="ghost" className="text-expense" onClick={() => run("adminSetQris", { templeId: temple.id, image: null }, "QRIS dihapus")}><Trash2 className="h-4 w-4" /> Hapus QRIS</Button>}
            </div>
            <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Gambar QRIS" onChange={(e) => pickQris(e.target.files?.[0])} />
            <Field label="Rekening tujuan QRIS" htmlFor="qris-acc">
              <Select id="qris-acc" value={qris.accountId} onChange={(e) => setQris({ ...qris, accountId: e.target.value })}>
                <option value="">— Pilih rekening —</option>
                {active.map((a) => <option key={a.id} value={a.id}>{a.label || a.name} · {a.bankName} {a.accountNumber}</option>)}
              </Select>
            </Field>
            <div className="flex justify-end">
              <Button size="sm" disabled={!qris.image || !qris.accountId || (qris.image === temple.qrisImage && qris.accountId === temple.qrisAccountId)} onClick={() => run("adminSetQris", { templeId: temple.id, image: qris.image, accountId: qris.accountId }, "QRIS disimpan")}>Simpan QRIS</Button>
            </div>
          </fieldset>
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Simpan rekening?"
        description={<>Umat dapat mentransfer punia ke <strong>{f.bankName} {f.accountNumber}</strong> a.n. <strong>{f.accountHolder}</strong> ({f.label}). Pastikan sudah benar.</>}
        confirmLabel="Ya, simpan"
        onConfirm={async () => {
          setConfirm(false);
          if (await run("adminSaveBankAccount", { templeId: temple.id, id: f.id || undefined, label: f.label, bankName: f.bankName, accountNumber: f.accountNumber, accountHolder: f.accountHolder, isPublic: f.isPublic }, "Rekening disimpan")) setF(empty);
        }}
      />
      <Dialog
        open={!!deactivate}
        onClose={() => setDeactivate(null)}
        title="Nonaktifkan rekening?"
        description={deactivate ? `${deactivate.a.label || deactivate.a.name} · ${deactivate.a.bankName} ${deactivate.a.accountNumber}` : undefined}
        footer={
          <Button size="lg" variant="danger" className="w-full" disabled={!deactivate || deactivate.reason.trim().length < 5} onClick={async () => { if (deactivate && (await run("adminSetBankAccountActive", { id: deactivate.a.id, active: false, reason: deactivate.reason }, "Rekening dinonaktifkan"))) setDeactivate(null); }}>
            Nonaktifkan
          </Button>
        }
      >
        {deactivate && (
          <div className="space-y-3">
            <p className="rounded-xl bg-amber-50 p-3 text-[15px] text-amber-900">Rekening tidak lagi tampil ke umat dan tidak bisa dipilih untuk catatan baru. <b>Transaksi lama dan saldonya tetap ada.</b> QRIS yang tertaut ke rekening ini ikut dinonaktifkan.</p>
            <Field label="Alasan (wajib)" htmlFor="bk-off-reason"><Textarea id="bk-off-reason" rows={2} value={deactivate.reason} onChange={(e) => setDeactivate({ ...deactivate, reason: e.target.value })} /></Field>
          </div>
        )}
      </Dialog>
    </>
  );
}
