import * as React from "react";
import { cn } from "@/lib/format";

type Tone = "emerald" | "gold" | "gray" | "red" | "green" | "amber" | "blue" | "violet" | "dark";
const tones: Record<Tone, string> = {
  emerald: "bg-mint text-emerald-900",
  gold: "bg-gold-light text-gold-dark",
  gray: "bg-stone-100 text-stone-700",
  red: "bg-red-50 text-red-700",
  green: "bg-green-50 text-green-700",
  amber: "bg-amber-50 text-amber-800",
  blue: "bg-sky-50 text-sky-800",
  violet: "bg-violet-50 text-violet-800",
  dark: "bg-charcoal text-white",
};

export function Badge({
  tone = "gray",
  className,
  children,
  dot,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
  dot?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}
