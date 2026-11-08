import "server-only";
import { eq } from "drizzle-orm";
import { schema as T, type Tx } from "./db";
import { ApiError } from "./http";
import { formatDate } from "@/lib/format";

/** The cut-off date of the old books: nothing in the app may be dated before it. */
export async function assertNotBeforeStart(tx: Tx, templeId: string, date: string, what = "Tanggal transaksi") {
  const [t] = await tx.select({ start: T.temples.booksStartDate }).from(T.temples).where(eq(T.temples.id, templeId));
  if (t?.start && date < t.start)
    throw new ApiError(409, `${what} (${formatDate(date)}) sebelum tanggal mulai pembukuan (${formatDate(t.start)}). Catatan itu termasuk buku lama dan sudah ada di saldo awal.`);
}
