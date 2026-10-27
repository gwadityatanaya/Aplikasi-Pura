"use client";

// Prototype state store, persisted to LocalStorage.
// NOTE: This is NOT a security boundary. Sessions are simulated and no passwords are stored.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  Account,
  Activity,
  AppNotification,
  AuditEntry,
  Campaign,
  CampaignUpdate,
  Category,
  DataState,
  Donation,
  DonorPrivacy,
  Membership,
  Preferences,
  PublishedReport,
  Role,
  Session,
  Temple,
  Transaction,
  User,
} from "./types";
import { createSeed, categoriesFor, SEED_VERSION } from "./seed";
import { byCategory, campaignStats, summarize } from "./ledger";
import { rupiah, slugify, uid } from "./format";

export const STORAGE_KEY = "pura-prototype-state";
export const DEMO_BACKUP_KEY = "pura-prototype-demo-backup";

export interface TxInput {
  type: Transaction["type"];
  amount: number;
  date: string;
  categoryId?: string;
  description: string;
  accountId: string;
  toAccountId?: string;
  activityId?: string;
  campaignId?: string;
  source?: string;
  receipt?: string;
  receiptName?: string;
  notes?: string;
  status: Transaction["status"];
}

export interface CampaignInput {
  title: string;
  description: string;
  cover: Campaign["cover"];
  coverImage?: string;
  activityId?: string;
  target: number;
  startDate: string;
  endDate: string;
  purpose: string;
  accountId: string;
  instructions: string;
  manualVerification: boolean;
  showDonorList: boolean;
  defaultPrivacy: DonorPrivacy;
}

export interface DonationInput {
  campaignId: string;
  donorName: string;
  amount: number;
  date: string;
  privacy: DonorPrivacy;
  message?: string;
  evidence?: string;
  channel: Donation["channel"];
  simulated?: boolean;
  verifyNow?: boolean;
}

type Result<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

interface Actions {
  // session
  login: (email: string) => Result<User>;
  register: (input: { name: string; email: string }) => Result<User>;
  logout: () => void;
  requestPasswordReset: (email: string) => Result<string>;
  resetPassword: (token: string) => Result;
  setActiveTemple: (templeId: string) => void;
  setRoleOverride: (role?: Role) => void;
  createTemple: (input: Omit<Temple, "id" | "slug" | "status" | "createdAt" | "transparency" | "branding" | "cover"> & { cover?: Temple["cover"] }, role: Role) => Temple;
  // ledger
  addTransaction: (input: TxInput, idempotencyKey: string) => Result<Transaction>;
  updateDraft: (id: string, patch: Partial<TxInput>) => Result;
  confirmDraft: (id: string) => Result;
  deleteDraft: (id: string) => Result;
  reverseTransaction: (id: string, reason: string) => Result<Transaction>;
  // activities
  saveActivity: (a: Omit<Activity, "id" | "templeId"> & { id?: string }) => Activity;
  // campaigns
  saveCampaign: (input: CampaignInput, status: Campaign["status"], id?: string) => Campaign;
  setCampaignStatus: (id: string, status: Campaign["status"]) => void;
  addCampaignUpdate: (campaignId: string, u: Omit<CampaignUpdate, "id">) => void;
  // donations
  addDonation: (input: DonationInput) => Result<Donation>;
  verifyDonation: (id: string) => Result<Transaction>;
  rejectDonation: (id: string, reason: string) => Result;
  simulateDonation: (campaignId: string) => Donation | undefined;
  // reports
  publishReport: (input: { title: string; from: string; to: string; note?: string }) => PublishedReport;
  unpublishReport: (id: string) => void;
  // notifications
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  pushNotification: (n: Omit<AppNotification, "id" | "date" | "read" | "templeId"> & { templeId?: string }) => void;
  // settings
  updateTemple: (patch: Partial<Temple>) => void;
  updateUser: (patch: Partial<User>) => void;
  saveAccount: (a: Omit<Account, "id" | "templeId"> & { id?: string }) => void;
  saveCategory: (c: Omit<Category, "id" | "templeId"> & { id?: string }) => void;
  inviteMember: (input: { name: string; email: string; role: Role }) => Result;
  changeMemberRole: (membershipId: string, role: Role) => void;
  removeMember: (membershipId: string) => Result;
  setTempleStatus: (templeId: string, status: Temple["status"]) => void;
  setPreferences: (p: Partial<Preferences>) => void;
  // housekeeping
  resetData: () => void;
  replaceAll: (snapshot: { data: DataState; session: Session | null }) => void;
}

export interface StoreState {
  data: DataState;
  session: Session | null;
  prefs: Preferences;
  hydrated: boolean;
}

const defaultPrefs: Preferences = {
  textSize: "normal",
  reduceMotion: false,
  notifications: {
    donationPending: true,
    campaignTarget: true,
    campaignEnding: true,
    reportReady: true,
    approvals: true,
    weeklySummary: false,
  },
};

const nowISO = () => new Date().toISOString();

export const useStore = create<StoreState & Actions>()(
  persist(
    (set, get) => {
      /** Mutate data immutably via a producer on a shallow copy. */
      const update = (fn: (d: DataState) => void) => {
        const d = structuredClone(get().data);
        fn(d);
        set({ data: d });
      };
      const ctx = () => {
        const { session, data } = get();
        const user = data.users.find((u) => u.id === session?.userId);
        return { user, templeId: session?.activeTempleId ?? "", session };
      };
      const audit = (d: DataState, entry: Omit<AuditEntry, "id" | "at" | "actorId" | "actorName" | "templeId"> & { templeId?: string }) => {
        const { user, templeId } = ctx();
        d.audit.unshift({
          id: uid("au"),
          at: nowISO(),
          actorId: user?.id ?? "system",
          actorName: user?.name ?? "Sistem",
          templeId: entry.templeId ?? templeId,
          ...entry,
        });
      };
      const nextNumber = (d: DataState, date: string) => {
        d.counters.tx += 1;
        return `TRX-${date.slice(0, 4)}-${String(d.counters.tx).padStart(4, "0")}`;
      };
      const notify = (d: DataState, n: Omit<AppNotification, "id" | "date" | "read">) => {
        const p = get().prefs.notifications;
        const allowed: Record<AppNotification["kind"], boolean> = {
          donation_pending: p.donationPending,
          target_reached: p.campaignTarget,
          campaign_ending: p.campaignEnding,
          tx_approval: p.approvals,
          report_ready: p.reportReady,
          info: true,
        };
        if (!allowed[n.kind]) return;
        d.notifications.unshift({ ...n, id: uid("n"), date: nowISO(), read: false });
      };

      return {
        data: createSeed(),
        session: null,
        prefs: defaultPrefs,
        hydrated: false,

        login: (email) => {
          const user = get().data.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
          if (!user) return { ok: false, error: "Email belum terdaftar. Periksa kembali atau daftar akun baru." };
          const first = get().data.memberships.find((m) => m.userId === user.id && m.status === "active");
          set({ session: { userId: user.id, activeTempleId: first?.templeId, startedAt: nowISO() } });
          update((d) => audit(d, { action: "Masuk", entity: "session", detail: `${user.name} masuk ke aplikasi`, templeId: first?.templeId ?? "" }));
          return { ok: true, value: user };
        },
        register: ({ name, email }) => {
          const exists = get().data.users.some((u) => u.email.toLowerCase() === email.toLowerCase());
          if (exists) return { ok: false, error: "Email ini sudah terdaftar. Silakan masuk." };
          const first = name.trim().split(/\s+/);
          const user: User = {
            id: uid("u"),
            name: name.trim(),
            callName: first.length > 1 ? `Pak/Bu ${first[first.length - 1]}` : name.trim(),
            email: email.trim().toLowerCase(),
            avatarColor: "#087F6D",
            createdAt: nowISO(),
          };
          update((d) => d.users.push(user));
          set({ session: { userId: user.id, startedAt: nowISO() } });
          return { ok: true, value: user };
        },
        logout: () => {
          const { user, templeId } = ctx();
          if (user) update((d) => audit(d, { action: "Keluar", entity: "session", detail: `${user.name} keluar`, templeId }));
          set({ session: null });
        },
        requestPasswordReset: (email) => {
          const user = get().data.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
          // Same response whether or not the account exists (avoids account enumeration).
          const token = uid("rst");
          if (user) update((d) => d.resetRequests.push({ email: user.email, token, createdAt: nowISO() }));
          return { ok: true, value: user ? token : "" };
        },
        resetPassword: (token) => {
          const req = get().data.resetRequests.find((r) => r.token === token);
          if (!req) return { ok: false, error: "Tautan atur ulang tidak valid atau sudah digunakan." };
          update((d) => (d.resetRequests = d.resetRequests.filter((r) => r.token !== token)));
          return { ok: true, value: undefined };
        },
        setActiveTemple: (templeId) => {
          const s = get().session;
          if (s) set({ session: { ...s, activeTempleId: templeId, roleOverride: undefined } });
        },
        setRoleOverride: (role) => {
          const s = get().session;
          if (s) set({ session: { ...s, roleOverride: role } });
        },
        createTemple: (input, role) => {
          const { user } = ctx();
          const id = uid("t");
          let slug = slugify(input.name);
          if (get().data.temples.some((t) => t.slug === slug)) slug = `${slug}-${id.slice(-4)}`;
          const temple: Temple = {
            ...input,
            id,
            slug,
            cover: input.cover ?? "emerald",
            status: "active",
            createdAt: nowISO(),
            transparency: { showPublicProfile: true, showCampaigns: true, showPublishedSummaries: true, showDonorList: true, showBankAccount: true },
            branding: {
              headerTitle: `Laporan Keuangan ${input.name}`,
              signatoryName: user?.name ?? "",
              signatoryRole: "Ketua Pengempon",
              footerNote: "Laporan ini disusun secara transparan untuk krama pengempon pura.",
            },
          };
          update((d) => {
            d.temples.push(temple);
            d.memberships.push({ id: uid("m"), userId: user!.id, templeId: id, role, status: "active" });
            d.accounts.push({ id: uid("acc"), templeId: id, name: "Kas Tunai Pura", type: "cash", openingBalance: 0, openingDate: nowISO().slice(0, 10) });
            d.categories.push(...categoriesFor(id));
            d.activities.push({
              id: uid("a"),
              templeId: id,
              name: "Operasional Pura",
              description: "Kebutuhan rutin pura.",
              startDate: `${new Date().getFullYear()}-01-01`,
              endDate: `${new Date().getFullYear()}-12-31`,
              budget: 0,
              fundType: "general",
              status: "ongoing",
              color: "#8A5CB8",
            });
            notify(d, { templeId: id, kind: "info", title: "Selamat datang di PURA!", body: "Ruang kerja pura Anda sudah siap. Mulai dengan mencatat saldo awal kas di Pengaturan → Kas & Rekening.", href: "/app/pengaturan?tab=rekening" });
            audit(d, { action: "Mendaftarkan pura", entity: "settings", detail: input.name, templeId: id });
          });
          const s = get().session!;
          set({ session: { ...s, activeTempleId: id } });
          return temple;
        },

        addTransaction: (input, idempotencyKey) => {
          const { user, templeId } = ctx();
          const existing = get().data.transactions.find((t) => t.idempotencyKey === idempotencyKey);
          if (existing) return { ok: true, value: existing }; // duplicate submit — return original
          if (!user || !templeId) return { ok: false, error: "Sesi tidak ditemukan." };
          if (input.amount <= 0) return { ok: false, error: "Nominal harus lebih dari nol." };
          if (input.type === "transfer" && input.accountId === input.toAccountId)
            return { ok: false, error: "Rekening asal dan tujuan tidak boleh sama." };
          let tx!: Transaction;
          update((d) => {
            tx = {
              ...input,
              id: uid("tx"),
              number: nextNumber(d, input.date),
              templeId,
              createdBy: user.id,
              createdAt: nowISO(),
              updatedAt: nowISO(),
              idempotencyKey,
            };
            d.transactions.push(tx);
            const label = input.type === "income" ? "pemasukan" : input.type === "expense" ? "pengeluaran" : "pemindahan dana";
            audit(d, {
              action: input.status === "draft" ? `Membuat draf ${label}` : `Mencatat ${label}`,
              entity: "transaction",
              entityId: tx.id,
              detail: `${input.description} — ${rupiah(input.amount)}`,
            });
            if (input.status === "draft")
              notify(d, { templeId, kind: "tx_approval", title: "Transaksi menunggu persetujuan", body: `Draf "${input.description}" ${rupiah(input.amount)} perlu dikonfirmasi.`, href: `/app/transaksi/${tx.id}` });
          });
          return { ok: true, value: tx };
        },
        updateDraft: (id, patch) => {
          const tx = get().data.transactions.find((t) => t.id === id);
          if (!tx) return { ok: false, error: "Transaksi tidak ditemukan." };
          if (tx.status !== "draft") return { ok: false, error: "Transaksi yang sudah dikonfirmasi tidak dapat diubah. Gunakan koreksi." };
          update((d) => {
            const t = d.transactions.find((x) => x.id === id)!;
            Object.assign(t, patch, { updatedAt: nowISO() });
            audit(d, { action: "Mengubah draf", entity: "transaction", entityId: id, detail: t.description });
          });
          return { ok: true, value: undefined };
        },
        confirmDraft: (id) => {
          const tx = get().data.transactions.find((t) => t.id === id);
          if (!tx || tx.status !== "draft") return { ok: false, error: "Draf tidak ditemukan." };
          update((d) => {
            const t = d.transactions.find((x) => x.id === id)!;
            t.status = "confirmed";
            t.updatedAt = nowISO();
            audit(d, { action: "Mengonfirmasi transaksi", entity: "transaction", entityId: id, detail: `${t.description} — ${rupiah(t.amount)}` });
          });
          return { ok: true, value: undefined };
        },
        deleteDraft: (id) => {
          const tx = get().data.transactions.find((t) => t.id === id);
          if (!tx) return { ok: false, error: "Transaksi tidak ditemukan." };
          if (tx.status !== "draft") return { ok: false, error: "Transaksi terkonfirmasi tidak boleh dihapus." };
          update((d) => {
            d.transactions = d.transactions.filter((t) => t.id !== id);
            audit(d, { action: "Menghapus draf", entity: "transaction", entityId: id, detail: `${tx.description} — ${rupiah(tx.amount)}` });
          });
          return { ok: true, value: undefined };
        },
        reverseTransaction: (id, reason) => {
          const { user } = ctx();
          const tx = get().data.transactions.find((t) => t.id === id);
          if (!tx || !user) return { ok: false, error: "Transaksi tidak ditemukan." };
          if (tx.status !== "confirmed") return { ok: false, error: "Hanya transaksi terkonfirmasi yang dapat dikoreksi." };
          if (tx.reversedBy) return { ok: false, error: "Transaksi ini sudah pernah dikoreksi." };
          if (tx.reversalOf) return { ok: false, error: "Entri koreksi tidak dapat dikoreksi lagi." };
          if (tx.donationId) return { ok: false, error: "Transaksi dari donasi terverifikasi dikoreksi lewat halaman campaign." };
          let rev!: Transaction;
          update((d) => {
            const today = nowISO().slice(0, 10);
            rev = {
              ...tx,
              id: uid("tx"),
              number: nextNumber(d, today),
              date: today,
              description: `Koreksi: ${tx.description}`,
              notes: reason,
              reversalOf: tx.id,
              reversedBy: undefined,
              receipt: undefined,
              createdBy: user.id,
              createdAt: nowISO(),
              updatedAt: nowISO(),
              idempotencyKey: `reverse:${tx.id}`,
            };
            d.transactions.push(rev);
            d.transactions.find((t) => t.id === id)!.reversedBy = rev.id;
            audit(d, { action: "Membuat koreksi", entity: "transaction", entityId: rev.id, detail: `Membatalkan ${tx.number} "${tx.description}" ${rupiah(tx.amount)}. Alasan: ${reason}` });
          });
          return { ok: true, value: rev };
        },

        saveActivity: (a) => {
          const { templeId } = ctx();
          let saved!: Activity;
          update((d) => {
            if (a.id) {
              const ex = d.activities.find((x) => x.id === a.id)!;
              Object.assign(ex, a);
              saved = ex;
              audit(d, { action: "Mengubah kegiatan", entity: "activity", entityId: ex.id, detail: ex.name });
            } else {
              saved = { ...a, id: uid("a"), templeId } as Activity;
              d.activities.push(saved);
              audit(d, { action: "Membuat kegiatan", entity: "activity", entityId: saved.id, detail: saved.name });
            }
          });
          return saved;
        },

        saveCampaign: (input, status, id) => {
          const { templeId } = ctx();
          let saved!: Campaign;
          update((d) => {
            if (id) {
              const ex = d.campaigns.find((c) => c.id === id)!;
              Object.assign(ex, input, { status });
              if (status === "active" && !ex.publishedAt) ex.publishedAt = nowISO();
              saved = ex;
              audit(d, { action: status === "active" ? "Mempublikasikan campaign" : "Mengubah campaign", entity: "campaign", entityId: id, detail: ex.title });
            } else {
              let slug = slugify(input.title);
              if (d.campaigns.some((c) => c.slug === slug)) slug = `${slug}-${uid("x").slice(-4)}`;
              saved = {
                ...input,
                id: uid("cp"),
                slug,
                templeId,
                status,
                updates:
                  status === "active"
                    ? [{ id: uid("up"), date: nowISO().slice(0, 10), title: "Penggalangan dana dibuka", body: "Om Swastyastu. Penggalangan dana resmi dibuka. Suksma atas dukungan krama." }]
                    : [],
                createdAt: nowISO(),
                publishedAt: status === "active" ? nowISO() : undefined,
              };
              d.campaigns.push(saved);
              audit(d, { action: status === "active" ? "Membuat & mempublikasikan campaign" : "Membuat draf campaign", entity: "campaign", entityId: saved.id, detail: saved.title });
            }
          });
          return saved;
        },
        setCampaignStatus: (id, status) =>
          update((d) => {
            const c = d.campaigns.find((x) => x.id === id);
            if (!c) return;
            c.status = status;
            if (status === "active" && !c.publishedAt) c.publishedAt = nowISO();
            audit(d, { action: status === "completed" ? "Menutup campaign" : status === "active" ? "Mempublikasikan campaign" : "Menjadikan draf", entity: "campaign", entityId: id, detail: c.title });
          }),
        addCampaignUpdate: (campaignId, u) =>
          update((d) => {
            const c = d.campaigns.find((x) => x.id === campaignId);
            if (!c) return;
            c.updates.unshift({ ...u, id: uid("up") });
            audit(d, { action: "Menambah kabar campaign", entity: "campaign", entityId: campaignId, detail: u.title });
          }),

        addDonation: (input) => {
          const c = get().data.campaigns.find((x) => x.id === input.campaignId);
          if (!c) return { ok: false, error: "Campaign tidak ditemukan." };
          if (input.amount <= 0) return { ok: false, error: "Nominal harus lebih dari nol." };
          const donation: Donation = {
            id: uid("dn"),
            templeId: c.templeId,
            campaignId: c.id,
            donorName: input.donorName.trim() || "Anonim",
            amount: input.amount,
            date: input.date,
            privacy: input.privacy,
            status: "pending",
            message: input.message,
            evidence: input.evidence,
            channel: input.channel,
            simulated: input.simulated,
            createdAt: nowISO(),
          };
          update((d) => {
            d.donations.push(donation);
            audit(d, {
              action: input.simulated ? "Simulasi donasi masuk" : "Mencatat donasi",
              entity: "donation",
              entityId: donation.id,
              detail: `${donation.donorName} — ${rupiah(donation.amount)} (${c.title})`,
              templeId: c.templeId,
            });
            notify(d, {
              templeId: c.templeId,
              kind: "donation_pending",
              title: input.simulated ? "Donasi baru (simulasi) menunggu verifikasi" : "Donasi baru menunggu verifikasi",
              body: `${donation.donorName} — ${rupiah(donation.amount)} untuk ${c.title}.`,
              href: `/app/campaign/${c.id}?tab=verifikasi`,
            });
          });
          if (input.verifyNow) {
            const r = get().verifyDonation(donation.id);
            if (!r.ok) return r;
          }
          return { ok: true, value: get().data.donations.find((x) => x.id === donation.id)! };
        },
        verifyDonation: (id) => {
          const { user } = ctx();
          const dn = get().data.donations.find((x) => x.id === id);
          if (!dn) return { ok: false, error: "Donasi tidak ditemukan." };
          // Idempotent: a verified donation is linked to exactly one ledger entry.
          const linked = get().data.transactions.find((t) => t.donationId === id && !t.reversalOf);
          if (dn.status === "verified" && linked) return { ok: true, value: linked };
          if (dn.status === "rejected") return { ok: false, error: "Donasi yang ditolak tidak dapat diverifikasi." };
          const c = get().data.campaigns.find((x) => x.id === dn.campaignId)!;
          const before = campaignStats(c, get().data.donations);
          let tx!: Transaction;
          update((d) => {
            const don = d.donations.find((x) => x.id === id)!;
            const existing = d.transactions.find((t) => t.donationId === id && !t.reversalOf);
            if (existing) {
              tx = existing;
            } else {
              const cat = d.categories.find((k) => k.templeId === c.templeId && k.name === "Donasi Penggalangan Dana") ??
                d.categories.find((k) => k.templeId === c.templeId && k.type === "income");
              tx = {
                id: uid("tx"),
                number: nextNumber(d, dn.date),
                templeId: c.templeId,
                type: "income",
                amount: dn.amount,
                date: dn.date,
                categoryId: cat?.id,
                description: `Dana punia: ${dn.privacy === "public" ? dn.donorName : "Donatur"}`,
                accountId: c.accountId,
                activityId: c.activityId,
                campaignId: c.id,
                donationId: id,
                source: dn.donorName,
                receipt: dn.evidence,
                status: "confirmed",
                createdBy: user?.id ?? "system",
                createdAt: nowISO(),
                updatedAt: nowISO(),
                idempotencyKey: `donation:${id}`,
              };
              d.transactions.push(tx);
            }
            don.status = "verified";
            don.transactionId = tx.id;
            don.verifiedAt = nowISO();
            don.verifiedBy = user?.id;
            audit(d, { action: "Memverifikasi donasi", entity: "donation", entityId: id, detail: `${dn.donorName} — ${rupiah(dn.amount)} (${c.title}). Tercatat sebagai ${tx.number}.`, templeId: c.templeId });
            d.notifications.forEach((n) => {
              if (n.kind === "donation_pending" && n.body.includes(dn.donorName) && n.body.includes(c.title)) n.read = true;
            });
            const after = campaignStats(c, d.donations);
            if (before.collected < c.target && after.collected >= c.target)
              notify(d, { templeId: c.templeId, kind: "target_reached", title: "Target campaign tercapai 🎉", body: `${c.title} telah mencapai target ${rupiah(c.target)}.`, href: `/app/campaign/${c.id}` });
          });
          return { ok: true, value: tx };
        },
        rejectDonation: (id, reason) => {
          const dn = get().data.donations.find((x) => x.id === id);
          if (!dn) return { ok: false, error: "Donasi tidak ditemukan." };
          if (dn.status !== "pending") return { ok: false, error: "Hanya donasi menunggu yang dapat ditolak." };
          update((d) => {
            const don = d.donations.find((x) => x.id === id)!;
            don.status = "rejected";
            don.rejectedReason = reason;
            audit(d, { action: "Menolak donasi", entity: "donation", entityId: id, detail: `${dn.donorName} — ${rupiah(dn.amount)}: ${reason}`, templeId: dn.templeId });
          });
          return { ok: true, value: undefined };
        },
        simulateDonation: (campaignId) => {
          const pool: [string, DonorPrivacy][] = [
            ["I Made Surya", "public"],
            ["Ni Luh Sari", "public"],
            ["Keluarga I Wayan Adi", "public"],
            ["I Ketut Arsana", "public"],
            ["Ni Kadek Rai Wahyuni", "public"],
            ["Anonim", "anonymous"],
            ["Donatur Privat", "private"],
            ["Keluarga Jro Mangku Sudana", "public"],
          ];
          const amounts = [100_000, 150_000, 250_000, 300_000, 500_000, 750_000, 1_000_000];
          const [name, privacy] = pool[Math.floor(Math.random() * pool.length)];
          const amount = amounts[Math.floor(Math.random() * amounts.length)];
          const r = get().addDonation({
            campaignId,
            donorName: name,
            amount,
            date: nowISO().slice(0, 10),
            privacy,
            channel: "simulasi",
            simulated: true,
            message: "Donasi simulasi untuk demo prototipe.",
          });
          return r.ok ? r.value : undefined;
        },

        publishReport: ({ title, from, to, note }) => {
          const { templeId, user } = ctx();
          const d0 = get().data;
          const s = summarize(d0, templeId, { from, to });
          const inRange = d0.transactions.filter((t) => t.templeId === templeId && t.date >= from && t.date <= to);
          const report: PublishedReport = {
            id: uid("rp"),
            templeId,
            title,
            periodStart: from,
            periodEnd: to,
            publishedAt: nowISO(),
            publishedBy: user?.id ?? "",
            snapshot: {
              openingBalance: s.openingBalance,
              income: s.income,
              expense: s.expense,
              closingBalance: s.closingBalance,
              incomeByCategory: byCategory(inRange, d0.categories, "income").map(({ name, amount }) => ({ name, amount })),
              expenseByCategory: byCategory(inRange, d0.categories, "expense").map(({ name, amount }) => ({ name, amount })),
              note,
            },
          };
          update((d) => {
            d.reports.unshift(report);
            audit(d, { action: "Mempublikasikan laporan", entity: "report", entityId: report.id, detail: title });
            notify(d, { templeId, kind: "report_ready", title: "Laporan dipublikasikan", body: `${title} kini tampil di halaman publik pura.`, href: "/app/laporan" });
          });
          return report;
        },
        unpublishReport: (id) =>
          update((d) => {
            const r = d.reports.find((x) => x.id === id);
            d.reports = d.reports.filter((x) => x.id !== id);
            if (r) audit(d, { action: "Menarik laporan publik", entity: "report", entityId: id, detail: r.title });
          }),

        markNotificationRead: (id) => update((d) => d.notifications.forEach((n) => n.id === id && (n.read = true))),
        markAllNotificationsRead: () => {
          const { templeId } = ctx();
          update((d) => d.notifications.forEach((n) => n.templeId === templeId && (n.read = true)));
        },
        pushNotification: (n) => {
          const { templeId } = ctx();
          update((d) => notify(d, { ...n, templeId: n.templeId ?? templeId }));
        },

        updateTemple: (patch) => {
          const { templeId } = ctx();
          update((d) => {
            const t = d.temples.find((x) => x.id === templeId);
            if (!t) return;
            Object.assign(t, patch);
            audit(d, { action: "Mengubah pengaturan pura", entity: "settings", detail: Object.keys(patch).join(", ") });
          });
        },
        updateUser: (patch) => {
          const { user } = ctx();
          update((d) => {
            const u = d.users.find((x) => x.id === user?.id);
            if (u) Object.assign(u, patch);
          });
        },
        saveAccount: (a) => {
          const { templeId } = ctx();
          update((d) => {
            if (a.id) {
              const ex = d.accounts.find((x) => x.id === a.id)!;
              Object.assign(ex, a);
              audit(d, { action: "Mengubah kas/rekening", entity: "settings", detail: ex.name });
            } else {
              d.accounts.push({ ...a, id: uid("acc"), templeId } as Account);
              audit(d, { action: "Menambah kas/rekening", entity: "settings", detail: a.name });
            }
          });
        },
        saveCategory: (c) => {
          const { templeId } = ctx();
          update((d) => {
            if (c.id) Object.assign(d.categories.find((x) => x.id === c.id)!, c);
            else d.categories.push({ ...c, id: uid("c"), templeId } as Category);
            audit(d, { action: c.id ? "Mengubah kategori" : "Menambah kategori", entity: "settings", detail: c.name });
          });
        },
        inviteMember: ({ name, email, role }) => {
          const { templeId } = ctx();
          const d0 = get().data;
          let user = d0.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
          if (user && d0.memberships.some((m) => m.userId === user!.id && m.templeId === templeId))
            return { ok: false, error: "Pengguna ini sudah menjadi pengurus pura." };
          update((d) => {
            if (!user) {
              user = { id: uid("u"), name, callName: name.split(" ").slice(-1)[0], email: email.toLowerCase(), avatarColor: "#3F6FB5", createdAt: nowISO() };
              d.users.push(user);
            }
            d.memberships.push({ id: uid("m"), userId: user.id, templeId, role, status: "invited" });
            audit(d, { action: "Mengundang pengurus", entity: "user", detail: `${name} sebagai ${role}` });
          });
          return { ok: true, value: undefined };
        },
        changeMemberRole: (membershipId, role) =>
          update((d) => {
            const m = d.memberships.find((x) => x.id === membershipId);
            if (!m) return;
            m.role = role;
            const u = d.users.find((x) => x.id === m.userId);
            audit(d, { action: "Mengubah peran", entity: "user", detail: `${u?.name} → ${role}` });
          }),
        removeMember: (membershipId) => {
          const { user, templeId } = ctx();
          const d0 = get().data;
          const m = d0.memberships.find((x) => x.id === membershipId);
          if (!m) return { ok: false, error: "Tidak ditemukan." };
          if (m.userId === user?.id) return { ok: false, error: "Anda tidak dapat menghapus akses Anda sendiri." };
          const ketuaLeft = d0.memberships.filter((x) => x.templeId === templeId && x.role === "ketua" && x.id !== membershipId);
          if (m.role === "ketua" && ketuaLeft.length === 0) return { ok: false, error: "Pura harus memiliki minimal satu Ketua." };
          update((d) => {
            d.memberships = d.memberships.filter((x) => x.id !== membershipId);
            const u = d.users.find((x) => x.id === m.userId);
            audit(d, { action: "Mencabut akses", entity: "user", detail: u?.name ?? "" });
          });
          return { ok: true, value: undefined };
        },
        setTempleStatus: (templeId, status) =>
          update((d) => {
            const t = d.temples.find((x) => x.id === templeId);
            if (!t) return;
            t.status = status;
            audit(d, { action: status === "active" ? "Menyetujui pendaftaran pura" : "Menolak pendaftaran pura", entity: "settings", detail: t.name, templeId });
          }),
        setPreferences: (p) => set({ prefs: { ...get().prefs, ...p } }),

        resetData: () => set({ data: createSeed() }),
        replaceAll: ({ data, session }) => set({ data, session }),
      };
    },
    {
      name: STORAGE_KEY,
      version: SEED_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ data: s.data, session: s.session, prefs: s.prefs }),
      skipHydration: true,
      migrate: () => ({ data: createSeed(), session: null, prefs: defaultPrefs }) as unknown as StoreState,
      onRehydrateStorage: () => (state) => {
        if (state && state.data?.version !== SEED_VERSION) state.data = createSeed();
        useStore.setState({ hydrated: true });
      },
    }
  )
);

// ---------------------------------------------------------------------------
// Selectors / hooks
// ---------------------------------------------------------------------------

export function useHydrated() {
  return useStore((s) => s.hydrated);
}

export function useCurrentUser() {
  return useStore((s) => s.data.users.find((u) => u.id === s.session?.userId));
}

export function useActiveTemple() {
  return useStore((s) => s.data.temples.find((t) => t.id === s.session?.activeTempleId));
}

export function useMembership(): Membership | undefined {
  return useStore((s) =>
    s.data.memberships.find((m) => m.userId === s.session?.userId && m.templeId === s.session?.activeTempleId)
  );
}

export function useRole(): Role | undefined {
  const m = useMembership();
  const override = useStore((s) => s.session?.roleOverride);
  return override ?? m?.role;
}
