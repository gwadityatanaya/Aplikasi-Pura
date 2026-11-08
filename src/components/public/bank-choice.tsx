"use client";
import { toast } from "sonner";
import { Check, Copy, Info, Landmark, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/format";
import type { PublicBankAccount, Temple } from "@/lib/types";

export type PayVia = "transfer" | "qris";

function AccountCard({ a, selected }: { a: PublicBankAccount; selected?: boolean }) {
  return (
    <div className={cn("rounded-2xl bg-gradient-to-br from-emerald-600 to-forest p-4 text-white", selected && "ring-4 ring-gold")}>
      <p className="flex items-center gap-2 text-sm text-white/80"><Landmark className="h-4 w-4" /> {a.bankName} · <b className="text-white">{a.label}</b></p>
      <p className="tabular mt-1 text-2xl font-bold tracking-wider">{a.accountNumber}</p>
      <p className="mt-1">a.n. <strong>{a.accountHolder}</strong></p>
    </div>
  );
}

const copy = (a: PublicBankAccount) => {
  navigator.clipboard?.writeText(a.accountNumber.replace(/\D/g, ""));
  toast.success("Nomor rekening disalin");
};

/**
 * Where to send punia. With more than one bank account the umat picks the one they transfer to
 * (stored on the punia so pengurus know which mutasi to check). QRIS, when Admin Utama set one,
 * is a second way. Without onChange it only shows the options (campaign page).
 */
export function BankChoice({
  temple,
  value,
  onChange,
  via = "transfer",
  onVia,
  error,
}: {
  temple: Temple;
  value?: string;
  onChange?: (id: string) => void;
  via?: PayVia;
  onVia?: (v: PayVia) => void;
  error?: string;
}) {
  const banks = temple.bankAccounts ?? [];
  const qris = temple.qrisImage && banks.find((b) => b.id === temple.qrisAccountId);
  const many = banks.length > 1;
  return (
    <div className="space-y-3">
      {qris && onVia && (
        <Segmented value={via} onChange={onVia} ariaLabel="Cara berpunia" options={[{ value: "transfer", label: "Transfer bank" }, { value: "qris", label: "QRIS" }]} />
      )}
      {via === "qris" && qris ? (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={temple.qrisImage} alt={`QRIS ${temple.name}`} className="mx-auto max-h-80 w-auto rounded-2xl border border-line bg-white p-2" />
          <p className="rounded-xl bg-amber-50 p-3 text-[0.9375rem] font-semibold text-amber-900" role="note">
            Pastikan <b>nama merchant</b> yang muncul di aplikasi pembayaran Anda sesuai nama pura: <b>{temple.name}</b>. Dana masuk ke rekening {qris.label} ({qris.bankName}).
          </p>
          <p className="flex items-start gap-2 text-sm text-muted"><Info className="mt-0.5 h-4 w-4 shrink-0" /> Aplikasi PURA hanya <b>mencatat</b> punia; pembayaran diproses oleh bank atau aplikasi pembayaran Anda, bukan oleh aplikasi ini.</p>
        </div>
      ) : many && onChange ? (
        <fieldset>
          <legend className="mb-2 text-[0.9375rem] font-semibold">Pilih rekening yang Anda transfer</legend>
          <div className="grid gap-2" role="radiogroup" aria-label="Rekening tujuan">
            {banks.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={value === a.id}
                onClick={() => onChange(a.id)}
                className={cn("press flex items-start gap-3 rounded-2xl border p-4 text-left", value === a.id ? "border-emerald-500 bg-mint/50 ring-2 ring-emerald-500/20" : "border-line bg-white")}
              >
                <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{a.label}{a.isPrimary && <span className="ml-2 text-xs font-semibold text-muted">(utama)</span>}</span>
                  <span className="block text-[0.9375rem]">{a.bankName}</span>
                  <span className="tabular block whitespace-nowrap text-[1.0625rem] font-semibold tracking-wide">{a.accountNumber}</span>
                  <span className="block text-sm text-muted">a.n. {a.accountHolder}</span>
                </span>
                {value === a.id && <Check className="h-5 w-5 shrink-0 text-emerald-700" />}
              </button>
            ))}
          </div>
          {error && <p className="mt-1 text-sm font-semibold text-expense">{error}</p>}
          {value && <Button variant="outline" className="mt-2 w-full" onClick={() => copy(banks.find((b) => b.id === value)!)}><Copy className="h-4 w-4" /> Salin nomor rekening yang dipilih</Button>}
        </fieldset>
      ) : (
        banks.map((a) => (
          <div key={a.id}>
            <AccountCard a={a} />
            <Button variant="outline" className="mt-2 w-full" onClick={() => copy(a)}><Copy className="h-4 w-4" /> Salin nomor rekening{many ? ` ${a.label}` : ""}</Button>
          </div>
        ))
      )}
      {via === "transfer" && <p className="text-sm text-muted">Periksa nama pemilik rekening di m-banking sebelum menekan kirim.</p>}
      {qris && !onVia && <p className="flex items-center gap-1.5 text-sm text-muted"><QrCode className="h-4 w-4" /> QRIS juga tersedia di halaman Berpunia.</p>}
    </div>
  );
}
