import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { getCurrent } from "@/server/auth";
import { canSeeAvatar } from "@/server/context";

export const dynamic = "force-dynamic";

/** Profile photo — only for the owner, Admin Utama and related Pengurus Pura / Pengurus Banjar. */
export async function GET(_req: Request, { params }: { params: { userId: string } }) {
  const cur = await getCurrent();
  if (!cur) return new Response("Masuk terlebih dahulu", { status: 401 });
  const [owner] = await db.select().from(schema.users).where(eq(schema.users.id, params.userId));
  if (!owner?.avatarId || owner.status === "deleted") return new Response("Tidak ditemukan", { status: 404 });
  if (!(await canSeeAvatar(cur.user, owner))) return new Response("Tidak diizinkan", { status: 403 });
  const [a] = await db.select().from(schema.attachments).where(eq(schema.attachments.id, owner.avatarId));
  if (!a) return new Response("Tidak ditemukan", { status: 404 });
  return new Response(new Uint8Array(a.data), {
    headers: {
      "Content-Type": a.mime,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
