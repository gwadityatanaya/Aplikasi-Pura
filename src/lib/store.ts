"use client";

// App state. In normal use ("server" mode) the database on the server is the source of truth:
// every change is sent to /api/commands, which checks permissions, writes to the database,
// logs the action, and returns fresh data. "demo" mode runs the in-browser demo engine on
// fictional seed data and never touches the server.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  Account, Activity, AppNotification, Campaign, CampaignUpdate, Category, DataState, Donation, DonorPrivacy,
  MemberRole, Preferences, PublishedReport, Role, Session, Temple, Transaction, User,
} from "./types";
import { createSeed, SEED_VERSION } from "./seed";
import { demoActions } from "./demo-engine";
import type { PublicData } from "@/server/public";

export const STORAGE_KEY = "pura-state";

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

export type Result<T = undefined> = { ok: true; value: T } | { ok: false; error: string };
type R<T = undefined> = Promise<Result<T>>;
export type TempleInput = Omit<Temple, "id" | "slug" | "status" | "createdAt" | "transparency" | "branding" | "cover"> & { cover?: Temple["cover"] };
export type LinkResult = { link: string | null; hours?: number; existing?: boolean };

interface Actions {
  boot: () => Promise<void>;
  refresh: () => Promise<void>;
  loadPublic: (force?: boolean) => Promise<void>;
  enterDemo: (userId?: string) => void;
  exitDemo: () => Promise<void>;
  // session
  login: (email: string, password: string) => R;
  register: (input: { name: string; email: string; password: string }) => R;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => R;
  resetPassword: (token: string, password: string) => R;
  setupAdmin: (input: { token: string; name: string; email: string; password: string }) => R;
  changePassword: (current: string, next: string) => R;
  setActiveTemple: (templeId: string) => R;
  setRoleOverride: (role?: Role) => void;
  createTemple: (input: TempleInput, role: MemberRole) => R<Temple>;
  // ledger
  addTransaction: (input: TxInput, idempotencyKey: string) => R<Transaction>;
  updateDraft: (id: string, patch: Partial<TxInput>) => R;
  confirmDraft: (id: string) => R;
  deleteDraft: (id: string) => R;
  reverseTransaction: (id: string, reason: string) => R<Transaction>;
  saveActivity: (a: Omit<Activity, "id" | "templeId"> & { id?: string }) => R<Activity>;
  saveCampaign: (input: CampaignInput, status: "draft" | "active", id?: string) => R<Campaign>;
  setCampaignStatus: (id: string, status: Campaign["status"]) => R;
  addCampaignUpdate: (campaignId: string, u: Omit<CampaignUpdate, "id">) => R;
  addDonation: (input: DonationInput) => R<Donation>;
  submitPublicDonation: (input: Omit<DonationInput, "date" | "channel">) => R;
  verifyDonation: (id: string) => R<Transaction>;
  rejectDonation: (id: string, reason: string) => R;
  simulateDonation: (campaignId: string) => Donation | undefined;
  publishReport: (input: { title: string; from: string; to: string; note?: string }) => R<PublishedReport>;
  unpublishReport: (id: string) => R;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  pushNotification: (n: Omit<AppNotification, "id" | "date" | "read" | "templeId"> & { templeId?: string }) => void;
  updateTemple: (patch: Partial<Temple>) => R;
  updateUser: (patch: Partial<User>) => R;
  saveAccount: (a: Omit<Account, "id" | "templeId"> & { id?: string }) => R;
  saveCategory: (c: Omit<Category, "id" | "templeId"> & { id?: string }) => R;
  inviteMember: (input: { name: string; email: string; role: MemberRole }) => R<LinkResult>;
  changeMemberRole: (membershipId: string, role: MemberRole) => R;
  removeMember: (membershipId: string) => R;
  setTempleStatus: (templeId: string, status: Temple["status"]) => R;
  // Admin Utama
  adminCreateUser: (input: { name: string; email: string; templeId?: string; role?: MemberRole }) => R<LinkResult>;
  adminSetUserStatus: (userId: string, status: "active" | "disabled") => R;
  adminSetMembership: (userId: string, templeId: string, role: MemberRole | null) => R;
  adminResetLink: (userId: string) => R<LinkResult>;
  setPreferences: (p: Partial<Preferences>) => void;
  resetData: () => void;
}

export interface StoreState {
  mode: "server" | "demo";
  data: DataState;
  session: Session | null;
  /** Role computed by the server for the active temple */
  serverRole?: Role;
  registrationOpen: boolean;
  publicData: PublicData | null;
  prefs: Preferences;
  hydrated: boolean;
}

const defaultPrefs: Preferences = {
  textSize: "normal",
  reduceMotion: false,
  notifications: { donationPending: true, campaignTarget: true, campaignEnding: true, reportReady: true, approvals: true, weeklySummary: false },
};

export function emptyData(): DataState {
  return { version: 0, users: [], memberships: [], temples: [], accounts: [], categories: [], activities: [], transactions: [], campaigns: [], donations: [], reports: [], notifications: [], audit: [], counters: { tx: 0 }, resetRequests: [] };
}

interface ServerStatePayload {
  me: User;
  role?: Role;
  session: Session;
  data: DataState;
  registrationOpen: boolean;
}

async function api<T>(url: string, init?: { method?: string; body?: unknown }): Promise<{ status: number; json: T & { ok: boolean; error?: string } }> {
  try {
    const res = await fetch(url, {
      method: init?.method ?? (init?.body !== undefined ? "POST" : "GET"),
      headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({ ok: false, error: "Server tidak merespons dengan benar." }));
    return { status: res.status, json };
  } catch {
    return { status: 0, json: { ok: false, error: "Tidak ada koneksi internet. Periksa jaringan lalu coba lagi." } as T & { ok: boolean; error?: string } };
  }
}

export const useStore = create<StoreState & Actions>()(
  persist(
    (set, get) => {
      const demo = demoActions(() => get(), (p) => set(p));
      const isDemo = () => get().mode === "demo";
      const ok = <T,>(value: T): Result<T> => ({ ok: true, value });
      // Demo actions that return nothing still count as success.
      const wrapDemo = (_r: unknown): Result => ({ ok: true, value: undefined });

      const applyState = (s: ServerStatePayload | null) => {
        if (!s) {
          set({ data: emptyData(), session: null, serverRole: undefined });
          return;
        }
        set({ data: s.data, session: s.session, serverRole: s.role, registrationOpen: s.registrationOpen });
      };

      /** Sends one command to the server and applies the fresh state it returns. */
      const command = async <T,>(name: string, payload: unknown): Promise<Result<T>> => {
        const { status, json } = await api<{ value?: T; state?: ServerStatePayload | null }>("/api/commands", { body: { name, payload } });
        if (json.state !== undefined) applyState(json.state ?? null);
        if (status === 401) applyState(null);
        if (!json.ok) return { ok: false, error: json.error ?? "Gagal menyimpan." };
        return ok(json.value as T);
      };
      const authPost = async (url: string, body: unknown): Promise<Result> => {
        const { json } = await api(url, { body });
        if (!json.ok) return { ok: false, error: json.error ?? "Gagal." };
        return ok(undefined);
      };

      return {
        mode: "server",
        data: emptyData(),
        session: null,
        serverRole: undefined,
        registrationOpen: false,
        publicData: null,
        prefs: defaultPrefs,
        hydrated: false,

        async boot() {
          if (isDemo()) return set({ hydrated: true });
          await get().refresh();
          set({ hydrated: true });
        },
        async refresh() {
          if (isDemo()) return;
          const { json } = await api<{ state: ServerStatePayload | null; registrationOpen?: boolean }>("/api/state");
          if (json.ok) {
            applyState(json.state);
            if (!json.state) set({ registrationOpen: !!json.registrationOpen });
          }
        },
        async loadPublic(force) {
          if (isDemo() || (get().publicData && !force)) return;
          const { json } = await api<{ data: PublicData }>("/api/public");
          if (json.ok) set({ publicData: json.data });
        },
        enterDemo(userId = "u_made") {
          const seed = createSeed();
          const first = seed.memberships.find((m) => m.userId === userId);
          set({
            mode: "demo",
            data: seed,
            session: { userId, activeTempleId: first?.templeId ?? "t_durgandhini", startedAt: new Date().toISOString() },
            serverRole: undefined,
            hydrated: true,
          });
        },
        async exitDemo() {
          set({ mode: "server", data: emptyData(), session: null, publicData: null, hydrated: false });
          await get().boot();
        },

        // ---- session -------------------------------------------------------
        async login(email, password) {
          const r = await authPost("/api/auth/login", { email, password });
          if (r.ok) await get().refresh();
          return r;
        },
        async register(input) {
          const r = await authPost("/api/auth/register", input);
          if (r.ok) await get().refresh();
          return r;
        },
        async logout() {
          if (isDemo()) return get().exitDemo();
          await api("/api/auth/logout", { body: {} });
          applyState(null);
        },
        requestPasswordReset: (email) => authPost("/api/auth/forgot", { email }),
        async resetPassword(token, password) {
          const r = await authPost("/api/auth/reset", { token, password });
          if (r.ok) await get().refresh();
          return r;
        },
        async setupAdmin(input) {
          const r = await authPost("/api/setup", input);
          if (r.ok) await get().refresh();
          return r;
        },
        async changePassword(current, next) {
          if (isDemo()) return { ok: false, error: "Tidak tersedia di mode demo." };
          return command("changePassword", { current, next });
        },
        async setActiveTemple(templeId) {
          if (isDemo()) {
            demo.setActiveTemple(templeId);
            return ok(undefined);
          }
          return command("setActiveTemple", { templeId });
        },
        setRoleOverride: (role) => {
          if (isDemo()) demo.setRoleOverride(role);
        },
        async createTemple(input, role) {
          if (isDemo()) return ok(demo.createTemple(input, role));
          return command("createTemple", { ...input, role });
        },

        // ---- data ----------------------------------------------------------
        addTransaction: async (input, key) => (isDemo() ? demo.addTransaction(input, key) : command("addTransaction", { input, key })),
        updateDraft: async (id, patch) => (isDemo() ? demo.updateDraft(id, patch) : command("updateDraft", { id, patch })),
        confirmDraft: async (id) => (isDemo() ? demo.confirmDraft(id) : command("confirmDraft", { id })),
        deleteDraft: async (id) => (isDemo() ? demo.deleteDraft(id) : command("deleteDraft", { id })),
        reverseTransaction: async (id, reason) => (isDemo() ? demo.reverseTransaction(id, reason) : command("reverseTransaction", { id, reason })),
        saveActivity: async (a) => (isDemo() ? ok(demo.saveActivity(a)) : command("saveActivity", a)),
        saveCampaign: async (input, status, id) => (isDemo() ? ok(demo.saveCampaign(input, status, id)) : command("saveCampaign", { input, status, id })),
        setCampaignStatus: async (id, status) => (isDemo() ? wrapDemo(demo.setCampaignStatus(id, status)) : command("setCampaignStatus", { id, status })),
        addCampaignUpdate: async (campaignId, u) => (isDemo() ? wrapDemo(demo.addCampaignUpdate(campaignId, u)) : command("addCampaignUpdate", { campaignId, u })),
        addDonation: async (input) => (isDemo() ? demo.addDonation(input) : command("addDonation", input)),
        async submitPublicDonation(input) {
          if (isDemo()) {
            const r = demo.addDonation({ ...input, date: new Date().toISOString().slice(0, 10), channel: "transfer" });
            return r.ok ? ok(undefined) : r;
          }
          const r = await authPost("/api/public/donations", input);
          return r;
        },
        verifyDonation: async (id) => (isDemo() ? demo.verifyDonation(id) : command("verifyDonation", { id })),
        rejectDonation: async (id, reason) => (isDemo() ? demo.rejectDonation(id, reason) : command("rejectDonation", { id, reason })),
        simulateDonation: (campaignId) => (isDemo() ? demo.simulateDonation(campaignId) : undefined),
        publishReport: async (input) => (isDemo() ? ok(demo.publishReport(input)) : command("publishReport", input)),
        unpublishReport: async (id) => (isDemo() ? wrapDemo(demo.unpublishReport(id)) : command("unpublishReport", { id })),
        markNotificationRead: (id) => (isDemo() ? demo.markNotificationRead(id) : void command("markNotificationRead", { id })),
        markAllNotificationsRead: () => (isDemo() ? demo.markAllNotificationsRead() : void command("markAllNotificationsRead", {})),
        pushNotification: (n) => {
          if (isDemo()) demo.pushNotification(n);
        },
        updateTemple: async (patch) => (isDemo() ? wrapDemo(demo.updateTemple(patch)) : command("updateTemple", patch)),
        updateUser: async (patch) => (isDemo() ? wrapDemo(demo.updateUser(patch)) : command("updateUser", patch)),
        saveAccount: async (a) => (isDemo() ? wrapDemo(demo.saveAccount(a)) : command("saveAccount", a)),
        saveCategory: async (c) => (isDemo() ? wrapDemo(demo.saveCategory(c)) : command("saveCategory", c)),
        async inviteMember(input) {
          if (isDemo()) {
            const r = demo.inviteMember(input);
            return r.ok ? ok({ link: null }) : r;
          }
          return command("inviteMember", input);
        },
        changeMemberRole: async (id, role) => (isDemo() ? wrapDemo(demo.changeMemberRole(id, role)) : command("changeMemberRole", { membershipId: id, role })),
        removeMember: async (id) => (isDemo() ? demo.removeMember(id) : command("removeMember", { membershipId: id })),
        setTempleStatus: async (templeId, status) => (isDemo() ? wrapDemo(demo.setTempleStatus(templeId, status)) : command("setTempleStatus", { templeId, status })),
        adminCreateUser: async (input) => (isDemo() ? { ok: false, error: "Tidak tersedia di mode demo." } : command("adminCreateUser", input)),
        adminSetUserStatus: async (userId, status) => (isDemo() ? { ok: false, error: "Tidak tersedia di mode demo." } : command("adminSetUserStatus", { userId, status })),
        adminSetMembership: async (userId, templeId, role) => (isDemo() ? { ok: false, error: "Tidak tersedia di mode demo." } : command("adminSetMembership", { userId, templeId, role })),
        adminResetLink: async (userId) => (isDemo() ? { ok: false, error: "Tidak tersedia di mode demo." } : command("adminResetLink", { userId })),
        setPreferences: (p) => set({ prefs: { ...get().prefs, ...p } }),
        resetData: () => {
          if (isDemo()) get().enterDemo(get().session?.userId);
        },
      };
    },
    {
      name: STORAGE_KEY,
      version: SEED_VERSION,
      storage: createJSONStorage(() => localStorage),
      // Real (server) data is never stored on the device — only preferences and demo data.
      partialize: (s) => (s.mode === "demo" ? { prefs: s.prefs, mode: s.mode, data: s.data, session: s.session } : { prefs: s.prefs, mode: s.mode }) as unknown as StoreState & Actions,
      skipHydration: true,
      migrate: (persisted) => ({ prefs: (persisted as Partial<StoreState>)?.prefs ?? defaultPrefs, mode: "server" }) as unknown as StoreState & Actions,
      onRehydrateStorage: () => () => {
        useStore.getState().boot();
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

export function useMembership() {
  return useStore((s) => s.data.memberships.find((m) => m.userId === s.session?.userId && m.templeId === s.session?.activeTempleId));
}

export function useIsDemo() {
  return useStore((s) => s.mode === "demo");
}

export function useRole(): Role | undefined {
  const membership = useMembership();
  const user = useCurrentUser();
  const mode = useStore((s) => s.mode);
  const serverRole = useStore((s) => s.serverRole);
  const override = useStore((s) => s.session?.roleOverride);
  if (mode === "server") return serverRole;
  if (override) return override;
  if (user?.isSuperAdmin) return "superadmin";
  return membership?.role;
}
