"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarCheck2, History, PenLine } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { useWorkspace } from "@/components/app/hooks";
import { useStore } from "@/lib/store";
import { formatDate, formatDateTime, rupiah, todayISO } from "@/lib/format";
import type { Account } from "@/lib/types";

/** Names of this temple's pengurus, offered as witnesses (any name may still be typed). */
function usePengurusNames() {
  const ws = useWorkspace();
  return useMemo(() => {
    const ids = new Set(ws.data.memberships.filter((m) => m.templeId === ws.templeId && m.status === "active" && m.role === "pengurus").map((m) => m.userId));
    return ws.users.filter((u) => ids.has(u.id)).map((u) => u.name);
  }, [ws.data.memberships, ws.templeId, ws.users]);
}

function Witnesses({ value, onChange }: { value: [string, string]; onChange: (v: [string, string]) => void }) {
  const names = usePengurusNames();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <datalist id="saksi-pengurus">{names.map((n) => <option key={n} value={n} />)}</datalist>
      <Field label="Saksi 1 (pengurus)" htmlFor="saksi-1"><Input id="saksi-1" list="saksi-pengurus" value={value[0]} onChange={(e) => onChange([e.target.value, value[1]])} placeholder="Nama lengkap" /></Field>
      <Field label="Saksi 2 (pengurus)" htmlFor="saksi-2"><Input id="saksi-2" list="saksi-pengurus" value={value[1]} onChange={(e) => onChange([value[0], e.target.value])} placeholder="Nama lengkap" /></Field>
    </div>
  );
}
const witnessesOk = (w: [string, string]) => w[0].trim().length >= 3 && w[1].trim().length >= 3 && w[0].trim().toLowerCase() !== w[1].trim().toLowerCase();

/** "Mulai memakai aplikasi": start date + opening balance of every cash box and bank account, with two witnesses. */
export function StartBooks({ canEdit }: { canEdit: boolean }) {
  const ws = useWorkspace();
  const run = useStore((s) => s.run);
  const t = ws.temple!;
  const accounts = ws.accounts.filter((a) => !a.archived);
  const firstTx = ws.transactions.reduce((d, x) => (!d || x.date < d ? x.date : d), "");
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [w, setW] = useState<[string, string]>(["", ""]);
  const [counted, setCounted] = useState(false);
  const [busy, setBusy] = useState(false);

  if (t.booksStartDate)
    return (
      <div className="rounded-2xl border border-emerald-200 bg-mint/40 p-4" role="status">
        <p className="flex items-center gap-2 font-bold"><CalendarCheck2 className="h-5 w-5 text-emerald-700" /> Pembukuan di aplikasi dimulai {formatDate(t.booksStartDate)}</p>
        <p className="mt-1 text-[0.9375rem]">Saldo awal dihitung bersama dan disaksikan oleh <b>{t.booksWitnesses}</b>. Transaksi bertanggal sebelum {formatDate(t.booksStartDate)} termasuk buku lama dan ditolak aplikasi.</p>
        <p className="mt-1 text-sm text-muted">Saldo awal terkunci. Jika ternyata keliru, gunakan <b>Koreksi saldo awal</b> pada kas/rekening di bawah (alasan dan dua saksi, tercatat).</p>
      </div>
    );

  async function save() {
    setBusy(true);
    const r = await run("startBooks", { startDate: date, balances: accounts.map((a) => ({ accountId: a.id, amount: amounts[a.id] ?? 0 })), witnesses: w });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success("Pembukuan dimulai. Saldo awal tersimpan dan terkunci.");
    setOpen(false);
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-gold bg-gold-light/40 p-4">
      <p className="flex items-center gap-2 font-bold"><CalendarCheck2 className="h-5 w-5 text-gold-dark" /> Belum ada tanggal mulai pembukuan</p>
      <p className="mt-1 text-[0.9375rem]">Tentukan tanggal mulai memakai aplikasi, lalu isi saldo awal setiap kas dan rekening pada tanggal itu — dihitung bersama oleh dua pengurus. Lihat <b>Checklist hari mulai</b> di panduan.</p>
      {canEdit && <Button className="mt-3" onClick={() => { setAmounts(Object.fromEntries(accounts.map((a) => [a.id, a.openingBase ?? a.openingBalance]))); setOpen(true); }}>Mulai pembukuan</Button>}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Mulai pembukuan di aplikasi"
        description="Sekali saja. Setelah disimpan, saldo awal terkunci dan hanya bisa dikoreksi dengan alasan dan dua saksi."
        footer={<Button size="lg" className="w-full" loading={busy} disabled={!date || !counted || !witnessesOk(w)} onClick={save}>Simpan & kunci saldo awal</Button>}
      >
        <div className="space-y-4">
          <Field label="Tanggal mulai memakai aplikasi" htmlFor="bk-start" hint={firstTx ? `Paling lambat ${formatDate(firstTx)} (tanggal transaksi pertama yang sudah tercatat).` : "Transaksi sebelum tanggal ini termasuk buku lama."}>
            <Input id="bk-start" type="date" max={firstTx && firstTx < todayISO() ? firstTx : todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <fieldset className="space-y-3 rounded-2xl border border-line p-4">
            <legend className="px-1 text-[0.9375rem] font-bold">Saldo awal pada tanggal itu</legend>
            {accounts.map((a) => (
              <Field key={a.id} label={`${a.label || a.name}${a.type === "cash" ? " (hitung uang tunai)" : " (saldo di mutasi bank)"}`}>
                <MoneyInput value={amounts[a.id] ?? 0} onChange={(v) => setAmounts({ ...amounts, [a.id]: v })} />
              </Field>
            ))}
          </fieldset>
          <Witnesses value={w} onChange={setW} />
          <label className="flex items-start gap-2 text-[0.9375rem] font-semibold">
            <input type="checkbox" className="mt-0.5 h-5 w-5 accent-emerald-600" checked={counted} onChange={(e) => setCounted(e.target.checked)} />
            Kami berdua sudah menghitung uang tunai dan mencocokkan saldo rekening bersama-sama.
          </label>
        </div>
      </Dialog>
    </div>
  );
}

/** Per account: "Isi saldo awal" (new account after the start) or "Koreksi saldo awal" + history. */
export function OpeningActions({ a, canEdit }: { a: Account; canEdit: boolean }) {
  const ws = useWorkspace();
  const run = useStore((s) => s.run);
  const started = !!ws.temple?.booksStartDate;
  const corrections = (ws.data.openingCorrections ?? []).filter((c) => c.accountId === a.id);
  const [mode, setMode] = useState<"set" | "correct" | null>(null);
  const [amount, setAmount] = useState(0);
  const [dir, setDir] = useState<"plus" | "minus">("plus");
  const [reason, setReason] = useState("");
  const [w, setW] = useState<[string, string]>(["", ""]);
  const [busy, setBusy] = useState(false);
  if (!started) return null;

  async function save() {
    setBusy(true);
    const r =
      mode === "set"
        ? await run("setOpeningBalance", { accountId: a.id, amount, witnesses: w })
        : await run("correctOpeningBalance", { accountId: a.id, amount: dir === "plus" ? amount : -amount, reason, witnesses: w });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success(mode === "set" ? "Saldo awal disimpan dan dikunci" : "Koreksi saldo awal dicatat");
    setMode(null);
  }
  const open = (m: "set" | "correct") => { setAmount(0); setDir("plus"); setReason(""); setW(["", ""]); setMode(m); };

  return (
    <div className="w-full">
      {a.openingSetAt ? (
        <p className="text-sm text-muted">
          Saldo awal {rupiah(a.openingBase ?? a.openingBalance)} per {formatDate(a.openingDate)} · saksi: {a.openingWitnesses}
          {!!a.openingCorrection && <> · dikoreksi {a.openingCorrection > 0 ? "+" : "−"}{rupiah(Math.abs(a.openingCorrection))} → <b>{rupiah(a.openingBalance)}</b></>}
        </p>
      ) : (
        <p className="text-sm font-semibold text-amber-800">Saldo awal belum diisi dan disaksikan.</p>
      )}
      {corrections.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-sm text-muted" aria-label={`Koreksi saldo awal ${a.label || a.name}`}>
          {corrections.map((c) => (
            <li key={c.id} className="flex gap-1.5"><History className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {formatDateTime(c.createdAt)}: {c.amount > 0 ? "+" : "−"}{rupiah(Math.abs(c.amount))} — {c.reason} (saksi: {c.witnesses})</li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="mt-2">
          {a.openingSetAt ? (
            <Button size="sm" variant="ghost" onClick={() => open("correct")}><PenLine className="h-4 w-4" /> Koreksi saldo awal</Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => open("set")}>Isi saldo awal</Button>
          )}
        </div>
      )}
      <Dialog
        open={!!mode}
        onClose={() => setMode(null)}
        title={mode === "set" ? "Isi saldo awal" : "Koreksi saldo awal"}
        description={a.label || a.name}
        footer={<Button size="lg" className="w-full" loading={busy} disabled={!witnessesOk(w) || (mode === "correct" && (amount <= 0 || reason.trim().length < 5))} onClick={save}>Simpan</Button>}
      >
        <div className="space-y-4">
          {mode === "correct" ? (
            <>
              <p className="rounded-xl bg-amber-50 p-3 text-[0.9375rem] text-amber-900">Saldo awal yang lama <b>tidak dihapus</b>. Koreksi dicatat terpisah (tidak bisa diubah atau dihapus) dan ikut dihitung di saldo.</p>
              <Field label="Arah koreksi" htmlFor="oc-dir">
                <Select id="oc-dir" value={dir} onChange={(e) => setDir(e.target.value as "plus" | "minus")}>
                  <option value="plus">Tambah (saldo awal ternyata lebih besar)</option>
                  <option value="minus">Kurangi (saldo awal ternyata lebih kecil)</option>
                </Select>
              </Field>
              <Field label="Selisih"><MoneyInput value={amount} onChange={setAmount} /></Field>
              <Field label="Alasan (wajib)" htmlFor="oc-reason"><Textarea id="oc-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
            </>
          ) : (
            <Field label="Saldo awal (hari ini)" hint="Hitung uang tunai / lihat saldo di mutasi bank, bersama dua pengurus."><MoneyInput value={amount} onChange={setAmount} /></Field>
          )}
          <Witnesses value={w} onChange={setW} />
        </div>
      </Dialog>
    </div>
  );
}
