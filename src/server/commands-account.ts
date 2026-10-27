import "server-only";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema as T } from "./db";
import { ApiError } from "./http";
import { templeAccess } from "./context";
import { log, type Handler } from "./commands";
import { destroySession } from "./auth";

export const accountCommands: Record<string, Handler> = {
  /** Signs this account out on every device (e.g. a lost phone), including this one. */
  async logoutEverywhere(ctx) {
    await db.transaction(async (tx) => {
      await tx.delete(T.sessions).where(eq(T.sessions.userId, ctx.user.id));
      await log(ctx, tx, { action: "Keluar dari semua perangkat", entity: "session", entityId: ctx.user.id, detail: ctx.user.email, templeId: null });
    });
    await destroySession();
    return null;
  },

  /**
   * Umat deletes their own account. Verified punia stay as the temple's financial record,
   * but the name is anonymised. Staff accounts must be released by Admin Utama first.
   */
  async deleteMyAccount(ctx, p) {
    z.object({ confirm: z.literal("HAPUS") }).parse(p);
    if (ctx.user.isSuperAdmin) throw new ApiError(409, "Akun Admin Utama tidak dapat dihapus.");
    if ((await templeAccess(ctx.user)).size > 0)
      throw new ApiError(409, "Akun Anda masih terdaftar sebagai pengurus. Minta Admin Utama mencabut peran pengurus terlebih dahulu.");
    await db.transaction(async (tx) => {
      const mine = await tx.select({ id: T.donations.id, status: T.donations.status }).from(T.donations).where(eq(T.donations.submittedBy, ctx.user.id));
      const ids = mine.map((d) => d.id);
      if (ids.length) {
        await tx.update(T.donations).set({ donorName: "Anonim (akun dihapus)", privacy: "anonymous", submitterEmail: null, message: null }).where(inArray(T.donations.id, ids));
        await tx.update(T.transactions).set({ source: "Anonim", description: "Punia: Anonim (akun dihapus)" }).where(and(inArray(T.transactions.donationId, ids)));
      }
      await log(ctx, tx, { action: "Menghapus akun sendiri", entity: "user", entityId: ctx.user.id, detail: `Akun umat dihapus; ${ids.length} catatan punia dianonimkan.`, templeId: null });
      await tx
        .update(T.users)
        .set({ status: "deleted", deletedAt: new Date(), name: "Akun dihapus", callName: "Umat", email: `dihapus+${ctx.user.id}@pura.invalid`, phone: null, googleSub: null, passwordHash: null })
        .where(eq(T.users.id, ctx.user.id));
      await tx.delete(T.sessions).where(eq(T.sessions.userId, ctx.user.id));
    });
    await destroySession();
    return null;
  },
};
