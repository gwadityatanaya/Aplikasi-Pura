import "server-only";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema as T } from "./db";
import { ApiError } from "./http";
import { templeAccess } from "./context";
import { log, type Handler } from "./commands";
import { destroySession, rateLimit } from "./auth";
import { checkAvatar } from "./images";
import { uid } from "@/lib/format";

export const AVATAR_REMOVED_NOTICE = "Foto profil Anda telah dihapus oleh Admin Utama karena tidak sesuai untuk aplikasi ini.";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Removes a person's profile photo (the stored image itself, not only the link). */
export async function dropAvatar(tx: Tx, user: { id: string; avatarId: string | null }) {
  if (!user.avatarId) return false;
  await tx.update(T.users).set({ avatarId: null, avatarAt: null }).where(eq(T.users.id, user.id));
  await tx.delete(T.attachments).where(eq(T.attachments.id, user.avatarId));
  return true;
}

export const accountCommands: Record<string, Handler> = {
  /** Profile photo, already cropped square and resized on the device (≈256×256, ≈50 KB). */
  async setMyAvatar(ctx, p) {
    const { image } = z.object({ image: z.string().max(200_000) }).parse(p);
    await rateLimit(`avatar:${ctx.user.id}`, 20, 60);
    const { mime, buf } = checkAvatar(image);
    await db.transaction(async (tx) => {
      const [me] = await tx.select().from(T.users).where(eq(T.users.id, ctx.user.id)).for("update");
      await dropAvatar(tx, me);
      const id = uid("av");
      await tx.insert(T.attachments).values({ id, templeId: null, mime, data: buf, size: buf.length, isPublic: false, createdBy: ctx.user.id });
      await tx.update(T.users).set({ avatarId: id, avatarAt: new Date() }).where(eq(T.users.id, ctx.user.id));
      await log(ctx, tx, { action: "Mengganti foto profil", entity: "user", entityId: ctx.user.id, detail: ctx.user.name, templeId: null });
    });
    return null;
  },

  /** Closes the one-sentence in-app message (e.g. "foto profil dihapus"). */
  async dismissNotice(ctx) {
    await db.update(T.users).set({ notice: null }).where(eq(T.users.id, ctx.user.id));
    ctx.user.notice = null; // the state sent back with this answer is built from ctx.user
    return null;
  },

  async removeMyAvatar(ctx) {
    await db.transaction(async (tx) => {
      const [me] = await tx.select().from(T.users).where(eq(T.users.id, ctx.user.id)).for("update");
      if (await dropAvatar(tx, me)) await log(ctx, tx, { action: "Menghapus foto profil", entity: "user", entityId: ctx.user.id, detail: ctx.user.name, templeId: null });
    });
    return null;
  },

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
      const [me] = await tx.select().from(T.users).where(eq(T.users.id, ctx.user.id)).for("update");
      const hadPhoto = await dropAvatar(tx, me);
      // Images attached to their help messages go too (the messages stay, under "Akun dihapus").
      const helpFiles = (await tx.select({ id: T.helpTickets.id, a: T.helpTickets.attachmentId }).from(T.helpTickets).where(eq(T.helpTickets.userId, ctx.user.id))).filter((t) => t.a);
      if (helpFiles.length) {
        await tx.update(T.helpTickets).set({ attachmentId: null, attachmentRemovedAt: new Date() }).where(inArray(T.helpTickets.id, helpFiles.map((t) => t.id)));
        await tx.delete(T.attachments).where(inArray(T.attachments.id, helpFiles.map((t) => t.a!)));
      }
      await log(ctx, tx, { action: "Menghapus akun sendiri", entity: "user", entityId: ctx.user.id, detail: `Akun umat dihapus; ${ids.length} catatan punia dianonimkan${hadPhoto ? "; foto profil dihapus" : ""}.`, templeId: null });
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
