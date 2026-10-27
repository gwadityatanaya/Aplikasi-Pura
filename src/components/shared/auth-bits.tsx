"use client";
import { useState } from "react";
import { Eye, EyeOff, FlaskConical } from "lucide-react";
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

export function MockAuthNote() {
  return (
    <p className="flex items-start gap-2 rounded-2xl bg-gold-light/70 p-3.5 text-sm text-gold-dark ring-1 ring-gold/25">
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        <strong>Autentikasi simulasi.</strong> Ini prototipe: kata sandi tidak diperiksa maupun disimpan, dan sesi hanya ada di
        peramban ini. Versi produksi akan memakai autentikasi server yang aman.
      </span>
    </p>
  );
}
