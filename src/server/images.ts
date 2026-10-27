import "server-only";
import { db, schema, type Tx } from "./db";
import { ApiError } from "./http";
import { uid } from "@/lib/format";
import { createHash } from "crypto";

/** SHA-256 of the decoded image bytes — used to spot the same proof uploaded twice. */
export function imageHash(dataUrl: string | null | undefined) {
  const m = dataUrl ? /^data:image\/[a-z+]+;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl) : null;
  return m ? createHash("sha256").update(Buffer.from(m[1], "base64")).digest("hex") : null;
}

const ALLOWED: Record<string, (b: Buffer) => boolean> = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8,
  "image/png": (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  "image/webp": (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP",
};
const MAX_BYTES = 2_500_000;

/**
 * Turns an uploaded image (data URL) into a stored attachment and returns its URL.
 * Existing attachment URLs are kept; anything else becomes undefined. SVG is never accepted.
 */
export async function persistImage(
  value: string | null | undefined,
  opts: { templeId: string | null; isPublic: boolean; userId: string | null },
  tx?: Tx
): Promise<string | null> {
  if (!value) return null;
  if (value.startsWith("/api/attachments/")) return value;
  const m = /^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!m) throw new ApiError(400, "Format gambar tidak didukung. Gunakan JPG, PNG atau WEBP.");
  const mime = m[1];
  const buf = Buffer.from(m[2], "base64");
  if (!ALLOWED[mime] || !ALLOWED[mime](buf)) throw new ApiError(400, "Format gambar tidak didukung. Gunakan JPG, PNG atau WEBP.");
  if (buf.length > MAX_BYTES) throw new ApiError(413, "Ukuran gambar terlalu besar (maks. 2,5 MB).");
  const id = uid("img");
  await (tx ?? db).insert(schema.attachments).values({ id, templeId: opts.templeId, mime, data: buf, size: buf.length, isPublic: opts.isPublic, createdBy: opts.userId });
  return `/api/attachments/${id}`;
}
