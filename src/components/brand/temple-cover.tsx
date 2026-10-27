import { cn } from "@/lib/format";
import type { CoverVariant } from "@/lib/types";

const palettes: Record<CoverVariant, { from: string; to: string; sun: string; silhouette: string; far: string }> = {
  emerald: { from: "#0B8F79", to: "#064E3B", sun: "#F3EAD7", silhouette: "#04382B", far: "#0A6B59" },
  forest: { from: "#4C7A4F", to: "#1F3D2B", sun: "#E9DFC4", silhouette: "#13281C", far: "#355E3D" },
  gold: { from: "#D9B97A", to: "#8A6A2F", sun: "#FFF6E3", silhouette: "#4A3815", far: "#A8864A" },
  ocean: { from: "#3C8DA8", to: "#14455A", sun: "#F5EBD6", silhouette: "#0B2C3A", far: "#2A6A82" },
  dusk: { from: "#C77D5B", to: "#5B2E3A", sun: "#FCE3C3", silhouette: "#2E1620", far: "#8C4A47" },
};

/** Stepped tower half of a candi bentar: flat inner edge (the "split"), stepped outer edge. */
function gateHalf(innerX: number, base: number, w: number, h: number, side: "left" | "right") {
  const tiers = 8;
  const th = h / tiers;
  const parts: string[] = [];
  for (let i = 0; i < tiers; i++) {
    const width = w * (1 - i * 0.1) - (i % 2 ? 4 : 0);
    const x = side === "left" ? innerX - width : innerX;
    const y = base - th * (i + 1);
    parts.push(`M${x},${y + th} h${width} v-${th} h-${width} Z`);
  }
  const fw = w * 0.14;
  const fx = side === "left" ? innerX - fw : innerX;
  parts.push(`M${fx},${base - h} h${fw} v-14 h-${fw} Z`);
  return parts.join(" ");
}

function meru(cx: number, base: number, tiers: number, w: number) {
  const parts: string[] = [];
  let y = base;
  let width = w;
  parts.push(`M${cx - w * 0.28},${base} h${w * 0.56} v-${w * 0.35} h-${w * 0.56} Z`);
  y -= w * 0.35;
  for (let i = 0; i < tiers; i++) {
    const roofH = width * 0.22;
    parts.push(`M${cx - width / 2},${y} L${cx + width / 2},${y} L${cx + width * 0.3},${y - roofH} L${cx - width * 0.3},${y - roofH} Z`);
    y -= roofH + 3;
    width *= 0.82;
    parts.push(`M${cx - width * 0.22},${y + 3} h${width * 0.44} v-3 h-${width * 0.44} Z`);
  }
  parts.push(`M${cx - 1.5},${y} h3 v-10 h-3 Z`);
  return parts.join(" ");
}

export function TempleCover({
  variant = "emerald",
  className,
  image,
  alt = "",
  children,
}: {
  variant?: CoverVariant;
  className?: string;
  image?: string;
  alt?: string;
  children?: React.ReactNode;
}) {
  const p = palettes[variant];
  if (image) {
    return (
      <div className={cn("relative overflow-hidden bg-stone-200", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt={alt} className="h-full w-full object-cover" />
        {children}
      </div>
    );
  }
  const id = `g-${variant}`;
  return (
    <div className={cn("relative overflow-hidden", className)} role={alt ? "img" : undefined} aria-label={alt || undefined}>
      <svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={p.from} />
            <stop offset="1" stopColor={p.to} />
          </linearGradient>
          <radialGradient id={`${id}-sun`} cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor={p.sun} stopOpacity=".95" />
            <stop offset="1" stopColor={p.sun} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="400" height="220" fill={`url(#${id})`} />
        <circle cx="200" cy="96" r="70" fill={`url(#${id}-sun)`} opacity=".55" />
        <circle cx="200" cy="96" r="26" fill={p.sun} opacity=".9" />
        {/* far hills */}
        <path d="M0 170 Q60 140 120 160 T240 150 T400 158 V220 H0 Z" fill={p.far} opacity=".7" />
        {/* meru towers */}
        <path d={meru(66, 196, 5, 54)} fill={p.silhouette} opacity=".75" />
        <path d={meru(338, 196, 3, 46)} fill={p.silhouette} opacity=".75" />
        {/* candi bentar */}
        <path d={gateHalf(184, 204, 66, 118, "left")} fill={p.silhouette} />
        <path d={gateHalf(216, 204, 66, 118, "right")} fill={p.silhouette} />
        <rect x="0" y="202" width="400" height="18" fill={p.silhouette} />
        {/* steps */}
        <rect x="176" y="198" width="48" height="5" fill={p.silhouette} />
        <rect x="182" y="193" width="36" height="5" fill={p.silhouette} opacity=".9" />
      </svg>
      {children}
    </div>
  );
}
