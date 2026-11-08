"use client";
import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/format";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "gold" | "light";
type Size = "sm" | "md" | "lg" | "xl" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-900/10",
  secondary: "bg-mint text-emerald-900 hover:bg-emerald-200",
  outline: "border border-line bg-white text-charcoal hover:bg-ivory hover:border-emerald-300",
  ghost: "text-charcoal hover:bg-black/5",
  danger: "bg-expense text-white hover:bg-red-600",
  gold: "bg-gold text-charcoal hover:bg-[#bf9b58]",
  light: "bg-white/15 text-white hover:bg-white/25 backdrop-blur",
};
const sizes: Record<Size, string> = {
  sm: "min-h-9 py-1 px-3 text-sm rounded-xl gap-1.5",
  md: "min-h-11 py-1.5 px-4 text-[0.9375rem] rounded-xl gap-2",
  lg: "min-h-12 py-2 px-5 text-base rounded-2xl gap-2",
  xl: "min-h-14 py-2 px-6 text-base rounded-2xl gap-2.5",
  icon: "h-11 w-11 rounded-xl",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, disabled, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "press inline-flex max-w-full select-none items-center justify-center text-center font-semibold leading-tight transition-colors sm:whitespace-nowrap",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "press inline-flex max-w-full select-none items-center justify-center text-center font-semibold leading-tight transition-colors sm:whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
    variants[variant],
    sizes[size],
    className
  );
}
