"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, Check, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ImageUpload } from "@/components/ui/file-upload";
import { useStore, useCurrentUser } from "@/lib/store";
import { ROLE_DESC, ROLE_LABEL } from "@/lib/permissions";
import { cn } from "@/lib/format";
import type { Role } from "@/lib/types";

const PROVINCES = ["Bali", "Nusa Tenggara Barat", "Jawa Timur", "Jawa Tengah", "DI Yogyakarta", "Jawa Barat", "DKI Jakarta", "Banten", "Lampung", "Sulawesi Tengah", "Sulawesi Selatan", "Kalimantan Timur", "Lainnya"];
const REGENCY_HINTS: Record<string, string[]> = {
  "Nusa Tenggara Barat": ["Kota Mataram", "Lombok Barat", "Lombok Utara", "Lombok Tengah", "Lombok Timur", "Sumbawa"],
  Bali: ["Kota Denpasar", "Badung", "Gianyar", "Tabanan", "Buleleng", "Karangasem", "Klungkung", "Bangli", "Jembrana"],
};

const schema = z.object({
  name: z.string().trim().min(4, "Tulis nama pura, mis. Pura Dalem …"),
  description: z.string().trim().min(20, "Ceritakan singkat tentang pura (min. 20 huruf)").max(600),
  province: z.string().min(1, "Pilih provinsi"),
  regency: z.string().trim().min(3, "Isi kabupaten/kota"),
  district: z.string().trim().min(3, "Isi kecamatan"),
  village: z.string().trim().min(3, "Isi desa/kelurahan"),
  address: z.string().trim().min(8, "Isi alamat lengkap"),
  phone: z.string().trim().regex(/^[0-9+\-\s]{8,16}$/, "Nomor telepon belum benar"),
  photo: z.string().optional(),
  role: z.enum(["ketua", "bendahara", "sekretaris", "auditor"]),
});
type V = z.infer<typeof schema>;

const STEPS = [
  { title: "Identitas pura", fields: ["name", "description"] as const },
  { title: "Lokasi", fields: ["province", "regency", "district", "village", "address"] as const },
  { title: "Kontak & peran", fields: ["phone", "role"] as const },
];

export default function OnboardingPage() {
  const router = useRouter();
  const hydrated = useStore((s) => s.hydrated);
  const user = useCurrentUser();
  const createTemple = useStore((s) => s.createTemple);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const { register, handleSubmit, formState, trigger, watch, setValue } = useForm<V>({
    resolver: zodResolver(schema),
    defaultValues: { province: "Nusa Tenggara Barat", role: "ketua" },
  });
  useEffect(() => {
    if (hydrated && !user) router.replace("/masuk");
  }, [hydrated, user, router]);

  const province = watch("province");
  const role = watch("role");
  const photo = watch("photo");

  async function next() {
    const ok = await trigger(STEPS[step].fields as unknown as (keyof V)[]);
    if (ok) setStep((s) => s + 1);
  }

  const onSubmit = handleSubmit(async (v) => {
    await new Promise((r) => setTimeout(r, 700));
    createTemple(
      { name: v.name, description: v.description, province: v.province, regency: v.regency, district: v.district, village: v.village, address: v.address, phone: v.phone, photo: v.photo },
      v.role as Role
    );
    setDone(true);
    toast.success("Ruang kerja pura berhasil dibuat");
  });

  if (done)
    return (
      <div className="text-center">
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", bounce: 0.5 }} className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-mint text-emerald-700">
          <PartyPopper className="h-10 w-10" />
        </motion.div>
        <h1 className="mt-5 text-3xl font-extrabold text-forest">Pura Anda siap!</h1>
        <p className="mt-2 text-[17px] text-muted">Ruang kerja keuangan terpisah sudah dibuat, lengkap dengan kategori dan kas tunai.</p>
        <Button size="xl" className="mt-7 w-full" onClick={() => router.push("/app")}>Buka Dashboard</Button>
      </div>
    );

  return (
    <div>
      <p className="text-sm font-bold uppercase tracking-wider text-gold-dark">Langkah 2 dari 2 · Daftarkan pura</p>
      <h1 className="mt-1 text-3xl font-extrabold text-forest">{STEPS[step].title}</h1>
      <ol className="mt-5 flex gap-2" aria-label="Kemajuan">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex-1">
            <span className={cn("block h-2 rounded-full transition-colors", i <= step ? "bg-emerald-600" : "bg-stone-200")} />
            <span className={cn("mt-1.5 block text-xs font-semibold", i === step ? "text-emerald-800" : "text-muted")}>
              {i < step ? <Check className="mr-1 inline h-3 w-3" /> : null}
              {s.title}
            </span>
          </li>
        ))}
      </ol>
      <form className="mt-6" onSubmit={onSubmit} noValidate>
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-4">
            {step === 0 && (
              <>
                <Field label="Nama pura" htmlFor="name" required error={formState.errors.name?.message}>
                  <Input id="name" placeholder="Pura Dalem …" {...register("name")} />
                </Field>
                <Field label="Deskripsi singkat" htmlFor="description" required error={formState.errors.description?.message} hint="Akan tampil di halaman publik pura.">
                  <Textarea id="description" rows={4} {...register("description")} />
                </Field>
                <Field label="Foto atau logo pura (opsional)">
                  <ImageUpload value={photo} onChange={(v) => setValue("photo", v)} label="Foto pura" />
                </Field>
              </>
            )}
            {step === 1 && (
              <>
                <Field label="Provinsi" htmlFor="province" required error={formState.errors.province?.message}>
                  <Select id="province" {...register("province")}>
                    {PROVINCES.map((p) => <option key={p}>{p}</option>)}
                  </Select>
                </Field>
                <Field label="Kabupaten / Kota" htmlFor="regency" required error={formState.errors.regency?.message}>
                  <Input id="regency" list="regency-list" {...register("regency")} />
                  <datalist id="regency-list">{(REGENCY_HINTS[province] ?? []).map((r) => <option key={r} value={r} />)}</datalist>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Kecamatan" htmlFor="district" required error={formState.errors.district?.message}>
                    <Input id="district" {...register("district")} />
                  </Field>
                  <Field label="Desa / Kelurahan" htmlFor="village" required error={formState.errors.village?.message}>
                    <Input id="village" {...register("village")} />
                  </Field>
                </div>
                <Field label="Alamat lengkap" htmlFor="address" required error={formState.errors.address?.message}>
                  <Textarea id="address" rows={2} {...register("address")} />
                </Field>
              </>
            )}
            {step === 2 && (
              <>
                <Field label="Telepon / WhatsApp pura" htmlFor="phone" required error={formState.errors.phone?.message}>
                  <Input id="phone" inputMode="tel" placeholder="0812-…" {...register("phone")} />
                </Field>
                <Field label="Peran Anda di pura" required>
                  <div role="radiogroup" className="grid gap-2">
                    {(["ketua", "bendahara", "sekretaris", "auditor"] as Role[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        role="radio"
                        aria-checked={role === r}
                        onClick={() => setValue("role", r as V["role"])}
                        className={cn("press rounded-2xl border p-3.5 text-left", role === r ? "border-emerald-500 bg-mint/50 ring-2 ring-emerald-500/20" : "border-line bg-white")}
                      >
                        <span className="block font-semibold">{ROLE_LABEL[r]}</span>
                        <span className="block text-sm text-muted">{ROLE_DESC[r]}</span>
                      </button>
                    ))}
                  </div>
                </Field>
              </>
            )}
          </motion.div>
        </AnimatePresence>
        <div className="mt-7 flex gap-3">
          {step > 0 && (
            <Button type="button" variant="outline" size="xl" onClick={() => setStep((s) => s - 1)} aria-label="Kembali">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button type="button" size="xl" className="flex-1" onClick={next}>Lanjut</Button>
          ) : (
            <Button type="submit" size="xl" className="flex-1" loading={formState.isSubmitting}>Buat Ruang Kerja Pura</Button>
          )}
        </div>
      </form>
    </div>
  );
}
