import { cn } from "@/lib/format";

/** Subtle geometric lattice inspired by Balinese stone carving (patra), used as a background texture. */
export function PatternBg({ className, opacity = 0.08, color = "#FFFFFF" }: { className?: string; opacity?: number; color?: string }) {
  return (
    <svg className={cn("pointer-events-none absolute inset-0 h-full w-full", className)} aria-hidden>
      <defs>
        <pattern id={`patra-${color.replace("#", "")}`} width="44" height="44" patternUnits="userSpaceOnUse">
          <path
            d="M22 2 L42 22 L22 42 L2 22 Z M22 12 L32 22 L22 32 L12 22 Z"
            fill="none"
            stroke={color}
            strokeWidth="1"
            opacity={opacity * 10}
          />
          <circle cx="22" cy="22" r="2" fill={color} opacity={opacity * 10} />
          <circle cx="0" cy="0" r="1.5" fill={color} opacity={opacity * 10} />
          <circle cx="44" cy="44" r="1.5" fill={color} opacity={opacity * 10} />
          <circle cx="44" cy="0" r="1.5" fill={color} opacity={opacity * 10} />
          <circle cx="0" cy="44" r="1.5" fill={color} opacity={opacity * 10} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#patra-${color.replace("#", "")})`} style={{ opacity: 0.1 }} />
    </svg>
  );
}

/** Refined decorative divider with a central diamond. */
export function OrnamentDivider({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 text-gold", className)} aria-hidden>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/60" />
      <svg width="34" height="12" viewBox="0 0 34 12" fill="currentColor">
        <path d="M17 0 L23 6 L17 12 L11 6 Z" />
        <circle cx="5" cy="6" r="1.6" />
        <circle cx="29" cy="6" r="1.6" />
      </svg>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/60" />
    </div>
  );
}
