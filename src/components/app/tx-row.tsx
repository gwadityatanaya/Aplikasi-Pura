"use client";
import Link from "next/link";
import {
  ArrowLeftRight,
  Building2,
  CircleMinus,
  CirclePlus,
  Coins,
  FileText,
  Flower2,
  HandHeart,
  Hammer,
  Landmark,
  Megaphone,
  Paperclip,
  Sparkles,
  Tent,
  Undo2,
  UserRound,
  UtensilsCrossed,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatDateShort, rupiah } from "@/lib/format";
import type { Category, Transaction } from "@/lib/types";

export const ICONS: Record<string, LucideIcon> = {
  HandHeart, Coins, Megaphone, Building2, Landmark, CirclePlus, Flower2, Zap, UserRound, Hammer, UtensilsCrossed, Tent, Sparkles, FileText, CircleMinus,
};

export function CategoryIcon({ tx, category, size = "md" }: { tx: Pick<Transaction, "type" | "reversalOf">; category?: Category; size?: "md" | "lg" }) {
  const Icon = tx.reversalOf ? Undo2 : tx.type === "transfer" ? ArrowLeftRight : ICONS[category?.icon ?? ""] ?? (tx.type === "income" ? CirclePlus : CircleMinus);
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-2xl",
        size === "lg" ? "h-14 w-14" : "h-11 w-11",
        tx.reversalOf ? "bg-stone-100 text-stone-600" : tx.type === "income" ? "bg-mint text-emerald-700" : tx.type === "expense" ? "bg-orange-50 text-orange-700" : "bg-sky-50 text-sky-700"
      )}
      aria-hidden
    >
      <Icon className={size === "lg" ? "h-7 w-7" : "h-5 w-5"} />
    </span>
  );
}

export function txSigned(t: Transaction) {
  const s = t.reversalOf ? -1 : 1;
  if (t.type === "income") return s * t.amount;
  if (t.type === "expense") return -s * t.amount;
  return 0;
}

export function TxAmount({ tx, className }: { tx: Transaction; className?: string }) {
  const v = txSigned(tx);
  return (
    <span className={cn("tabular font-bold", tx.type === "transfer" ? "text-sky-800" : v >= 0 ? "text-income" : "text-expense", tx.status === "draft" && "opacity-60", className)}>
      {tx.type === "transfer" ? rupiah(tx.amount) : rupiah(v, { sign: true })}
    </span>
  );
}

export function TxStatusBadges({ tx }: { tx: Transaction }) {
  return (
    <>
      {tx.status === "draft" && <Badge tone="amber" dot>Draf</Badge>}
      {tx.reversedBy && <Badge tone="gray">Dikoreksi</Badge>}
      {tx.reversalOf && <Badge tone="gray">Entri koreksi</Badge>}
      {tx.type === "transfer" && <Badge tone="blue">Pindah dana</Badge>}
    </>
  );
}

export function TxRow({ tx, category, accountName, activityName }: { tx: Transaction; category?: Category; accountName?: string; activityName?: string }) {
  return (
    <Link href={`/app/transaksi/${tx.id}`} className="flex items-center gap-3 rounded-2xl px-2 py-3 transition-colors hover:bg-ivory focus-visible:bg-ivory">
      <CategoryIcon tx={tx} category={category} />
      <div className="min-w-0 flex-1">
        <p className={cn("line-clamp-2 break-words font-semibold leading-snug text-charcoal sm:line-clamp-1", tx.reversedBy && "text-muted line-through decoration-stone-300")}>{tx.description}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-muted">
          <span>{formatDateShort(tx.date)}</span>
          <span aria-hidden>·</span>
          <span className="truncate">{tx.type === "transfer" ? "Pindah dana" : category?.name ?? "Tanpa kategori"}</span>
          {activityName && <span className="hidden truncate sm:inline">· {activityName}</span>}
          {accountName && <span className="hidden truncate md:inline">· {accountName}</span>}
          {tx.receipt && <Paperclip className="h-3.5 w-3.5" aria-label="Ada nota" />}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <TxAmount tx={tx} />
        <div className="flex gap-1"><TxStatusBadges tx={tx} /></div>
      </div>
    </Link>
  );
}
