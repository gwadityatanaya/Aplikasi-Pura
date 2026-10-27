"use client";
import Link from "next/link";
import { AlertTriangle, Check, Mail, Minus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Avatar, avatarSrc } from "@/components/app/app-shell";
import { useWorkspace } from "@/components/app/hooks";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { useAccess, useStore } from "@/lib/store";
import { ALL_PERMISSIONS, ALL_ROLES, PERMISSION_LABEL, ROLE_DESC, ROLE_LABEL, ROLE_TONE, can as roleCan, positionName } from "@/lib/permissions";
import { cn } from "@/lib/format";
import type { Role } from "@/lib/types";

/** Read-only: who looks after this temple. Roles are assigned by Admin Utama in the Back Office. */
export default function PengurusPage() {
  const ws = useWorkspace();
  const access = useAccess();
  const me = useStore((s) => s.session?.userId);
  const banjars = useStore((s) => s.data.banjars);
  const templeBanjars = ws.temple?.banjarIds ?? [];
  const rows: { key: string; userId: string; role: Role; note?: string; jabatan?: string }[] = [
    ...ws.memberships.map((m) => ({ key: m.id, userId: m.userId, role: m.role as Role, jabatan: positionName(m.position, m.positionTitle) })),
    ...ws.data.banjarMembers.filter((b) => templeBanjars.includes(b.banjarId) && b.status === "active").map((b) => ({ key: b.id, userId: b.userId, role: "banjar" as Role, note: banjars.find((x) => x.id === b.banjarId)?.name, jabatan: positionName(b.position, b.positionTitle) })),
  ];
  const pengurusCount = ws.memberships.filter((m) => m.role === "pengurus" && m.status === "active").length;

  return (
    <div>
      <PageHeader
        title="Pengurus Pura"
        description="Siapa yang mengelola dan memverifikasi punia di pura ini."
        actions={access.isSuperAdmin && <Link href="/app/admin" className={buttonClass("primary")}>Atur di Back Office</Link>}
      />
      {pengurusCount === 0 && (
        <p className="mb-4 flex items-start gap-2 rounded-2xl bg-amber-50 p-4 text-[15px] text-amber-900"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /> Pengurus pura belum terdaftar. Punia di pura ini diverifikasi oleh Pengurus Banjar.</p>
      )}
      {pengurusCount === 1 && (
        <p className="mb-4 flex items-start gap-2 rounded-2xl bg-amber-50 p-4 text-[15px] text-amber-900"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /> Pura ini hanya punya satu pengurus. Punia yang dikirim pengurus itu sendiri harus disetujui Pengurus Banjar.</p>
      )}
      <Card>
        <ul className="divide-y divide-line">
          {rows.map((r) => {
            const u = ws.users.find((x) => x.id === r.userId);
            if (!u) return null;
            return (
              <li key={r.key} className="flex flex-wrap items-center gap-3 p-4">
                <Avatar name={u.name} color={u.avatarColor} src={avatarSrc(u)} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{u.name} {u.id === me && <span className="text-sm font-medium text-muted">(Anda)</span>}</p>
                  <p className="flex items-center gap-1.5 text-sm text-muted"><Mail className="h-3.5 w-3.5" /> {u.email}</p>
                  {r.jabatan && <p className="text-sm font-semibold text-emerald-800">Jabatan: {r.jabatan}</p>}
                </div>
                {u.status === "disabled" && <Badge tone="red">Nonaktif</Badge>}
                <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", ROLE_TONE[r.role])}>{ROLE_LABEL[r.role]}{r.note ? ` · ${r.note}` : ""}</span>
              </li>
            );
          })}
        </ul>
        {!rows.length && <p className="p-6 text-muted">Belum ada pengurus terdaftar.</p>}
      </Card>
      <p className="mt-3 text-sm text-muted">Untuk menambah atau mencabut pengurus, atau mengubah jabatan (Ketua, Sekretaris, Bendahara), hubungi Admin Utama. Pengurus baru cukup masuk dengan Google atau tautan email memakai alamat yang didaftarkan.</p>

      <Card className="mt-6 overflow-hidden">
        <CardHeader title="Hak akses tiap peran" />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
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
                    <td key={r} className="px-2 py-2.5 text-center">{roleCan(r, p) ? <Check className="mx-auto h-5 w-5 text-income" aria-label="Ya" /> : <Minus className="mx-auto h-4 w-4 text-stone-300" aria-label="Tidak" />}</td>
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
    </div>
  );
}
