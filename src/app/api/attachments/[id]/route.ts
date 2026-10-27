import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { getCurrent } from "@/server/auth";
import { roleFor } from "@/server/context";

export const dynamic = "force-dynamic";

/** Serves uploaded images. Receipts and evidence require a signed-in member of the same temple (or the uploader). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const [a] = await db.select().from(schema.attachments).where(eq(schema.attachments.id, params.id));
  if (!a) return new Response("Tidak ditemukan", { status: 404 });
  if (!a.isPublic) {
    const cur = await getCurrent();
    const own = !!cur && a.createdBy === cur.user.id;
    const role = cur && !own ? await roleFor(cur.user, a.templeId) : undefined;
    if (!own && !role) return new Response("Tidak diizinkan", { status: 403 });
  }
  return new Response(new Uint8Array(a.data), {
    headers: {
      "Content-Type": a.mime,
      "Cache-Control": a.isPublic ? "public, max-age=31536000, immutable" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
