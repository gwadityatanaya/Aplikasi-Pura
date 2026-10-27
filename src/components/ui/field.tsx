"use client";
import * as React from "react";
import { cn } from "@/lib/format";
import { ChevronDown } from "lucide-react";

const base =
  "w-full rounded-xl border border-line bg-white px-4 text-[16px] text-charcoal placeholder:text-stone-400 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/15 disabled:bg-stone-50 aria-[invalid=true]:border-expense aria-[invalid=true]:ring-expense/10";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref
) {
  return <input ref={ref} className={cn(base, "h-12", className)} {...props} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(base, "min-h-[96px] py-3 leading-relaxed", className)} {...props} />;
  }
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(base, "h-12 appearance-none pr-10", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  );
});

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-[15px] font-semibold text-charcoal">
        {label}
        {required && <span className="ml-0.5 text-expense" aria-hidden>*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-sm font-medium text-expense" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
