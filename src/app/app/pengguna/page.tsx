"use client";
import { useState } from "react";
import { Check, Mail, Minus, UserPlus, UserX } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { Avatar } from "@/components/app/app-shell";
import { useCan, useWorkspace } from "@/components/app/hooks";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Field, Input, Select } from "@/components/ui/field";
import { useStore } from "@/lib/store";
import { ALL_PERMISSIONS, ALL_ROLES, PERMISSION_LABEL, ROLE_DESC, ROLE_LABEL, ROLE_TONE, can as roleCan } from "@/lib/permissions";
import { cn } from "@/lib/format";
import type { Role } from "@/lib/types";

const schema = z.object({ name: z.string().trim().min(3, "Isi nama"), email: z.string().trim().email("Email belum benar"), role: z.enum(["ketua", "bendahara", "sekretaris", "auditor"]) });

export default function UsersPage() {
  const ws = useWorkspace();
  const can = useCan();
  const me = useStore((s) => s.session?.userId);
  const invite = useStore((s) => s.inviteMember);
  const changeRole = useStore((s) => s.changeMemberRole);
  const remove = useStore((s) => s.removeMember);
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [roleChange, setRoleChange] = useState<{ id: string; role: Role } | null>(null);
  const manage = can("users.manage");
  const { register, handleSubmit, formState, reset } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { role: "bendahara" } });

  return (
    <div>
      <PageHeader title="Pengurus & Peran" description="Atur siapa yang dapat mencatat, menyetujui, dan memeriksa keuangan pura." actions={manage && <Button onClick={() => { reset({ name: "", email: "", role: "bendahara" }); setOpen(true); }}><UserPlus className="h-4 w-4" /> Undang pengurus</Button>} />
      <Card>
        <ul className="divide-y divide-line">
          {ws.memberships.map((m) => {
            const u = ws.users.find((x) => x.id === m.userId);
            if (!u) return null;
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 p-4">
                <Avatar name={u.name} color={u.avatarColor} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{u.name} {u.id === me && <span className="text-sm font-medium text-muted">(Anda)</span>}</p>
                  <p className="flex items-center gap-1.5 text-sm text-muted"><Mail className="h-3.5 w-3.5" /> {u.email}</p>
                </div>
                {m.status === "invited" && <Badge tone="amber">Undangan terkirim</Badge>}
                {manage && m.role !== "platform" && u.id !== me ? (
                  <Select aria-label={`Peran ${u.name}`} className="h-10 w-48 text-sm" value={m.role} onChange={(e) => setRoleChange({ id: m.id, role: e.target.value as Role })}>
                    {ALL_ROLES.filter((r) => r !== "platform").map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </Select>
                ) : (
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", ROLE_TONE[m.role])}>{ROLE_LABEL[m.role]}</span>
                )}
                {manage && u.id !== me && m.role !== "platform" && (
                  <Button variant="ghost" size="icon" className="text-expense" onClick={() => setRemoving(m.id)} aria-label={`Cabut akses ${u.name}`}><UserX className="h-5 w-5" /></Button>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="mt-6 overflow-hidden">
        <CardHeader title="Hak akses tiap peran" description="Simulasi untuk prototipe — di versi produksi, hak akses diperiksa di server." />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-ivory">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-muted">Kemampuan</th>
                {ALL_ROLES.map((r) => <th key={r} className="px-2 py-3 text-center"><span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", ROLE_TONE[r])}>{ROLE_LABEL[r]}</span></th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ALL_PERMISSIONS.map((p) => (
                <tr key={p}>
                  <td className="px-4 py-2.5">{PERMISSION_LABEL[p]}</td>
                  {ALL_ROLES.map((r) => (
                    <td key={r} className="px-2 py-2.5 text-center">
                      {roleCan(r, p) ? <Check className="mx-auto h-5 w-5 text-income" aria-label="Ya" /> : <Minus className="mx-auto h-4 w-4 text-stone-300" aria-label="Tidak" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 p-5 md:grid-cols-2">
          {ALL_ROLES.map((r) => (
            <div key={r} className="rounded-2xl bg-ivory p-4">
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", ROLE_TONE[r])}>{ROLE_LABEL[r]}</span>
              <p className="mt-2 text-sm text-muted">{ROLE_DESC[r]}</p>
            </div>
          ))}
        </div>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} title="Undang pengurus" description="Prototipe: undangan tidak benar-benar dikirim lewat email." footer={<Button size="lg" className="w-full" onClick={handleSubmit((v) => { const r = invite(v); if (!r.ok) return toast.error(r.error); toast.success(`Undangan untuk ${v.name} dibuat`); setOpen(false); })}>Kirim undangan</Button>}>
        <div className="space-y-4">
          <Field label="Nama" htmlFor="i-name" error={formState.errors.name?.message}><Input id="i-name" {...register("name")} /></Field>
          <Field label="Email" htmlFor="i-email" error={formState.errors.email?.message}><Input id="i-email" type="email" {...register("email")} /></Field>
          <Field label="Peran" htmlFor="i-role"><Select id="i-role" {...register("role")}>{(["ketua", "bendahara", "sekretaris", "auditor"] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select></Field>
        </div>
      </Dialog>
      <ConfirmDialog open={!!roleChange} onClose={() => setRoleChange(null)} title="Ubah peran?" description={roleChange && <>Peran akan diubah menjadi <strong>{ROLE_LABEL[roleChange.role]}</strong>. Hak aksesnya berubah seketika.</>} onConfirm={() => { if (roleChange) changeRole(roleChange.id, roleChange.role); setRoleChange(null); toast.success("Peran diperbarui"); }} />
      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} tone="danger" title="Cabut akses pengurus?" description="Pengguna tidak lagi dapat membuka ruang kerja pura ini. Catatan yang pernah dibuatnya tetap tersimpan." confirmLabel="Cabut akses" onConfirm={() => { if (removing) { const r = remove(removing); r.ok ? toast.success("Akses dicabut") : toast.error(r.error); } setRemoving(null); }} />
    </div>
  );
}
