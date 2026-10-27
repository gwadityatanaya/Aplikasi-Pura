"use client";
import * as React from "react";
import { cn, formatNumber, parseRupiah } from "@/lib/format";

/** Large, friendly Rupiah input that shows thousand separators while typing. */
export const MoneyInput = React.forwardRef<
  HTMLInputElement,
  {
    value: number;
    onChange: (v: number) => void;
    id?: string;
    large?: boolean;
    invalid?: boolean;
    autoFocus?: boolean;
    placeholder?: string;
  }
>(function MoneyInput({ value, onChange, id, large, invalid, autoFocus, placeholder = "0" }, ref) {
  return (
    <div
      className={cn(
        "flex items-center rounded-2xl border bg-white transition-colors focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/15",
        invalid ? "border-expense" : "border-line",
        large ? "h-20 px-5" : "h-12 px-4"
      )}
    >
      <span className={cn("mr-2 font-bold text-muted", large ? "text-2xl" : "text-base")}>Rp</span>
      <input
        ref={ref}
        id={id}
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        aria-invalid={invalid}
        placeholder={placeholder}
        value={value ? formatNumber(value) : ""}
        onChange={(e) => onChange(Math.min(parseRupiah(e.target.value), 999_999_999_999))}
        className={cn(
          "tabular min-w-0 flex-1 bg-transparent font-bold text-charcoal placeholder:text-stone-300 focus:outline-none",
          large ? "text-3xl md:text-4xl" : "text-lg"
        )}
      />
    </div>
  );
});

export function QuickAmounts({ onPick, amounts = [50_000, 100_000, 250_000, 500_000, 1_000_000] }: { onPick: (v: number) => void; amounts?: number[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {amounts.map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => onPick(a)}
          className="press rounded-full border border-line bg-white px-3.5 py-2 text-sm font-semibold text-charcoal hover:border-emerald-400 hover:bg-mint"
        >
          {a >= 1_000_000 ? `${a / 1_000_000} jt` : `${a / 1000} rb`}
        </button>
      ))}
    </div>
  );
}
