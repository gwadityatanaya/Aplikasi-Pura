import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { getCurrent } from "@/server/auth";

export const dynamic = "force-dynamic";

/** Image attached to a help message — only for the person who sent it and Admin Utama. */
export async function GET(_req: Request, { params }: { params: { ticketId: string } }) {
  const cur = await getCurrent();
  if (!cur) return new Response("Masuk terlebih dahulu", { status: 401 });
  const [t] = await db.select().from(schema.helpTickets).where(eq(schema.helpTickets.id, params.ticketId));
  if (!t || (t.userId !== cur.user.id && !cur.user.isSuperAdmin)) return new Response("Tidak ditemukan", { status: 404 });
  if (!t.attachmentId) return new Response("Lampiran sudah dihapus", { status: 410 });
  const [a] = await db.select().from(schema.attachments).where(eq(schema.attachments.id, t.attachmentId));
  if (!a) return new Response("Lampiran sudah dihapus", { status: 410 });
  return new Response(new Uint8Array(a.data), {
    headers: { "Content-Type": a.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'" },
  });
}
