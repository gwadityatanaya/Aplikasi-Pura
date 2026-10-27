"use client";

// App state. The database on the server is the source of truth: every change is sent to
// /api/commands, which checks permissions, writes to the database, logs the action, and
// returns fresh data. Only display preferences are stored on the device.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  Account, Activity, Campaign, CampaignUpdate, Category, DataState, Donation, DonorPrivacy,
  MemberRole, Preferences, PublishedReport, Role, Session, Temple, Transaction, User,
} from "./types";
import type { PublicData } from "@/server/public";

export const STORAGE_KEY = "pura-state";
const STORAGE_VERSION = 5;

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

/** Punia typed in by a pengurus (cash, WhatsApp, or a transfer reported outside the app). */
export interface ManualPuniaInput {
  donorName: string;
  donorEmail?: string;
  amount: number;
  transferDate: string;
  anonymous: boolean;
  purpose: NonNullable<Donation["purpose"]>;
  channel: "tunai" | "whatsapp" | "transfer";
  activityId?: string;
  campaignId?: string;
  referenceNo?: string;
  evidence?: string;
  message?: string;
}

export type Result<T = undefined> = { ok: true; value: T } | { ok: false; error: string };
type R<T = undefined> = Promise<Result<T>>;

export interface Access {
  isSuperAdmin: boolean;
  /** Has any staff role (Pengurus Pura, Pengurus Banjar, Pemeriksa or Admin Utama) */
  isStaff: boolean;
  banjarIds: string[];
}

interface ServerStatePayload {
  me: User;
  role?: Role;
  access: Access;
  session: Session;
  data: DataState;
}

interface Actions {
  boot: () => Promise<void>;
  refresh: () => Promise<void>;
  loadPublic: (force?: boolean) => Promise<void>;
  /** Generic server command, for screens that need one without a dedicated wrapper. */
  run: <T = unknown>(name: string, payload?: unknown) => R<T>;
  requestEmailLink: (email: string, next?: string) => R<{ devLink?: string }>;
  consumeEmailLink: (token: string) => R<{ next?: string }>;
  setupAdmin: (input: { token: string; name: string; email: string }) => R;
  logout: () => Promise<void>;
  setActiveTemple: (templeId: string) => R;
  addTransaction: (input: TxInput, idempotencyKey: string) => R<Transaction>;
  updateDraft: (id: string, patch: Partial<TxInput>) => R;
  confirmDraft: (id: string) => R;
  deleteDraft: (id: string) => R;
  reverseTransaction: (id: string, reason: string) => R<Transaction>;
  saveActivity: (a: Omit<Activity, "id" | "templeId"> & { id?: string }) => R<Activity>;
  saveCampaign: (input: CampaignInput, status: "draft" | "active", id?: string) => R<Campaign>;
  setCampaignStatus: (id: string, status: Campaign["status"]) => R;
  addCampaignUpdate: (campaignId: string, u: Omit<CampaignUpdate, "id">) => R;
  addManualPunia: (input: ManualPuniaInput) => R<Donation>;
  verifyPunia: (ids: string[]) => R<{ verified: number; skipped: { id: string; reason: string }[] }>;
  rejectPunia: (id: string, reason: string) => R;
  publishReport: (input: { title: string; from: string; to: string; note?: string }) => R<PublishedReport>;
  unpublishReport: (id: string) => R;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  updateTemple: (patch: Partial<Temple>) => R;
  updateUser: (patch: Partial<User> & { emailDigest?: boolean }) => R;
  saveAccount: (a: Omit<Account, "id" | "templeId"> & { id?: string }) => R;
  saveCategory: (c: Omit<Category, "id" | "templeId"> & { id?: string }) => R;
  setPreferences: (p: Partial<Preferences>) => void;
}

export interface StoreState {
  data: DataState;
  session: Session | null;
  me: User | null;
  /** Role computed by the server for the active temple */
  serverRole?: Role;
  access: Access;
  publicData: PublicData | null;
  prefs: Preferences;
  hydrated: boolean;
}

const defaultPrefs: Preferences = {
  textSize: "normal",
  reduceMotion: false,
  notifications: { donationPending: true, campaignTarget: true, campaignEnding: true, reportReady: true, approvals: true, weeklySummary: false },
};
const noAccess: Access = { isSuperAdmin: false, isStaff: false, banjarIds: [] };

export function emptyData(): DataState {
  return {
    version: 0, users: [], memberships: [], temples: [], banjars: [], templeBanjars: [], banjarMembers: [], accounts: [], categories: [],
    activities: [], transactions: [], campaigns: [], donations: [], reports: [], notifications: [], audit: [], counters: { tx: 0 }, resetRequests: [],
  };
}

export async function api<T>(url: string, init?: { method?: string; body?: unknown }): Promise<{ status: number; json: T & { ok: boolean; error?: string } }> {
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
      const ok = <T,>(value: T): Result<T> => ({ ok: true, value });
      const applyState = (s: ServerStatePayload | null) => {
        if (!s) return set({ data: emptyData(), session: null, me: null, serverRole: undefined, access: noAccess });
        set({ data: s.data, session: s.session, me: s.me, serverRole: s.role, access: s.access });
      };
      /** Sends one command to the server and applies the fresh state it returns. */
      const command = async <T,>(name: string, payload: unknown): Promise<Result<T>> => {
        const { status, json } = await api<{ value?: T; state?: ServerStatePayload | null }>("/api/commands", { body: { name, payload } });
        if (json.state !== undefined) applyState(json.state ?? null);
        if (status === 401) applyState(null);
        if (!json.ok) return { ok: false, error: json.error ?? "Gagal menyimpan." };
        return ok(json.value as T);
      };

      return {
        data: emptyData(),
        session: null,
        me: null,
        serverRole: undefined,
        access: noAccess,
        publicData: null,
        prefs: defaultPrefs,
        hydrated: false,

        async boot() {
          await get().refresh();
          set({ hydrated: true });
        },
        async refresh() {
          const { json } = await api<{ state: ServerStatePayload | null }>("/api/state");
          if (json.ok) applyState(json.state);
        },
        async loadPublic(force) {
          if (get().publicData && !force) return;
          const { json } = await api<{ data: PublicData }>("/api/public");
          if (json.ok) set({ publicData: json.data });
        },
        run: (name, payload) => command(name, payload ?? {}),

        async requestEmailLink(email, next) {
          const { json } = await api<{ devLink?: string }>("/api/auth/email-link", { body: { email, next } });
          return json.ok ? ok({ devLink: json.devLink }) : { ok: false, error: json.error ?? "Gagal mengirim tautan." };
        },
        async consumeEmailLink(token) {
          const { json } = await api<{ next?: string }>("/api/auth/email-link/verify", { body: { token } });
          if (!json.ok) return { ok: false, error: json.error ?? "Tautan tidak berlaku." };
          await get().refresh();
          return ok({ next: json.next });
        },
        async setupAdmin(input) {
          const { json } = await api("/api/setup", { body: input });
          if (!json.ok) return { ok: false, error: json.error ?? "Gagal." };
          await get().refresh();
          return ok(undefined);
        },
        async logout() {
          await api("/api/auth/logout", { body: {} });
          applyState(null);
        },
        setActiveTemple: (templeId) => command("setActiveTemple", { templeId }),

        addTransaction: (input, key) => command("addTransaction", { input, key }),
        updateDraft: (id, patch) => command("updateDraft", { id, patch }),
        confirmDraft: (id) => command("confirmDraft", { id }),
        deleteDraft: (id) => command("deleteDraft", { id }),
        reverseTransaction: (id, reason) => command("reverseTransaction", { id, reason }),
        saveActivity: (a) => command("saveActivity", a),
        saveCampaign: (input, status, id) => command("saveCampaign", { input, status, id }),
        setCampaignStatus: (id, status) => command("setCampaignStatus", { id, status }),
        addCampaignUpdate: (campaignId, u) => command("addCampaignUpdate", { campaignId, u }),
        addManualPunia: (input) => command("addManualPunia", input),
        verifyPunia: (ids) => command("verifyPunia", { ids }),
        rejectPunia: (id, reason) => command("rejectPunia", { id, reason }),
        publishReport: (input) => command("publishReport", input),
        unpublishReport: (id) => command("unpublishReport", { id }),
        markNotificationRead: (id) => void command("markNotificationRead", { id }),
        markAllNotificationsRead: () => void command("markAllNotificationsRead", {}),
        updateTemple: (patch) => command("updateTemple", patch),
        updateUser: (patch) => command("updateUser", patch),
        saveAccount: (a) => command("saveAccount", a),
        saveCategory: (c) => command("saveCategory", c),
        setPreferences: (p) => set({ prefs: { ...get().prefs, ...p } }),
      };
    },
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),
      // Data from the server is never stored on the device — only display preferences.
      partialize: (s) => ({ prefs: s.prefs }) as unknown as StoreState & Actions,
      skipHydration: true,
      migrate: (persisted) => ({ prefs: (persisted as Partial<StoreState>)?.prefs ?? defaultPrefs }) as unknown as StoreState & Actions,
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
  return useStore((s) => s.me ?? undefined);
}

export function useActiveTemple() {
  return useStore((s) => s.data.temples.find((t) => t.id === s.session?.activeTempleId));
}

export function useMembership() {
  return useStore((s) => s.data.memberships.find((m) => m.userId === s.session?.userId && m.templeId === s.session?.activeTempleId));
}

export function useRole(): Role | undefined {
  return useStore((s) => s.serverRole);
}

export function useAccess() {
  return useStore((s) => s.access);
}

export type { MemberRole };
