import "server-only";
import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema as T } from "./db";
import { ApiError, todayInAppTz } from "./http";
import { requireSuperAdmin } from "./context";
import { diff } from "./log";
import { id, log, one, optId, optText, text, type Handler } from "./commands";
import * as m from "./map";
import { categoriesFor } from "@/lib/categories";
import { slugify, uid } from "@/lib/format";

const email = z.string().trim().toLowerCase().email("Email belum benar").max(200);

/** Back Office — every command here is for Admin Utama only. */
export const adminCommands: Record<string, Handler> = {
  async saveBanjar(ctx, p) {
    await requireSuperAdmin(ctx, "mengelola banjar");
    const i = z
      .object({
        id: optId, name: text(120).min(3), village: text(80), district: text(80), regency: text(80), province: text(80),
        status: z.enum(["active", "inactive"]).default("active"),
      })
      .parse(p);
    return db.transaction(async (tx) => {
      const { id: bid, ...values } = i;
      if (bid) {
        const cur = await one(tx.select().from(T.banjars).where(eq(T.banjars.id, bid)), "Banjar tidak ditemukan.");
        await tx.update(T.banjars).set(values).where(eq(T.banjars.id, bid));
        await log(ctx, tx, { action: "Mengubah banjar", entity: "settings", entityId: bid, detail: values.name, changes: diff(cur, values, Object.keys(values)), templeId: null });
        return null;
      }
      const newId = uid("bj");
      let slug = slugify(values.name) || newId;
      if ((await tx.select().from(T.banjars).where(eq(T.banjars.slug, slug)))[0]) slug = `${slug}-${newId.slice(-4)}`;
      await tx.insert(T.banjars).values({ ...values, id: newId, slug });
      await log(ctx, tx, { action: "Menambah banjar", entity: "settings", entityId: newId, detail: values.name, templeId: null });
      return { id: newId };
    });
  },

  /** Creates or edits a temple and its Banjar Pengempon (one or more). */
  async adminSaveTemple(ctx, p) {
    await requireSuperAdmin(ctx, "mengelola pura");
    const i = z
      .object({
        // Required: name and banjar pengempon. Everything else is optional (a temple has no email).
        id: optId, name: text(120).min(4, "Nama pura minimal 4 huruf"),
        province: text(80).default(""), regency: text(80).default(""), district: text(80).default(""), village: text(80).default(""),
        address: text(300).default(""), description: text(600).default(""), phone: text(20).default(""), status: z.enum(["active", "pending"]).default("active"),
        banjarIds: z.array(id).min(1, "Pilih minimal satu banjar pengempon").max(10),
      })
      .parse(p);
    return db.transaction(async (tx) => {
      const banjars = await tx.select().from(T.banjars).where(inArray(T.banjars.id, i.banjarIds));
      if (banjars.length !== i.banjarIds.length) throw new ApiError(400, "Banjar tidak ditemukan.");
      const { id: tid, banjarIds, ...values } = i;
      let templeId = tid;
      if (templeId) {
        const cur = await one(tx.select().from(T.temples).where(eq(T.temples.id, templeId)), "Pura tidak ditemukan.");
        const before = (await tx.select().from(T.templeBanjars).where(eq(T.templeBanjars.templeId, templeId))).map((r) => r.banjarId).sort();
        await tx.update(T.temples).set(values).where(eq(T.temples.id, templeId));
        await tx.delete(T.templeBanjars).where(eq(T.templeBanjars.templeId, templeId));
        const changes = diff(cur, values, Object.keys(values)) ?? {};
        if (JSON.stringify(before) !== JSON.stringify([...banjarIds].sort())) Object.assign(changes, { banjarPengempon: { dari: before, menjadi: banjarIds } });
        await log(ctx, tx, { action: "Mengubah data pura", entity: "settings", entityId: templeId, detail: values.name, changes, templeId });
      } else {
        templeId = uid("t");
        let slug = slugify(values.name) || templeId;
        if ((await tx.select().from(T.temples).where(eq(T.temples.slug, slug)))[0]) slug = `${slug}-${templeId.slice(-4)}`;
        await tx.insert(T.temples).values({
          ...values, id: templeId, slug, cover: "emerald",
          transparency: { ...m.DEFAULT_TRANSPARENCY },
          branding: { headerTitle: `Laporan Keuangan ${values.name}`, signatoryName: "", signatoryRole: "Pengurus Pura", footerNote: "Laporan ini disusun secara transparan untuk krama pengempon pura." },
        });
        const today = todayInAppTz();
        await tx.insert(T.accounts).values([
          { id: uid("acc"), templeId, name: "Kas Tunai Pura", type: "cash", openingBalance: 0, openingDate: today },
          { id: uid("acc"), templeId, name: "Rekening Pura", type: "bank", openingBalance: 0, openingDate: today },
        ]);
        await tx.insert(T.categories).values(categoriesFor(templeId).map((c) => ({ ...c, archived: false })));
        const year = today.slice(0, 4);
        await tx.insert(T.activities).values({ id: uid("a"), templeId, name: "Operasional Pura", description: "Kebutuhan rutin pura.", startDate: `${year}-01-01`, endDate: `${year}-12-31`, budget: 0, fundType: "general", status: "ongoing", color: "#8A5CB8" });
        await log(ctx, tx, { action: "Menambah pura", entity: "settings", entityId: templeId, detail: `${values.name} (banjar: ${banjars.map((b) => b.name).join(", ")})`, templeId });
      }
      await tx.insert(T.templeBanjars).values(banjarIds.map((banjarId) => ({ templeId: templeId!, banjarId })));
      return { id: templeId };
    });
  },

  /** Official account for punia transfers. Only Admin Utama may change it; every change is logged. */
  async setTempleBank(ctx, p) {
    await requireSuperAdmin(ctx, "mengubah info rekening pura");
    const i = z
      .object({
        templeId: id, bankName: optText(80), bankAccountNumber: z.string().trim().max(40).regex(/^[0-9\s.-]*$/, "Nomor rekening hanya angka").optional().nullable().transform((v) => v || null),
        bankAccountHolder: optText(120),
      })
      .parse(p);
    const filled = [i.bankName, i.bankAccountNumber, i.bankAccountHolder].filter(Boolean).length;
    if (filled !== 0 && filled !== 3) throw new ApiError(400, "Isi nama bank, nomor rekening, dan nama pemilik rekening sekaligus (atau kosongkan semuanya).");
    return db.transaction(async (tx) => {
      const cur = await one(tx.select().from(T.temples).where(eq(T.temples.id, i.templeId)).for("update"), "Pura tidak ditemukan.");
      const values = { bankName: i.bankName, bankAccountNumber: i.bankAccountNumber, bankAccountHolder: i.bankAccountHolder };
      await tx.update(T.temples).set(values).where(eq(T.temples.id, i.templeId));
      // Keep the bookkeeping bank account labelled with the same details.
      const [acc] = await tx.select().from(T.accounts).where(and(eq(T.accounts.templeId, i.templeId), eq(T.accounts.type, "bank"))).limit(1);
      if (acc) await tx.update(T.accounts).set({ bankName: i.bankName, accountNumber: i.bankAccountNumber, accountHolder: i.bankAccountHolder, isPublic: filled === 3 }).where(eq(T.accounts.id, acc.id));
      await log(ctx, tx, { action: "Mengubah info rekening pura", entity: "settings", entityId: i.templeId, detail: cur.name, changes: diff(cur, values, Object.keys(values)), templeId: i.templeId });
      return null;
    });
  },

  /**
   * Registers a Pengurus Pura, Pemeriksa or Pengurus Banjar by email. If the person has no account
   * yet, one is created; they sign in later with Google or an email link using the same address.
   */
  async adminAddStaff(ctx, p) {
    await requireSuperAdmin(ctx, "mendaftarkan pengurus");
    const i = z
      .object({ email, name: optText(120), kind: z.enum(["pengurus", "pemeriksa", "banjar"]), templeId: optId, banjarId: optId })
      .parse(p);
    return db.transaction(async (tx) => {
      let [u] = await tx.select().from(T.users).where(sql`lower(${T.users.email}) = ${i.email}`);
      if (u?.isSuperAdmin) throw new ApiError(409, "Email ini milik Admin Utama — sudah memiliki akses penuh.");
      if (u?.status === "deleted") throw new ApiError(409, "Akun dengan email ini sudah dihapus pemiliknya.");
      if (!u) {
        const name = i.name ?? i.email.split("@")[0];
        const parts = name.trim().split(/\s+/);
        [u] = await tx
          .insert(T.users)
          .values({ id: uid("u"), name, callName: parts[parts.length - 1], email: i.email, avatarColor: ["#087F6D", "#C9A86A", "#3F6FB5", "#8A5CB8", "#B5543F"][Math.floor(Math.random() * 5)] })
          .returning();
        await log(ctx, tx, { action: "Membuat akun", entity: "user", entityId: u.id, detail: `${u.name} (${u.email}) didaftarkan Admin Utama`, templeId: null });
      }
      if (i.kind === "banjar") {
        if (!i.banjarId) throw new ApiError(400, "Pilih banjar.");
        const b = await one(tx.select().from(T.banjars).where(eq(T.banjars.id, i.banjarId)), "Banjar tidak ditemukan.");
        const exists = (await tx.select().from(T.banjarMembers).where(and(eq(T.banjarMembers.userId, u.id), eq(T.banjarMembers.banjarId, b.id))))[0];
        if (exists?.status === "active") throw new ApiError(409, "Orang ini sudah menjadi Pengurus Banjar tersebut.");
        if (exists) await tx.update(T.banjarMembers).set({ status: "active" }).where(eq(T.banjarMembers.id, exists.id));
        else await tx.insert(T.banjarMembers).values({ id: uid("bm"), userId: u.id, banjarId: b.id, status: "active" });
        await log(ctx, tx, { action: "Mendaftarkan Pengurus Banjar", entity: "user", entityId: u.id, detail: `${u.name} (${u.email}) — ${b.name}`, templeId: null });
      } else {
        if (!i.templeId) throw new ApiError(400, "Pilih pura.");
        const t = await one(tx.select().from(T.temples).where(eq(T.temples.id, i.templeId)), "Pura tidak ditemukan.");
        const exists = (await tx.select().from(T.memberships).where(and(eq(T.memberships.userId, u.id), eq(T.memberships.templeId, t.id))))[0];
        if (exists) await tx.update(T.memberships).set({ role: i.kind, status: "active" }).where(eq(T.memberships.id, exists.id));
        else await tx.insert(T.memberships).values({ id: uid("m"), userId: u.id, templeId: t.id, role: i.kind, status: "active" });
        await log(ctx, tx, {
          action: i.kind === "pengurus" ? "Mendaftarkan Pengurus Pura" : "Mendaftarkan Pemeriksa",
          entity: "user", entityId: u.id, detail: `${u.name} (${u.email}) — ${t.name}`, templeId: t.id,
          changes: exists ? { peran: { dari: exists.role, menjadi: i.kind } } : null,
        });
      }
      return { userId: u.id };
    });
  },

  async adminRemoveStaff(ctx, p) {
    await requireSuperAdmin(ctx, "mencabut peran pengurus");
    const i = z.object({ kind: z.enum(["temple", "banjar"]), id }).parse(p);
    return db.transaction(async (tx) => {
      if (i.kind === "banjar") {
        const bm = await one(tx.select().from(T.banjarMembers).where(eq(T.banjarMembers.id, i.id)));
        const u = await one(tx.select().from(T.users).where(eq(T.users.id, bm.userId)));
        const b = await one(tx.select().from(T.banjars).where(eq(T.banjars.id, bm.banjarId)));
        await tx.delete(T.banjarMembers).where(eq(T.banjarMembers.id, i.id));
        await log(ctx, tx, { action: "Mencabut peran Pengurus Banjar", entity: "user", entityId: u.id, detail: `${u.name} — ${b.name}`, templeId: null });
      } else {
        const mem = await one(tx.select().from(T.memberships).where(eq(T.memberships.id, i.id)));
        const u = await one(tx.select().from(T.users).where(eq(T.users.id, mem.userId)));
        const t = await one(tx.select().from(T.temples).where(eq(T.temples.id, mem.templeId)));
        await tx.delete(T.memberships).where(eq(T.memberships.id, i.id));
        await log(ctx, tx, { action: "Mencabut peran pengurus pura", entity: "user", entityId: u.id, detail: `${u.name} (${mem.role}) — ${t.name}`, templeId: t.id });
      }
      return null;
    });
  },

  /** Deactivating takes effect immediately: every session of that person is ended. */
  async adminSetUserStatus(ctx, p) {
    await requireSuperAdmin(ctx, "menonaktifkan pengguna");
    const { userId, status } = z.object({ userId: id, status: z.enum(["active", "disabled"]) }).parse(p);
    return db.transaction(async (tx) => {
      const u = await one(tx.select().from(T.users).where(eq(T.users.id, userId)));
      if (u.isSuperAdmin) throw new ApiError(409, "Akun Admin Utama tidak dapat dinonaktifkan.");
      if (u.status === "deleted") throw new ApiError(409, "Akun ini sudah dihapus pemiliknya.");
      await tx.update(T.users).set({ status }).where(eq(T.users.id, userId));
      if (status === "disabled") await tx.delete(T.sessions).where(eq(T.sessions.userId, userId));
      await log(ctx, tx, { action: status === "disabled" ? "Menonaktifkan pengguna" : "Mengaktifkan kembali pengguna", entity: "user", entityId: userId, detail: `${u.name} (${u.email})`, templeId: null });
      return null;
    });
  },
};
