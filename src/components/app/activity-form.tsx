"use client";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { useStore } from "@/lib/store";
import type { Activity } from "@/lib/types";

const schema = z
  .object({
    name: z.string().trim().min(3, "Isi nama kegiatan"),
    description: z.string().trim().max(400),
    startDate: z.string().min(1, "Pilih tanggal mulai"),
    endDate: z.string().min(1, "Pilih tanggal selesai"),
    budget: z.number().min(0),
    fundType: z.enum(["general", "restricted"]),
    status: z.enum(["planned", "ongoing", "done"]),
  })
  .refine((v) => v.endDate >= v.startDate, { message: "Tanggal selesai harus setelah tanggal mulai", path: ["endDate"] });

const COLORS = ["#087F6D", "#C9A86A", "#3F6FB5", "#8A5CB8", "#B5543F"];

export function ActivityForm({ open, onClose, activity }: { open: boolean; onClose: () => void; activity?: Activity }) {
  const save = useStore((s) => s.saveActivity);
  const { register, control, handleSubmit, reset, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  useEffect(() => {
    if (open)
      reset(
        activity
          ? { ...activity }
          : { name: "", description: "", startDate: "", endDate: "", budget: 0, fundType: "general", status: "planned" }
      );
  }, [open, activity, reset]);
  const onSubmit = handleSubmit(async (v) => {
    const r = await save({ ...v, id: activity?.id, color: activity?.color ?? COLORS[Math.floor(Math.random() * COLORS.length)] });
    if (!r.ok) return toast.error(r.error);
    toast.success(activity ? "Kegiatan diperbarui" : "Kegiatan dibuat");
    onClose();
  });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={activity ? "Ubah kegiatan" : "Kegiatan baru"}
      footer={<Button size="lg" className="w-full" onClick={onSubmit}>Simpan kegiatan</Button>}
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field label="Nama kegiatan" htmlFor="a-name" required error={formState.errors.name?.message}>
          <Input id="a-name" placeholder="Mis. Piodalan November 2026" {...register("name")} />
        </Field>
        <Field label="Deskripsi" htmlFor="a-desc">
          <Textarea id="a-desc" rows={2} {...register("description")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mulai" htmlFor="a-start" error={formState.errors.startDate?.message}><Input id="a-start" type="date" {...register("startDate")} /></Field>
          <Field label="Selesai" htmlFor="a-end" error={formState.errors.endDate?.message}><Input id="a-end" type="date" {...register("endDate")} /></Field>
        </div>
        <Field label="Anggaran (opsional)">
          <Controller control={control} name="budget" render={({ field }) => <MoneyInput value={field.value ?? 0} onChange={field.onChange} />} />
        </Field>
        <Field label="Jenis dana" htmlFor="a-fund" hint="Dana khusus hanya boleh dipakai untuk kegiatan ini (mis. punia pembangunan).">
          <Select id="a-fund" {...register("fundType")}>
            <option value="general">Dana umum</option>
            <option value="restricted">Dana khusus (terikat)</option>
          </Select>
        </Field>
        <Field label="Status" htmlFor="a-status">
          <Select id="a-status" {...register("status")}>
            <option value="planned">Direncanakan</option>
            <option value="ongoing">Berjalan</option>
            <option value="done">Selesai</option>
          </Select>
        </Field>
      </form>
    </Dialog>
  );
}
