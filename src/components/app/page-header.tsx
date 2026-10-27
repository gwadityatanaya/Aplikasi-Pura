import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/format";

export function PageHeader({
  title,
  description,
  actions,
  back,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div className={cn("mb-6", className)}>
      {back && (
        <Link href={back.href} className="mb-3 inline-flex items-center gap-1.5 rounded-lg py-1 text-sm font-semibold text-emerald-700 hover:underline">
          <ArrowLeft className="h-4 w-4" /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-forest md:text-[1.75rem]">{title}</h1>
          {description && <p className="mt-1 text-[15px] text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function NoAccess({ what = "halaman ini" }: { what?: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-white p-10 text-center">
      <p className="text-lg font-bold">Peran Anda belum memiliki akses ke {what}</p>
      <p className="mt-1 text-muted">Hubungi Ketua Pengempon untuk meminta akses. (Prototipe: ganti peran melalui menu profil.)</p>
    </div>
  );
}
