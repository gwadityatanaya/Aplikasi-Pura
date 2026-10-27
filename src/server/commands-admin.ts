import "server-only";
import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema as T } from "./db";
import { ApiError, todayInAppTz } from "./http";
import { requireSuperAdmin, requireTemple } from "./context";
import { resolveAddress, type AddressInput } from "./wilayah";
import { diff } from "./log";
import { id, log, one, optId, optText, text, type Handler } from "./commands";
import * as m from "./map";
import { categoriesFor } from "@/lib/categories";
import { callNameOf, slugify, uid } from "@/lib/format";
import { AVATAR_REMOVED_NOTICE, dropAvatar } from "./commands-account";

const email = z.string().trim().toLowerCase().email("Email belum benar").max(200);

/** Back Office — every command here is for Admin Utama only. */
/**
 * Address from the cascading dropdowns: per level an optional Kemendagri code (picked from the list)
 * and/or a name (typed by hand when "tidak ada di daftar"). All optional. resolveAddress() checks the
 * codes against the bundled region list and fills the names from it.
 */
const wilayahCode = z.string().trim().max(13).regex(/^[\d.]*$/).optional().nullable();
const addressFields = {
  province: text(100).default(""), regency: text(100).default(""), district: text(100).default(""), village: text(100).default(""),
  provinceCode: wilayahCode, regencyCode: wilayahCode, districtCode: wilayahCode, villageCode: wilayahCode,
  address: text(300).default(""),
};
function splitAddress<T extends { address: string } & AddressInput>(i: T) {
  const { province, regency, district, village, provinceCode, regencyCode, districtCode, villageCode, ...rest } = i;
  return { rest, address: resolveAddress({ province, regency, district, village, provinceCode, regencyCode, districtCode, villageCode }) };
}

export const adminCommands: Record<string, Handler> = {
  async saveBanjar(ctx, p) {
    await requireSuperAdmin(ctx, "mengelola banjar");
    const i = z
      .object({
        // Status is not edited here: archiving goes through archiveBanjar (with a reason, logged).
        id: optId, name: text(120).min(3), ...addressFields,
      })
      .parse(p);
    const { rest, address } = splitAddress(i);
    return db.transaction(async (tx) => {
      const { id: bid, ...base } = rest;
      const values = { ...base, ...address };
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
        ...addressFields, description: text(600).default(""), phone: text(20).default(""), status: z.enum(["active", "pending"]).default("active"),
        banjarIds: z.array(id).min(1, "Pilih minimal satu banjar pengempon").max(10),
      })
      .parse(p);
    return db.transaction(async (tx) => {
      const banjars = await tx.select().from(T.banjars).where(inArray(T.banjars.id, i.banjarIds));
      if (banjars.length !== i.banjarIds.length) throw new ApiError(400, "Banjar tidak ditemukan.");
      const { rest, address } = splitAddress(i);
      const { id: tid, banjarIds, ...base } = rest;
      const values = { ...base, ...address };
      let templeId = tid;
      if (templeId) {
        const cur = await one(tx.select().from(T.temples).where(eq(T.temples.id, templeId)), "Pura tidak ditemukan.");
        const before = (await tx.select().from(T.templeBanjars).where(eq(T.templeBanjars.templeId, templeId))).map((r) => r.banjarId).sort();
        // An archived temple stays archived; it is reactivated only through unarchiveTemple.
        if (cur.status === "archived" || cur.status === "rejected") values.status = cur.status as typeof values.status;
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
        await tx.insert(T.activities).values({ id: uid("a"), templeId, name: "Operasional Pura", description: "Kebutuhan rutin pura.", startDate: `${year}-01-01`, endDate: `${year}-12-31`, budget: 0, fundType: "general", status: "ongoing", color: "#8A5CB8", auto: true });
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
        [u] = await tx
          .insert(T.users)
          .values({ id: uid("u"), name, callName: callNameOf(name), email: i.email, avatarColor: ["#087F6D", "#C9A86A", "#3F6FB5", "#8A5CB8", "#B5543F"][Math.floor(Math.random() * 5)] })
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

  /**
   * Changes the sign-in email of a pengurus. It is the SAME account: roles, temples and history stay
   * linked. The old Google link and every session are cleared, so the person must sign in again with
   * the new address.
   */
  async adminChangeEmail(ctx, p) {
    await requireSuperAdmin(ctx, "mengganti email pengurus");
    const i = z.object({ userId: id, email: z.string().trim().toLowerCase().email("Format email belum benar").max(200) }).parse(p);
    return db.transaction(async (tx) => {
      const u = await one(tx.select().from(T.users).where(eq(T.users.id, i.userId)).for("update"), "Akun tidak ditemukan.");
      if (u.isSuperAdmin) throw new ApiError(409, "Email Admin Utama tidak diganti dari sini. Ubah ADMIN_EMAIL di pengaturan server lalu ikuti panduan.");
      if (u.status === "deleted") throw new ApiError(409, "Akun ini sudah dihapus pemiliknya.");
      if (u.email.toLowerCase() === i.email) throw new ApiError(400, "Email baru sama dengan email lama.");
      const [taken] = await tx.select({ id: T.users.id }).from(T.users).where(sql`lower(${T.users.email}) = ${i.email}`);
      if (taken) throw new ApiError(409, "Email baru sudah dipakai akun lain. Jika itu akun umat milik orang yang sama, hubungi pengembang untuk menggabungkan.");
      await tx.update(T.users).set({ email: i.email, googleSub: null }).where(eq(T.users.id, u.id));
      await tx.delete(T.sessions).where(eq(T.sessions.userId, u.id));
      await tx.delete(T.passwordTokens).where(eq(T.passwordTokens.userId, u.id));
      await log(ctx, tx, {
        action: "Mengganti email pengurus", entity: "user", entityId: u.id,
        detail: `${u.name}: ${u.email} → ${i.email}. Semua sesi lama dikeluarkan.`,
        changes: { email: { dari: u.email, menjadi: i.email } }, templeId: null,
      });
      return null;
    });
  },


  /**
   * Admin Utama normally only LOOKS at a temple. To sahkan/tolak/koreksi its records, emergency mode
   * must be switched on for that one temple, with a reason. It lasts 60 minutes (or until switched
   * off / another temple is opened). The start, the reason and every action are visible to the
   * temple's pengurus in Riwayat Audit Pura.
   */
  async startEmergency(ctx, p) {
    await requireSuperAdmin(ctx, "mengaktifkan mode darurat");
    const templeId = requireTemple(ctx);
    const { reason } = z.object({ reason: text(300).min(10, "Tuliskan alasan mode darurat (minimal 10 huruf).") }).parse(p);
    const until = new Date(Date.now() + 60 * 60_000);
    await db.transaction(async (tx) => {
      const t = await one(tx.select().from(T.temples).where(eq(T.temples.id, templeId)), "Pura tidak ditemukan.");
      await tx.update(T.sessions).set({ emergencyTempleId: templeId, emergencyUntil: until, emergencyReason: reason }).where(eq(T.sessions.id, ctx.session.id));
      await log(ctx, tx, { action: "Admin Utama mengaktifkan mode darurat", entity: "emergency", entityId: templeId, detail: `${t.name} — alasan: ${reason}. Berlaku 60 menit.`, templeId });
    });
    ctx.emergency = true;
    ctx.role = "superadmin";
    return { until: until.toISOString() };
  },

  async endEmergency(ctx) {
    await requireSuperAdmin(ctx, "mengakhiri mode darurat");
    const templeId = requireTemple(ctx);
    await db.transaction(async (tx) => {
      await tx.update(T.sessions).set({ emergencyTempleId: null, emergencyUntil: null, emergencyReason: null }).where(eq(T.sessions.id, ctx.session.id));
      await log(ctx, tx, { action: "Admin Utama mengakhiri mode darurat", entity: "emergency", entityId: templeId, detail: "Kembali ke mode lihat.", templeId });
    });
    ctx.emergency = false;
    ctx.role = "admin_view";
    return null;
  },


  /**
   * Sets the jabatan (Ketua, Sekretaris, Bendahara, Kelian Banjar, …) of one person in ONE
   * kepengurusan — a temple membership or a banjar membership — so the same person can hold
   * different jabatan in different temples. Admin Utama only; logged.
   */
  async adminSetPosition(ctx, p) {
    await requireSuperAdmin(ctx, "mengubah jabatan");
    const i = z
      .object({
        kind: z.enum(["temple", "banjar"]), id,
        position: z.enum(["ketua", "sekretaris", "bendahara", "kelian_banjar", "lainnya"]).nullable(),
        title: optText(60),
      })
      .parse(p);
    if (i.kind === "temple" && i.position === "kelian_banjar") throw new ApiError(400, "Kelian Banjar adalah jabatan di banjar, bukan di pura.");
    if (i.kind === "banjar" && i.position === "ketua") throw new ApiError(400, "Di banjar, pilih Kelian Banjar.");
    if (i.position === "lainnya" && !i.title) throw new ApiError(400, "Tuliskan nama jabatannya.");
    const title = i.position === "lainnya" ? i.title : null;
    return db.transaction(async (tx) => {
      const table = i.kind === "temple" ? T.memberships : T.banjarMembers;
      const row = (await tx.select().from(table).where(eq(table.id, i.id)))[0] as (typeof T.memberships.$inferSelect | typeof T.banjarMembers.$inferSelect) | undefined;
      if (!row) throw new ApiError(404, "Kepengurusan tidak ditemukan.");
      const u = await one(tx.select().from(T.users).where(eq(T.users.id, row.userId)));
      const scopeId = "templeId" in row ? row.templeId : row.banjarId;
      const scopeCol = i.kind === "temple" ? T.memberships.templeId : T.banjarMembers.banjarId;
      if (i.position && i.position !== "lainnya") {
        const holder = (await tx.select({ id: table.id, userId: table.userId }).from(table).where(and(eq(scopeCol, scopeId), eq(table.position, i.position), eq(table.status, "active"))))[0];
        if (holder && holder.id !== row.id) {
          const [h] = await tx.select({ name: T.users.name }).from(T.users).where(eq(T.users.id, holder.userId));
          throw new ApiError(409, `Jabatan ini sudah dipegang ${h?.name ?? "orang lain"}. Ubah jabatan orang itu terlebih dahulu.`);
        }
      }
      await tx.update(table).set({ position: i.position, positionTitle: title }).where(eq(table.id, i.id));
      const label = (pos: string | null, t: string | null) => (!pos ? "(tanpa jabatan)" : pos === "lainnya" ? t ?? "Lainnya" : pos);
      const where = i.kind === "temple"
        ? (await one(tx.select({ name: T.temples.name }).from(T.temples).where(eq(T.temples.id, scopeId)))).name
        : (await one(tx.select({ name: T.banjars.name }).from(T.banjars).where(eq(T.banjars.id, scopeId)))).name;
      await log(ctx, tx, {
        action: "Mengubah jabatan", entity: "user", entityId: u.id, detail: `${u.name} — ${where}`,
        changes: { jabatan: { dari: label(row.position, row.positionTitle), menjadi: label(i.position, title) } },
        templeId: i.kind === "temple" ? scopeId : null,
      });
      return null;
    });
  },

  /** Admin Utama removes an inappropriate profile photo (reason required, logged). */
  async adminRemoveAvatar(ctx, p) {
    await requireSuperAdmin(ctx, "menghapus foto profil orang lain");
    const i = z.object({ userId: id, reason: z.string().trim().min(5, "Tuliskan alasannya (minimal 5 huruf).").max(300) }).parse(p);
    return db.transaction(async (tx) => {
      const u = await one(tx.select().from(T.users).where(eq(T.users.id, i.userId)).for("update"), "Akun tidak ditemukan.");
      if (!(await dropAvatar(tx, u))) throw new ApiError(409, "Akun ini tidak memiliki foto profil.");
      // The owner is told in one sentence on their next visit — without the detailed reason.
      await tx.update(T.users).set({ notice: AVATAR_REMOVED_NOTICE }).where(eq(T.users.id, u.id));
      await log(ctx, tx, { action: "Menghapus foto profil orang lain", entity: "user", entityId: u.id, detail: `${u.name} — alasan: ${i.reason}`, templeId: null });
      return null;
    });
  },

  // ---- Arsip & hapus permanen (Admin Utama) --------------------------------
  // Archiving keeps every record (reports, Riwayat Audit Pura, Log Aktivitas) and can be undone.
  // Deleting is only possible for an empty temple / a banjar without temples, and the database
  // checks the same rules again (migration 0011), also for cascading deletes.

  /** Hides a temple from the public and makes it read-only. */
  async archiveTemple(ctx, p) {
    await requireSuperAdmin(ctx, "mengarsipkan pura");
    const i = confirmInput.parse(p);
    return db.transaction(async (tx) => {
      const t = await one(tx.select().from(T.temples).where(eq(T.temples.id, i.id)).for("update"), "Pura tidak ditemukan.");
      checkTypedName(t.name, i.confirmName);
      if (t.status === "archived") throw new ApiError(409, "Pura ini sudah diarsipkan.");
      // Umat already transferred real money: every waiting punia must be sahkan or tolak first.
      const [{ n: pending }] = await tx.select({ n: sql<number>`count(*)::int` }).from(T.donations).where(and(eq(T.donations.templeId, t.id), eq(T.donations.status, "pending")));
      if (pending) throw new ApiError(409, `Masih ada ${pending} punia menunggu verifikasi di pura ini. Sahkan atau tolak semuanya terlebih dahulu, baru pura bisa diarsipkan.`);
      await tx.update(T.temples).set({ status: "archived", archivedAt: new Date(), archiveReason: i.reason }).where(eq(T.temples.id, t.id));
      await tx.update(T.sessions).set({ emergencyTempleId: null, emergencyUntil: null, emergencyReason: null }).where(eq(T.sessions.emergencyTempleId, t.id));
      await log(ctx, tx, { action: "Mengarsipkan pura", entity: "settings", entityId: t.id, detail: `${t.name} — alasan: ${i.reason}`, changes: { status: { dari: t.status, menjadi: "archived" } }, templeId: t.id });
      return null;
    });
  },

  async unarchiveTemple(ctx, p) {
    await requireSuperAdmin(ctx, "mengaktifkan kembali pura");
    const i = confirmInput.parse(p);
    return db.transaction(async (tx) => {
      const t = await one(tx.select().from(T.temples).where(eq(T.temples.id, i.id)).for("update"), "Pura tidak ditemukan.");
      checkTypedName(t.name, i.confirmName);
      if (t.status !== "archived") throw new ApiError(409, "Pura ini tidak sedang diarsipkan.");
      await tx.update(T.temples).set({ status: "active", archivedAt: null, archiveReason: null }).where(eq(T.temples.id, t.id));
      await log(ctx, tx, { action: "Mengaktifkan kembali pura", entity: "settings", entityId: t.id, detail: `${t.name} — alasan: ${i.reason}`, changes: { status: { dari: "archived", menjadi: "active" } }, templeId: t.id });
      return null;
    });
  },

  /** Permanent delete — only for a temple without any data. Pengurus roles there are revoked. */
  async deleteTemple(ctx, p) {
    await requireSuperAdmin(ctx, "menghapus pura");
    const i = confirmInput.parse(p);
    return db.transaction(async (tx) => {
      const t = await one(tx.select().from(T.temples).where(eq(T.temples.id, i.id)).for("update"), "Pura tidak ditemukan.");
      checkTypedName(t.name, i.confirmName);
      const found = await templeData(tx, t);
      if (found.length) throw new ApiError(409, `Pura ini sudah memiliki data (${found.join(", ")}), jadi tidak bisa dihapus permanen. Arsipkan saja.`);
      const staff = await tx
        .select({ name: T.users.name, role: T.memberships.role })
        .from(T.memberships)
        .innerJoin(T.users, eq(T.users.id, T.memberships.userId))
        .where(and(eq(T.memberships.templeId, t.id), eq(T.memberships.status, "active")));
      await tx.update(T.sessions).set({ activeTempleId: null }).where(eq(T.sessions.activeTempleId, t.id));
      await tx.update(T.sessions).set({ emergencyTempleId: null, emergencyUntil: null, emergencyReason: null }).where(eq(T.sessions.emergencyTempleId, t.id));
      await tx.delete(T.notifications).where(eq(T.notifications.templeId, t.id));
      await tx.delete(T.memberships).where(eq(T.memberships.templeId, t.id));
      await tx.delete(T.templeBanjars).where(eq(T.templeBanjars.templeId, t.id));
      await tx.delete(T.activities).where(and(eq(T.activities.templeId, t.id), eq(T.activities.auto, true)));
      await tx.delete(T.categories).where(eq(T.categories.templeId, t.id));
      await tx.delete(T.accounts).where(eq(T.accounts.templeId, t.id));
      await tx.delete(T.temples).where(eq(T.temples.id, t.id));
      await log(ctx, tx, {
        action: "Menghapus pura permanen", entity: "settings", entityId: t.id,
        detail: `${t.name} — alasan: ${i.reason}${staff.length ? `. Peran dicabut: ${staff.map((s) => `${s.name} (${s.role})`).join(", ")}` : ""}`,
        templeId: null,
      });
      return null;
    });
  },

  /** Hides a banjar from the public; its Pengurus Banjar can only read. Its temples stay as they are. */
  async archiveBanjar(ctx, p) {
    await requireSuperAdmin(ctx, "mengarsipkan banjar");
    const i = confirmInput.parse(p);
    return db.transaction(async (tx) => {
      const b = await one(tx.select().from(T.banjars).where(eq(T.banjars.id, i.id)).for("update"), "Banjar tidak ditemukan.");
      checkTypedName(b.name, i.confirmName);
      if (b.status !== "active") throw new ApiError(409, "Banjar ini sudah diarsipkan.");
      await tx.update(T.banjars).set({ status: "inactive", archivedAt: new Date(), archiveReason: i.reason }).where(eq(T.banjars.id, b.id));
      await log(ctx, tx, { action: "Mengarsipkan banjar", entity: "settings", entityId: b.id, detail: `${b.name} — alasan: ${i.reason}`, templeId: null });
      return null;
    });
  },

  async unarchiveBanjar(ctx, p) {
    await requireSuperAdmin(ctx, "mengaktifkan kembali banjar");
    const i = confirmInput.parse(p);
    return db.transaction(async (tx) => {
      const b = await one(tx.select().from(T.banjars).where(eq(T.banjars.id, i.id)).for("update"), "Banjar tidak ditemukan.");
      checkTypedName(b.name, i.confirmName);
      if (b.status === "active") throw new ApiError(409, "Banjar ini tidak sedang diarsipkan.");
      await tx.update(T.banjars).set({ status: "active", archivedAt: null, archiveReason: null }).where(eq(T.banjars.id, b.id));
      await log(ctx, tx, { action: "Mengaktifkan kembali banjar", entity: "settings", entityId: b.id, detail: `${b.name} — alasan: ${i.reason}`, templeId: null });
      return null;
    });
  },

  /** Permanent delete — only for a banjar that supports no temple. Pengurus Banjar roles are revoked. */
  async deleteBanjar(ctx, p) {
    await requireSuperAdmin(ctx, "menghapus banjar");
    const i = confirmInput.parse(p);
    return db.transaction(async (tx) => {
      const b = await one(tx.select().from(T.banjars).where(eq(T.banjars.id, i.id)).for("update"), "Banjar tidak ditemukan.");
      checkTypedName(b.name, i.confirmName);
      const temples = await tx
        .select({ name: T.temples.name })
        .from(T.templeBanjars)
        .innerJoin(T.temples, eq(T.temples.id, T.templeBanjars.templeId))
        .where(eq(T.templeBanjars.banjarId, b.id));
      if (temples.length)
        throw new ApiError(409, `Banjar ini masih mengempon ${temples.length} pura (${temples.map((t) => t.name).join(", ")}), jadi tidak bisa dihapus. Arsipkan saja, atau pindahkan puranya ke banjar lain terlebih dahulu.`);
      const staff = await tx
        .select({ name: T.users.name })
        .from(T.banjarMembers)
        .innerJoin(T.users, eq(T.users.id, T.banjarMembers.userId))
        .where(and(eq(T.banjarMembers.banjarId, b.id), eq(T.banjarMembers.status, "active")));
      await tx.delete(T.banjarMembers).where(eq(T.banjarMembers.banjarId, b.id));
      await tx.delete(T.banjars).where(eq(T.banjars.id, b.id));
      await log(ctx, tx, {
        action: "Menghapus banjar permanen", entity: "settings", entityId: b.id,
        detail: `${b.name} — alasan: ${i.reason}${staff.length ? `. Peran Pengurus Banjar dicabut: ${staff.map((s) => s.name).join(", ")}` : ""}`,
        templeId: null,
      });
      return null;
    });
  },
};

/** Archive / delete: the name typed again as confirmation, and a reason (both required). */
const confirmInput = z.object({
  id,
  confirmName: z.string().trim().max(200),
  reason: z.string().trim().min(5, "Tuliskan alasannya (minimal 5 huruf).").max(300),
});

function checkTypedName(name: string, typed: string) {
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  if (norm(name) !== norm(typed)) throw new ApiError(400, "Nama yang diketik tidak sama dengan nama yang akan diproses.");
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** What makes a temple "not empty" (the same list the database trigger checks). */
async function templeData(tx: Tx, t: typeof T.temples.$inferSelect) {
  const count = async (table: typeof T.transactions | typeof T.donations | typeof T.campaigns | typeof T.reports | typeof T.attachments, extra?: ReturnType<typeof eq>) => {
    const [r] = await tx.select({ n: sql<number>`count(*)::int` }).from(table).where(extra ? and(eq(table.templeId, t.id), extra) : eq(table.templeId, t.id));
    return r.n;
  };
  const [txs, dons, camps, reps, files] = await Promise.all([count(T.transactions), count(T.donations), count(T.campaigns), count(T.reports), count(T.attachments)]);
  const [acts] = await tx.select({ n: sql<number>`count(*)::int` }).from(T.activities).where(and(eq(T.activities.templeId, t.id), eq(T.activities.auto, false)));
  const [bal] = await tx.select({ n: sql<number>`count(*)::int` }).from(T.accounts).where(and(eq(T.accounts.templeId, t.id), sql`${T.accounts.openingBalance} <> 0`));
  const found: string[] = [];
  if (txs) found.push(`${txs} transaksi`);
  if (dons) found.push(`${dons} punia`);
  if (acts.n) found.push(`${acts.n} kegiatan`);
  if (camps) found.push(`${camps} campaign`);
  if (reps) found.push(`${reps} laporan terbit`);
  if (files || t.photo) found.push("foto/nota");
  if (bal.n) found.push("saldo awal kas");
  return found;
}
