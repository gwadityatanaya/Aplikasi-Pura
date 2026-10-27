"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/format";

export function Progress({
  value,
  className,
  tone = "emerald",
  height = "h-2.5",
  label,
}: {
  value: number;
  className?: string;
  tone?: "emerald" | "gold" | "white";
  height?: string;
  label?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? "Progres"}
      className={cn("w-full overflow-hidden rounded-full", tone === "white" ? "bg-white/20" : "bg-stone-100", height, className)}
    >
      <motion.div
        className={cn(
          "h-full rounded-full",
          tone === "emerald" && "bg-gradient-to-r from-emerald-500 to-emerald-700",
          tone === "gold" && "bg-gradient-to-r from-gold to-[#b08d4b]",
          tone === "white" && "bg-gradient-to-r from-gold-light to-gold"
        )}
        initial={{ width: 0 }}
        animate={{ width: `${v}%` }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}
