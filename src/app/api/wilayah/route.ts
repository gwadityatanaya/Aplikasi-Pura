import { wilayahChildren, wilayahMeta } from "@/server/wilayah";
import { ApiError, json, route } from "@/server/http";

export const dynamic = "force-dynamic";

/**
 * Public list of regions under one parent, for the address dropdowns:
 *   /api/wilayah            → provinsi
 *   /api/wilayah?induk=51   → kabupaten/kota di Bali, and so on.
 * Served from the bundled data file; cached by the browser and Vercel for a day.
 */
export const GET = route(async (req: Request) => {
  const induk = new URL(req.url).searchParams.get("induk") ?? "";
  if (induk && !/^\d{2}(\.\d{2}){0,2}$/.test(induk)) throw new ApiError(400, "Kode induk tidak sah.");
  const res = json({ ok: true, items: wilayahChildren(induk), versi: wilayahMeta().generatedAt });
  res.headers.set("Cache-Control", "public, max-age=86400, s-maxage=604800");
  return res;
});
