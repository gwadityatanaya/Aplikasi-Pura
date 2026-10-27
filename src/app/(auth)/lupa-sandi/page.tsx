"use client";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useStore } from "@/lib/store";

const schema = z.object({ email: z.string().trim().email("Format email belum benar") });

export default function ForgotPage() {
  const request = useStore((s) => s.requestPasswordReset);
  const [sent, setSent] = useState<{ email: string; token: string } | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  if (sent)
    return (
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-mint text-emerald-700"><MailCheck className="h-8 w-8" /></div>
        <h1 className="mt-5 text-2xl font-extrabold text-forest">Periksa email Anda</h1>
        <p className="mt-2 text-[17px] text-muted">Jika <strong>{sent.email}</strong> terdaftar, kami mengirim tautan untuk mengatur ulang kata sandi.</p>
        {sent.token ? (
          <div className="mt-6 rounded-2xl border border-dashed border-gold bg-gold-light/50 p-4 text-left text-sm text-gold-dark">
            <p className="font-bold">Prototipe: email tidak benar-benar dikirim.</p>
            <p className="mt-1">Gunakan tautan simulasi berikut:</p>
            <Link href={`/atur-ulang-sandi?token=${sent.token}`} className={buttonClass("gold", "md", "mt-3 w-full")}>Buka tautan atur ulang</Link>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">(Prototipe: email ini tidak terdaftar, jadi tidak ada tautan yang dibuat.)</p>
        )}
        <Link href="/masuk" className="mt-6 inline-block font-semibold text-emerald-700 hover:underline">Kembali ke halaman masuk</Link>
      </div>
    );

  return (
    <div>
      <h1 className="text-3xl font-extrabold text-forest">Lupa Kata Sandi</h1>
      <p className="mt-2 text-[17px] text-muted">Masukkan email akun Anda. Kami akan mengirim tautan untuk membuat kata sandi baru.</p>
      <form
        className="mt-7 space-y-4"
        noValidate
        onSubmit={handleSubmit(async (v) => {
          await new Promise((r) => setTimeout(r, 500));
          const r = request(v.email);
          if (r.ok) setSent({ email: v.email, token: r.value });
        })}
      >
        <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" placeholder="made@pura.demo" {...register("email")} aria-invalid={!!formState.errors.email} />
        </Field>
        <Button type="submit" size="xl" className="w-full" loading={formState.isSubmitting}>Kirim Tautan</Button>
      </form>
      <p className="mt-6 text-center text-[15px]"><Link href="/masuk" className="font-semibold text-emerald-700 hover:underline">Kembali ke halaman masuk</Link></p>
    </div>
  );
}
