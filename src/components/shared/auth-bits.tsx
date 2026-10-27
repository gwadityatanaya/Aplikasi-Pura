"use client";
import { useState } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/field";
import * as React from "react";

export const PasswordInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function PasswordInput(props, ref) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input ref={ref} type={show ? "text" : "password"} className="pr-12" {...props} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-1.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-stone-100"
        aria-label={show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
      >
        {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
});

/** Same rule as the server: at least 8 characters with letters and numbers. */
export function passwordHint(pw: string) {
  const score = (pw.length >= 8 ? 1 : 0) + (/\d/.test(pw) && /[A-Za-z]/.test(pw) ? 1 : 0) + (pw.length >= 12 ? 1 : 0) + (/[^\w]/.test(pw) || /[A-Z]/.test(pw) ? 1 : 0);
  return score;
}

export function StrengthBar({ password }: { password: string }) {
  const s = passwordHint(password);
  return (
    <div className="flex gap-1.5" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className={`h-1.5 flex-1 rounded-full ${i < s ? (s < 2 ? "bg-expense" : s < 3 ? "bg-gold" : "bg-emerald-600") : "bg-stone-200"}`} />
      ))}
    </div>
  );
}

export function SecureNote() {
  return (
    <p className="flex items-start gap-2 rounded-2xl bg-mint/60 p-3.5 text-sm text-emerald-900">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
      <span>Kata sandi disimpan dalam bentuk terenkripsi (hash) dan tidak dapat dilihat siapa pun, termasuk Admin Utama.</span>
    </p>
  );
}
