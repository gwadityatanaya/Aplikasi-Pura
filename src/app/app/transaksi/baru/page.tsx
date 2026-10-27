"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownLeft, ArrowLeft, ArrowLeftRight, ArrowUpRight, Banknote, Check, CheckCircle2, Landmark, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { MoneyInput, QuickAmounts } from "@/components/ui/money-input";
import { ImageUpload } from "@/components/ui/file-upload";
import { NoAccess } from "@/components/app/page-header";
import { ICONS } from "@/components/app/tx-row";
import { useCan, useWorkspace } from "@/components/app/hooks";
import { useStore } from "@/lib/store";
import { cn, formatDateLong, rupiah, todayISO, uid } from "@/lib/format";
import type { TxType } from "@/lib/types";

interface FormState {
  amount: number;
  date: string;
  categoryId: string;
  description: string;
  activityId: string;
  accountId: string;
  toAccountId: string;
  source: string;
  receipt?: string;
  receiptName?: string;
  notes: string;
}

const TYPE_META: Record<TxType, { title: string; icon: typeof ArrowDownLeft; tone: string; verb: string }> = {
  income: { title: "Catat Pemasukan", icon: ArrowDownLeft, tone: "bg-mint text-emerald-700", verb: "Pemasukan" },
  expense: { title: "Catat Pengeluaran", icon: ArrowUpRight, tone: "bg-orange-50 text-orange-700", verb: "Pengeluaran" },
  transfer: { title: "Pindah Dana", icon: ArrowLeftRight, tone: "bg-sky-50 text-sky-700", verb: "Pindah dana" },
};

function TxForm() {
  const params = useSearchParams();
  const router = useRouter();
  const ws = useWorkspace();
  const can = useCan();
  const addTransaction = useStore((s) => s.addTransaction);
  const updateDraft = useStore((s) => s.updateDraft);
  const editId = params.get("edit");
  const editing = editId ? ws.transactions.find((t) => t.id === editId && t.status === "draft") : undefined;
  const type = (editing?.type ?? (params.get("type") as TxType)) || "expense";
  const demo = params.get("demo") === "1";
  const meta = TYPE_META[type] ?? TYPE_META.expense;
  const idemKey = useRef(uid("idem"));
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const cash = ws.accounts.find((a) => a.type === "cash" && !a.archived);
  const bank = ws.accounts.find((a) => a.type === "bank" && !a.archived);

  const [f, setF] = useState<FormState>(() => ({
    amount: editing?.amount ?? 0,
    date: editing?.date ?? todayISO(),
    categoryId: editing?.categoryId ?? "",
    description: editing?.description ?? "",
    activityId: editing?.activityId ?? "",
    accountId: editing?.accountId ?? (type === "transfer" ? cash?.id : type === "income" ? cash?.id : cash?.id) ?? "",
    toAccountId: editing?.toAccountId ?? bank?.id ?? "",
    source: editing?.source ?? "",
    receipt: editing?.receipt,
    receiptName: editing?.receiptName,
    notes: editing?.notes ?? "",
  }));
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  const cats = useMemo(() => ws.categories.filter((c) => c.type === type && !c.archived), [ws.categories, type]);
  const activities = ws.activities.filter((a) => a.status !== "done");
  const steps = type === "transfer" ? ["Nominal", "Rekening", "Periksa"] : ["Nominal", "Keperluan", "Kas & bukti", "Periksa"];

  // Demo mode: fill the form visibly, step by step (nothing is saved here).
  useEffect(() => {
    if (!demo) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const target = 425_000;
    for (let i = 1; i <= 10; i++) timers.push(setTimeout(() => setF((p) => ({ ...p, amount: Math.round((target * i) / 10 / 1000) * 1000 })), 300 + i * 70));
    timers.push(setTimeout(() => setStep(1), 1900));
    timers.push(setTimeout(() => setF((p) => ({ ...p, categoryId: ws.categories.find((c) => c.name === "Upakara & Banten")?.id ?? "" })), 2600));
    const desc = "Bunga, janur & buah untuk banten Piodalan";
    for (let i = 1; i <= desc.length; i++) timers.push(setTimeout(() => setF((p) => ({ ...p, description: desc.slice(0, i) })), 3000 + i * 30));
    timers.push(setTimeout(() => setF((p) => ({ ...p, activityId: "a_piodalan" })), 4400));
    timers.push(setTimeout(() => setStep(2), 5200));
    timers.push(setTimeout(() => setStep(3), 6800));
    return () => timers.forEach(clearTimeout);
  }, [demo, ws.categories]);

  if (!can("tx.create") && !can("tx.draft")) return <NoAccess what="pencatatan transaksi" />;
  const draftOnly = !can("tx.create");

  function validate(s: number) {
    const e: Record<string, string> = {};
    const name = steps[s];
    if (name === "Nominal") {
      if (!f.amount || f.amount <= 0) e.amount = "Isi nominal lebih dari Rp0";
      if (f.amount > 10_000_000_000) e.amount = "Nominal terlalu besar";
      if (!f.date) e.date = "Pilih tanggal";
      else if (f.date > todayISO()) e.date = "Tanggal tidak boleh di masa depan";
    }
    if (name === "Keperluan") {
      if (!f.categoryId) e.categoryId = "Pilih salah satu jenis";
      if (f.description.trim().length < 3) e.description = "Tulis keterangan singkat (min. 3 huruf)";
    }
    if (name === "Kas & bukti" && !f.accountId) e.accountId = "Pilih kas atau rekening";
    if (name === "Rekening") {
      if (!f.accountId || !f.toAccountId) e.accountId = "Pilih rekening asal dan tujuan";
      else if (f.accountId === f.toAccountId) e.accountId = "Rekening asal dan tujuan tidak boleh sama";
      if (f.description.trim().length < 3) e.description = "Tulis keterangan singkat";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }
  function next() {
    if (validate(step)) setStep((s) => Math.min(s + 1, steps.length - 1));
  }

  async function save(status: "draft" | "confirmed") {
    for (let i = 0; i < steps.length - 1; i++) if (!validate(i)) return setStep(i);
    if (saving) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 450));
    const payload = {
      type,
      amount: f.amount,
      date: f.date,
      categoryId: type === "transfer" ? undefined : f.categoryId,
      description: f.description.trim(),
      accountId: f.accountId,
      toAccountId: type === "transfer" ? f.toAccountId : undefined,
      activityId: f.activityId || undefined,
      source: f.source.trim() || undefined,
      receipt: f.receipt,
      receiptName: f.receiptName,
      notes: f.notes.trim() || undefined,
      status,
    };
    if (editing) {
      const r = updateDraft(editing.id, payload);
      if (!r.ok) {
        setSaving(false);
        return toast.error(r.error);
      }
      if (status === "confirmed") useStore.getState().confirmDraft(editing.id);
      setSavedId(editing.id);
    } else {
      const r = addTransaction(payload, idemKey.current);
      if (!r.ok) {
        setSaving(false);
        return toast.error(r.error);
      }
      setSavedId(r.value.id);
    }
    setSaving(false);
    toast.success(status === "draft" ? "Draf tersimpan" : `${meta.verb} ${rupiah(f.amount)} tersimpan`);
  }

  if (savedId) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", bounce: 0.55 }} className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-mint text-emerald-700">
          <CheckCircle2 className="h-12 w-12" />
        </motion.div>
        <h1 className="mt-6 text-2xl font-extrabold text-forest">Berhasil disimpan!</h1>
        <p className="mt-2 text-[17px] text-muted">
          {meta.verb} <strong className="tabular text-charcoal">{rupiah(f.amount)}</strong> sudah masuk ke buku kas pura.
        </p>
        <div className="mt-8 grid gap-2">
          <Link href={`/app/transaksi/${savedId}`} className={buttonClass("primary", "xl")}>Lihat transaksi</Link>
          <button
            className={buttonClass("outline", "xl")}
            onClick={() => {
              idemKey.current = uid("idem");
              setF((p) => ({ ...p, amount: 0, description: "", categoryId: "", receipt: undefined, notes: "", source: "" }));
              setStep(0);
              setSavedId(null);
            }}
          >
            Catat lagi
          </button>
          <Link href="/app" className={buttonClass("ghost", "xl")}>Kembali ke beranda</Link>
        </div>
      </div>
    );
  }

  const cat = cats.find((c) => c.id === f.categoryId);
  const acc = ws.accounts.find((a) => a.id === f.accountId);
  const toAcc = ws.accounts.find((a) => a.id === f.toAccountId);

  return (
    <div className="mx-auto max-w-2xl" data-tour="tx-form">
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => (step > 0 ? setStep(step - 1) : router.back())} className="press grid h-11 w-11 place-items-center rounded-xl border border-line bg-white" aria-label="Kembali">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className={cn("grid h-11 w-11 place-items-center rounded-xl", meta.tone)}><meta.icon className="h-5 w-5" /></span>
        <div>
          <h1 className="text-xl font-extrabold text-forest md:text-2xl">{editing ? "Ubah draf" : meta.title}</h1>
          <p className="text-sm text-muted">Langkah {step + 1} dari {steps.length} · {steps[step]}</p>
        </div>
      </div>
      <div className="mb-6 flex gap-1.5" aria-hidden>
        {steps.map((s, i) => <span key={s} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", i <= step ? "bg-emerald-600" : "bg-stone-200")} />)}
      </div>
      {draftOnly && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Peran Anda hanya dapat membuat <strong>draf</strong>. Ketua atau Bendahara akan mengonfirmasinya.</p>}

      <Card className="p-5 md:p-7">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }} className="space-y-5">
            {steps[step] === "Nominal" && (
              <>
                <Field label={type === "income" ? "Berapa uang yang diterima?" : type === "expense" ? "Berapa uang yang dikeluarkan?" : "Berapa yang dipindahkan?"} htmlFor="amount" error={errors.amount}>
                  <MoneyInput id="amount" large autoFocus={!demo} value={f.amount} onChange={(v) => set("amount", v)} invalid={!!errors.amount} />
                </Field>
                <QuickAmounts onPick={(v) => set("amount", v)} />
                <Field label="Tanggal" htmlFor="date" error={errors.date} hint={f.date ? formatDateLong(f.date) : undefined}>
                  <Input id="date" type="date" max={todayISO()} value={f.date} onChange={(e) => set("date", e.target.value)} />
                </Field>
              </>
            )}
            {steps[step] === "Keperluan" && (
              <>
                <Field label={type === "income" ? "Dari mana pemasukan ini?" : "Untuk keperluan apa?"} error={errors.categoryId}>
                  <div role="radiogroup" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {cats.map((c) => {
                      const Icon = ICONS[c.icon] ?? Check;
                      const active = f.categoryId === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => set("categoryId", c.id)}
                          className={cn("press flex min-h-[88px] flex-col items-start justify-between gap-2 rounded-2xl border p-3 text-left text-sm font-semibold", active ? "border-emerald-500 bg-mint/50 ring-2 ring-emerald-500/25" : "border-line bg-white hover:border-emerald-300")}
                        >
                          <Icon className={cn("h-6 w-6", active ? "text-emerald-700" : "text-muted")} />
                          <span className="leading-snug">{c.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Field label="Keterangan" htmlFor="desc" error={errors.description} hint="Contoh: Banten Purnama, Tagihan listrik Oktober">
                  <Input id="desc" value={f.description} onChange={(e) => set("description", e.target.value)} maxLength={120} />
                </Field>
                <Field label="Untuk kegiatan (opsional)" htmlFor="act" hint="Membantu menyusun laporan per kegiatan.">
                  <Select id="act" value={f.activityId} onChange={(e) => set("activityId", e.target.value)}>
                    <option value="">— Tidak terkait kegiatan khusus —</option>
                    {activities.map((a) => <option key={a.id} value={a.id}>{a.name}{a.fundType === "restricted" ? " (dana khusus)" : ""}</option>)}
                  </Select>
                </Field>
              </>
            )}
            {steps[step] === "Kas & bukti" && (
              <>
                <Field label={type === "income" ? "Uang disimpan di mana?" : "Uang diambil dari mana?"} error={errors.accountId}>
                  <AccountPicker accounts={ws.accounts} value={f.accountId} onChange={(v) => set("accountId", v)} />
                </Field>
                {type === "income" && (
                  <Field label="Nama pemberi / sumber (opsional)" htmlFor="src">
                    <Input id="src" value={f.source} onChange={(e) => set("source", e.target.value)} placeholder="Mis. Keluarga I Wayan Adi" />
                  </Field>
                )}
                <Field label={type === "expense" ? "Foto nota / kuitansi" : "Bukti (opsional)"} hint={type === "expense" ? "Sangat disarankan agar laporan dapat dipertanggungjawabkan." : undefined}>
                  <ImageUpload value={f.receipt} onChange={(v, n) => { set("receipt", v); set("receiptName", n); }} />
                </Field>
                <Field label="Catatan tambahan (opsional)" htmlFor="notes">
                  <Textarea id="notes" rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
                </Field>
              </>
            )}
            {steps[step] === "Rekening" && (
              <>
                <Field label="Dari" error={errors.accountId}>
                  <AccountPicker accounts={ws.accounts} value={f.accountId} onChange={(v) => set("accountId", v)} />
                </Field>
                <Field label="Ke">
                  <AccountPicker accounts={ws.accounts} value={f.toAccountId} onChange={(v) => set("toAccountId", v)} />
                </Field>
                <Field label="Keterangan" htmlFor="desc" error={errors.description}>
                  <Input id="desc" value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Setor kas tunai ke rekening pura" />
                </Field>
                <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-900">Pindah dana bukan pemasukan atau pengeluaran — total saldo pura tidak berubah.</p>
              </>
            )}
            {steps[step] === "Periksa" && (
              <div>
                <p className="text-sm font-semibold text-muted">Periksa sekali lagi sebelum menyimpan</p>
                <div className="mt-3 rounded-3xl bg-ivory p-5">
                  <p className="text-sm text-muted">{meta.verb}</p>
                  <p className={cn("tabular text-4xl font-extrabold", type === "income" ? "text-income" : type === "expense" ? "text-expense" : "text-sky-800")}>{rupiah(f.amount)}</p>
                  <dl className="mt-4 divide-y divide-line text-[15px]">
                    <Row label="Tanggal" value={formatDateLong(f.date)} onEdit={() => setStep(0)} />
                    {type !== "transfer" && <Row label="Jenis" value={cat?.name ?? "—"} onEdit={() => setStep(1)} />}
                    <Row label="Keterangan" value={f.description || "—"} onEdit={() => setStep(1)} />
                    {f.activityId && <Row label="Kegiatan" value={ws.activities.find((a) => a.id === f.activityId)?.name ?? ""} onEdit={() => setStep(1)} />}
                    <Row label={type === "transfer" ? "Dari" : type === "income" ? "Disimpan di" : "Diambil dari"} value={acc?.name ?? "—"} onEdit={() => setStep(type === "transfer" ? 1 : 2)} />
                    {type === "transfer" && <Row label="Ke" value={toAcc?.name ?? "—"} onEdit={() => setStep(1)} />}
                    {f.source && <Row label="Sumber" value={f.source} onEdit={() => setStep(2)} />}
                    {type !== "transfer" && <Row label="Bukti" value={f.receipt ? "Terlampir ✓" : "Tidak ada"} onEdit={() => setStep(2)} />}
                  </dl>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-7 flex flex-col gap-2 sm:flex-row-reverse">
          {steps[step] !== "Periksa" ? (
            <Button size="xl" className="flex-1" onClick={next}>Lanjut</Button>
          ) : (
            <>
              {!draftOnly && (
                <Button size="xl" className="flex-1" onClick={() => save("confirmed")} loading={saving}>
                  <Check className="h-5 w-5" /> Simpan
                </Button>
              )}
              <Button size="xl" variant={draftOnly ? "primary" : "outline"} className="flex-1" onClick={() => save("draft")} disabled={saving}>
                Simpan sebagai draf
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <dt className="w-28 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 font-semibold">{value}</dd>
      <button type="button" onClick={onEdit} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-white" aria-label={`Ubah ${label}`}>
        <Pencil className="h-4 w-4" />
      </button>
    </div>
  );
}

function AccountPicker({ accounts, value, onChange }: { accounts: { id: string; name: string; type: string; bankName?: string; archived?: boolean }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
      {accounts.filter((a) => !a.archived).map((a) => {
        const active = value === a.id;
        const Icon = a.type === "cash" ? Banknote : Landmark;
        return (
          <button key={a.id} type="button" role="radio" aria-checked={active} onClick={() => onChange(a.id)} className={cn("press flex items-center gap-3 rounded-2xl border p-4 text-left", active ? "border-emerald-500 bg-mint/50 ring-2 ring-emerald-500/25" : "border-line bg-white hover:border-emerald-300")}>
            <span className={cn("grid h-11 w-11 place-items-center rounded-xl", active ? "bg-emerald-600 text-white" : "bg-stone-100 text-muted")}><Icon className="h-5 w-5" /></span>
            <span>
              <span className="block font-semibold">{a.name}</span>
              <span className="block text-sm text-muted">{a.type === "cash" ? "Uang tunai" : a.bankName}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function NewTransactionPage() {
  return (
    <Suspense>
      <TxForm />
    </Suspense>
  );
}
