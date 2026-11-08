import "server-only";
import { eq } from "drizzle-orm";
import { schema as T, type Tx } from "./db";
import { ApiError } from "./http";
import { verificationProgress } from "@/lib/verification";

/**
 * Activating a temple before its verification checklist is 4/4 is allowed, but only with a reason
 * (decision Phase 3.4). Returns the sentence to write in the Log, or "" when the checklist is
 * complete; throws when the reason is missing.
 */
export async function earlyActivationNote(tx: Tx, templeId: string, reason: string | undefined) {
  const [v] = await tx.select().from(T.templeVerifications).where(eq(T.templeVerifications.templeId, templeId));
  const pr = verificationProgress(v);
  if (pr.done >= pr.total) return "";
  const r = (reason ?? "").trim();
  if (r.length < 5) throw new ApiError(400, `Checklist verifikasi baru ${pr.done}/${pr.total}. Tulis alasan (minimal 5 huruf) untuk mengaktifkan pura ini sekarang.`);
  return `Diaktifkan sebelum checklist verifikasi lengkap (${pr.done}/${pr.total}). Alasan: ${r}`;
}
