import "server-only";
import { z } from "zod";
import { and, eq, lt, lte, sql } from "drizzle-orm";
import { db, schema as T, type Tx } from "./db";
import { ApiError, todayInAppTz } from "./http";
import { requirePerm, requireTemple } from "./context";
import { id, isoDate, log, one, optText, text, type Handler } from "./commands";
import * as m from "./map";
import { accountBalance } from "@/lib/ledger";
import { formatDate, rupiah, uid } from "@/lib/format";

/** Two different people who counted together (names typed or picked from the pengurus). */
const witnesses = z
  .array(text(120).min(3, "Tulis nama lengkap saksi"))
  .length(2, "Isi dua orang saksi")
  .refine((w) => w.length !== 2 || w[0].toLowerCase() !== w[1].toLowerCase(), "Dua saksi harus orang yang berbeda")
  .transform((w) => w.join(" & "));

const money = z.number().int().min(0).max(1e13);

export const booksCommands: Record<string, Handler> = {
  /**
   * "Mulai memakai aplikasi": the start date and the opening balance of every active cash box and
   * bank account on that date, counted together by two pengurus. Done once; afterwards the opening
   * balances are locked (database trigger) and only an opening-balance correction can move them.
   */
  async startBooks(ctx, p) {
    const templeId = requireTemple(ctx);
    await requirePerm(ctx, "settings.manage", "memulai pembukuan");
    const i = z
      .object({ startDate: isoDate, balances: z.array(z.object({ accountId: id, amount: money })).min(1), witnesses })
      .parse(p);
    if (i.startDate > todayInAppTz()) throw new ApiError(400, "Tanggal mulai tidak boleh di masa depan.");
    return db.transaction(async (tx) => {
      const t = await one(tx.select().from(T.temples).where(eq(T.temples.id, templeId)).for("update"), "Pura tidak ditemukan.");
      if (t.booksStartDate) throw new ApiError(409, `Pembukuan sudah dimulai pada ${formatDate(t.booksStartDate)}. Saldo awal hanya bisa dikoreksi.`);
      const [early] = await tx.select({ n: sql<number>`count(*)::int` }).from(T.transactions).where(and(eq(T.transactions.templeId, templeId), lt(T.transactions.date, i.startDate)));
      if (early.n) throw new ApiError(409, `Sudah ada ${early.n} transaksi bertanggal sebelum ${formatDate(i.startDate)}. Pilih tanggal mulai yang sama atau lebih awal dari transaksi pertama.`);
      const accounts = await tx.select().from(T.accounts).where(and(eq(T.accounts.templeId, templeId), eq(T.accounts.archived, false)));
      const missing = accounts.filter((a) => !i.balances.some((b) => b.accountId === a.id));
      if (missing.length) throw new ApiError(400, `Isi saldo awal untuk semua kas dan rekening (belum: ${missing.map((a) => a.label || a.name).join(", ")}).`);
      const now = new Date();
      for (const b of i.balances) {
        const a = accounts.find((x) => x.id === b.accountId);
        if (!a) throw new ApiError(400, "Kas/rekening tidak ditemukan atau nonaktif.");
        await tx.update(T.accounts).set({ openingBalance: b.amount, openingDate: i.startDate, openingSetAt: now, openingWitnesses: i.witnesses }).where(eq(T.accounts.id, a.id));
      }
      await tx.update(T.temples).set({ booksStartDate: i.startDate, booksStartedAt: now, booksStartedBy: ctx.user.id, booksWitnesses: i.witnesses }).where(eq(T.temples.id, templeId));
      await log(ctx, tx, {
        action: "Memulai pembukuan di aplikasi",
        entity: "settings",
        entityId: templeId,
        detail: `Mulai ${formatDate(i.startDate)}; saksi: ${i.witnesses}. ${i.balances.map((b) => `${accounts.find((a) => a.id === b.accountId)?.name}: ${rupiah(b.amount)}`).join("; ")}`,
      });
      return null;
    });
  },

  /** Opening balance of an account added after the start (e.g. a new bank account) — once, witnessed. */
  async setOpeningBalance(ctx, p) {
    const templeId = requireTemple(ctx);
    await requirePerm(ctx, "settings.manage", "mengisi saldo awal");
    const i = z.object({ accountId: id, amount: money, witnesses }).parse(p);
    return db.transaction(async (tx) => {
      const t = await one(tx.select().from(T.temples).where(eq(T.temples.id, templeId)), "Pura tidak ditemukan.");
      if (!t.booksStartDate) throw new ApiError(409, "Mulai pembukuan dulu (tanggal mulai dan saldo awal semua kas/rekening).");
      const a = await one(tx.select().from(T.accounts).where(and(eq(T.accounts.id, i.accountId), eq(T.accounts.templeId, templeId))).for("update"), "Kas/rekening tidak ditemukan.");
      if (a.openingSetAt) throw new ApiError(409, "Saldo awal kas/rekening ini sudah dikunci. Gunakan koreksi saldo awal.");
      const date = todayInAppTz() > t.booksStartDate ? todayInAppTz() : t.booksStartDate;
      await tx.update(T.accounts).set({ openingBalance: i.amount, openingDate: date, openingSetAt: new Date(), openingWitnesses: i.witnesses }).where(eq(T.accounts.id, a.id));
      await log(ctx, tx, { action: "Mengisi saldo awal", entity: "settings", entityId: a.id, detail: `${a.label || a.name}: ${rupiah(i.amount)} per ${formatDate(date)}; saksi: ${i.witnesses}` });
      return null;
    });
  },

  /** Moves a locked opening balance by a recorded, append-only correction (reason + two witnesses). */
  async correctOpeningBalance(ctx, p) {
    const templeId = requireTemple(ctx);
    await requirePerm(ctx, "settings.manage", "mengoreksi saldo awal");
    const i = z
      .object({ accountId: id, amount: z.number().int().min(-1e13).max(1e13).refine((v) => v !== 0, "Isi selisih koreksi (tidak boleh nol)"), reason: text(300).min(5, "Tuliskan alasan koreksi"), witnesses })
      .parse(p);
    return db.transaction(async (tx) => {
      const a = await one(tx.select().from(T.accounts).where(and(eq(T.accounts.id, i.accountId), eq(T.accounts.templeId, templeId))), "Kas/rekening tidak ditemukan.");
      if (!a.openingSetAt) throw new ApiError(409, "Saldo awal kas/rekening ini belum dikunci, jadi belum perlu koreksi.");
      await tx.insert(T.openingCorrections).values({ id: uid("oc"), templeId, accountId: a.id, amount: i.amount, reason: i.reason, witnesses: i.witnesses, createdBy: ctx.user.id });
      await log(ctx, tx, {
        action: "Mengoreksi saldo awal",
        entity: "settings",
        entityId: a.id,
        detail: `${a.label || a.name}: ${i.amount > 0 ? "+" : "−"}${rupiah(Math.abs(i.amount))} — alasan: ${i.reason}; saksi: ${i.witnesses}`,
      });
      return null;
    });
  },

  /**
   * Monthly check: end-of-month balance from the bank statement / cash count per account. The app's
   * own balance at that moment is stored next to it. A note only: balances never change.
   */
  async saveReconciliation(ctx, p) {
    const templeId = requireTemple(ctx);
    await requirePerm(ctx, "reconcile.manage", "mencatat pencocokan bulanan");
    const i = z
      .object({
        month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
        items: z.array(z.object({ accountId: id, statementBalance: z.number().int().min(-1e13).max(1e13), note: optText(300) })).min(1),
      })
      .parse(p);
    if (i.month > todayInAppTz().slice(0, 7)) throw new ApiError(400, "Bulan ini belum terjadi.");
    const [y, mo] = i.month.split("-").map(Number);
    const monthEnd = new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
    return db.transaction(async (tx) => {
      const t = await one(tx.select().from(T.temples).where(eq(T.temples.id, templeId)), "Pura tidak ditemukan.");
      if (t.booksStartDate && monthEnd < t.booksStartDate) throw new ApiError(400, "Bulan itu sebelum tanggal mulai pembukuan.");
      const txs = (await tx.select().from(T.transactions).where(and(eq(T.transactions.templeId, templeId), lte(T.transactions.date, monthEnd)))).map(m.toTx);
      const out: { account: string; app: number; statement: number }[] = [];
      for (const it of i.items) {
        const row = await one(tx.select().from(T.accounts).where(and(eq(T.accounts.id, it.accountId), eq(T.accounts.templeId, templeId))), "Kas/rekening tidak ditemukan.");
        const app = accountBalance(m.toAccount(row), txs, monthEnd);
        await tx.insert(T.reconciliations).values({ id: uid("rc"), templeId, accountId: row.id, month: i.month, statementBalance: it.statementBalance, appBalance: app, note: it.note ?? "", createdBy: ctx.user.id });
        out.push({ account: row.label || row.name, app, statement: it.statementBalance });
      }
      await log(ctx, tx, {
        action: "Mencatat pencocokan bulanan",
        entity: "settings",
        entityId: templeId,
        detail: `${i.month}: ${out.map((o) => `${o.account} selisih ${rupiah(o.statement - o.app)}`).join("; ")}`,
      });
      return null;
    });
  },
};
