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

/** Width × height read from the file header (JPEG, PNG, WEBP), or null when it cannot be read. */
export function imageSize(b: Buffer): { w: number; h: number } | null {
  if (b[0] === 0x89 && b[1] === 0x50) return b.length >= 24 ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : null;
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 9 < b.length; ) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      i += 2 + len;
    }
    return null;
  }
  if (b.subarray(0, 4).toString() === "RIFF" && b.length >= 30) {
    const kind = b.subarray(12, 16).toString();
    if (kind === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (kind === "VP8L") {
      const v = b.readUInt32LE(21);
      return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 };
    }
    if (kind === "VP8X") return { w: b.readUIntLE(24, 3) + 1, h: b.readUIntLE(27, 3) + 1 };
  }
  return null;
}

/** Profile photos are resized on the device to about 256×256 / 50 KB; the server checks it again. */
export const AVATAR_MAX_BYTES = 80_000;
export const AVATAR_MAX_SIDE = 512;

/** Decodes a data URL and checks that it really is a JPG, PNG or WEBP (by its first bytes). */
export function decodeImage(value: string, what = "Foto") {
  const m = /^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!m) throw new ApiError(400, `${what} harus berupa gambar JPG, PNG atau WEBP.`);
  const mime = m[1];
  const buf = Buffer.from(m[2], "base64");
  if (!ALLOWED[mime] || !ALLOWED[mime](buf)) throw new ApiError(400, `${what} harus berupa gambar JPG, PNG atau WEBP.`);
  return { mime, buf };
}

export function checkAvatar(value: string) {
  const { mime, buf } = decodeImage(value);
  if (buf.length > AVATAR_MAX_BYTES) throw new ApiError(413, "Ukuran foto terlalu besar. Pilih ulang fotonya agar diperkecil otomatis.");
  const size = imageSize(buf);
  if (!size || size.w > AVATAR_MAX_SIDE || size.h > AVATAR_MAX_SIDE || Math.abs(size.w - size.h) > 2)
    throw new ApiError(400, "Foto profil harus persegi dan paling besar 512×512 piksel.");
  return { mime, buf };
}
