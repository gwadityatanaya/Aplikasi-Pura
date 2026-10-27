"use client";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useStore } from "@/lib/store";

const schema = z.object({ email: z.string().trim().email("Format email belum benar") });

export default function ForgotPage() {
  const request = useStore((s) => s.requestPasswordReset);
  const [sent, setSent] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  if (sent)
    return (
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-mint text-emerald-700"><MailCheck className="h-8 w-8" /></div>
        <h1 className="mt-5 text-2xl font-extrabold text-forest">Permintaan terkirim</h1>
        <p className="mt-2 text-[17px] text-muted">
          Jika <strong>{sent}</strong> terdaftar, Admin Utama akan melihat permintaan Anda dan mengirimkan <strong>tautan atur ulang</strong> (biasanya lewat WhatsApp). Tautan hanya bisa dipakai sekali.
        </p>
        <Link href="/masuk" className="mt-6 inline-block font-semibold text-emerald-700 hover:underline">Kembali ke halaman masuk</Link>
      </div>
    );

  return (
    <div>
      <h1 className="text-3xl font-extrabold text-forest">Lupa Kata Sandi</h1>
      <p className="mt-2 text-[17px] text-muted">Tulis email akun Anda. Admin Utama akan menerima permintaan ini dan mengirimkan tautan untuk membuat kata sandi baru.</p>
      <form
        className="mt-7 space-y-4"
        noValidate
        onSubmit={handleSubmit(async (v) => {
          const r = await request(v.email);
          if (r.ok) setSent(v.email);
          else toast.error(r.error);
        })}
      >
        <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
        </Field>
        <Button type="submit" size="xl" className="w-full" loading={formState.isSubmitting}>Kirim Permintaan</Button>
      </form>
      <p className="mt-6 text-center text-[15px]"><Link href="/masuk" className="font-semibold text-emerald-700 hover:underline">Kembali ke halaman masuk</Link></p>
    </div>
  );
}
