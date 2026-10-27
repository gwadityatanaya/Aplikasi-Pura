"use client";
import { useState } from "react";
import { initials } from "@/lib/format";
import type { User } from "@/lib/types";

/** Profile photo URL (members only; the server checks who may see it), or undefined → initials. */
export const avatarSrc = (u: Pick<User, "id" | "avatarVersion"> | undefined) => (u?.avatarVersion ? `/api/avatar/${u.id}?v=${encodeURIComponent(u.avatarVersion)}` : undefined);

export function Avatar({ name, color, size = 40, src }: { name: string; color?: string; size?: number; src?: string }) {
  const [failed, setFailed] = useState<string | undefined>();
  if (src && failed !== src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} onError={() => setFailed(src)} className="shrink-0 rounded-full bg-stone-100 object-cover" style={{ width: size, height: size }} aria-hidden />;
  return (
    <span className="grid shrink-0 place-items-center rounded-full font-bold text-white" style={{ background: color ?? "#087F6D", width: size, height: size, fontSize: size * 0.36 }} aria-hidden>
      {initials(name)}
    </span>
  );
}
