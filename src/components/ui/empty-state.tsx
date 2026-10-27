import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/format";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-mint text-emerald-700">
        <Icon className="h-8 w-8" aria-hidden />
      </div>
      <h3 className="text-lg font-bold text-charcoal">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-[15px] text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
