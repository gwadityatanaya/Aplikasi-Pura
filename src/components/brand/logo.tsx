import { cn } from "@/lib/format";

/** Split-gate (candi bentar) glyph used as the PURA mark. */
export function PuraGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden fill="currentColor">
      <path d="M4 28V24h2v-3h1.5v-3H9v-3h1.5v-3h1V9h1v3h.5v16H4Z" />
      <path d="M28 28V24h-2v-3h-1.5v-3H23v-3h-1.5v-3h-1V9h-1v3H19v16h9Z" />
      <rect x="3" y="28" width="26" height="1.6" rx=".8" />
      <circle cx="16" cy="9" r="2" opacity=".85" />
    </svg>
  );
}

export function Logo({ className, light, compact }: { className?: string; light?: boolean; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "grid h-9 w-9 place-items-center rounded-xl shadow-sm",
          light ? "bg-white/15 text-gold-light ring-1 ring-white/20" : "bg-gradient-to-br from-emerald-600 to-forest text-gold-light"
        )}
      >
        <PuraGlyph className="h-6 w-6" />
      </span>
      {!compact && (
        <span className={cn("text-xl font-extrabold tracking-[0.18em]", light ? "text-white" : "text-forest")}>PURA</span>
      )}
    </span>
  );
}
