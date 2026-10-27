# PURA — Kas & Dana Punia Pura yang Transparan

> *"Semudah menulis di buku, sekuat sistem keuangan modern."*

📘 **Panduan lengkap berbahasa Indonesia (setup, deploy, backup): [docs/PANDUAN.md](docs/PANDUAN.md)**

PURA is a mobile-first treasury and donation-transparency app for Hindu temples (Pura) in Indonesia. It has two experiences:

- **Public portal** (no login): homepage, temple directory, temple profiles, fundraising campaign pages, published financial reports.
- **Temple administration** (secure login): dashboard, transactions, activities, campaigns and donation verification, reports and exports, presentation mode, users and roles, settings, notifications, temple audit trail — plus an **Admin Utama** panel and an immutable **Log Aktivitas**.

## Quick start (local)

Requirements: **Node.js 18.18+** (20 LTS recommended) and a PostgreSQL database (free [Neon](https://neon.tech) project, or a local Postgres).

```bash
npm install
cp .env.example .env       # fill DATABASE_URL, ADMIN_EMAIL, SETUP_TOKEN
npm run db:migrate         # create tables + integrity guards
npm run dev                # http://localhost:3000 → open /setup once
```

| Script | What it does |
|---|---|
| `npm run db:migrate` | Creates/updates tables (safe to run repeatedly) |
| `npm run backup` | Full JSON backup incl. photos → `cadangan/` |
| `npm run restore -- <file>` | Restores a backup into an **empty** database |
| `npm run admin:reset` | Emergency one-time reset link for Admin Utama (requires DB access) |
| `npm run typecheck` / `npm run lint` | Checks |

Deploy: import the repo in Vercel and set the environment variables from `.env.example`. `vercel.json` runs migrations before every build. See the guide for click-by-click steps.

## Architecture (production)

- **Database:** PostgreSQL via Drizzle ORM (`src/server/db/schema.ts`, migrations in `drizzle/`). Works with Neon (pooled URL), Supabase or any Postgres.
- **API:** Next.js route handlers in `src/app/api`. Every change goes through `POST /api/commands`; each command validates input (Zod), checks the role server-side, runs in a DB transaction, and appends to the activity log in the same transaction.
- **Auth:** bcrypt (cost 12) password hashes; random session tokens stored only as SHA-256 in `sessions`, sent as `HttpOnly; SameSite=Lax; Secure` cookies; same-origin check on all POSTs; login throttling (5 failures/email or 20/IP per 15 min); one-time activation/reset links (stored hashed). No email service is required — admins share links via WhatsApp.
- **Admin Utama:** created only through `/setup`, which needs `SETUP_TOKEN` + `ADMIN_EMAIL` from the server environment and locks forever afterwards. Database triggers forbid deleting, demoting or disabling it, and a unique index allows only one.
- **Immutability (database triggers):** `activity_log` rejects UPDATE/DELETE/TRUNCATE; confirmed transactions cannot be edited or deleted (corrections are reversal entries).
- **Public data:** `/api/public` returns only what each temple has published; private donors are aggregated per campaign (no names or individual amounts); evidence images and messages never leave the server.
- **Attachments:** images are validated by magic bytes (JPEG/PNG/WEBP, no SVG), stored in Postgres, and served with access checks.
- **PWA:** `app/manifest.ts`, `public/sw.js` (never caches `/api/*`), offline page, install prompt.
- **Demo mode:** the original in-browser engine (`src/lib/demo-engine.ts`) runs on fictional seed data for presentations and never talks to the server.

---

## Tech stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn-style hand-written UI primitives (`src/components/ui`) · Lucide icons · Framer Motion · Recharts · React Hook Form + Zod · PostgreSQL + Drizzle ORM · bcryptjs · Zustand (client state; only preferences and demo data are kept in LocalStorage) · jsPDF + autotable (PDF) · SheetJS (Excel) · qrcode.react · Sonner (toasts).

> shadcn/ui is a copy-in component pattern, not a runtime dependency. The app uses its own small set of shadcn-style components (Button, Dialog/BottomSheet, Field, Switch, Segmented, Progress, Skeleton…) so it doesn't need the shadcn CLI or Radix.

## Project structure

```
src/
  app/
    (public)/            Public portal: /, /pura, /pura/[slug], /pura/[slug]/laporan/[id], /donasi, /donasi/[slug]
    (auth)/              /masuk, /daftar, /lupa-sandi, /atur-ulang-sandi, /keluar, /onboarding
    app/                 Admin (guarded): dashboard, transaksi, kegiatan, campaign, laporan,
                         presentasi, notifikasi, pengguna, audit, pengaturan, platform
  components/
    ui/                  Design-system primitives
    brand/               Logo, temple cover illustration (candi bentar / meru), patra pattern, dividers
    app/                 Admin shell (sidebar, bottom nav + FAB, switchers), transaction rows, forms
    public/              Public header/footer, donor list, donation feed, donation confirmation
    shared/              Campaign card, charts, share (WhatsApp, copy link, QR)
    demo/                Guided demo tour
  server/                Server only: db schema/client, auth, commands, public data, backup
  lib/
    types.ts             Domain model
    seed.ts              Fictional seed data (consistent ledger)
    ledger.ts            Pure accounting functions (balances, summaries, series)
    store.ts             Client state; sends every change to the server (or demo engine)
    permissions.ts       Role → permission matrix
    reports.ts           Seven report types → one document model
    demo-engine.ts       In-browser engine used only by demo mode
    export.ts            PDF / XLSX / CSV / Web Share
    format.ts            Rupiah and Indonesian date formatting, helpers
```

## Accounting rules (as implemented)

- **Balances are derived, never stored.** `balance = opening balance + Σ effect(confirmed entries)` (`lib/ledger.ts`). 
- **Drafts never affect totals.** Only `confirmed` entries count. Drafts can be edited, confirmed or deleted.
- **Confirmed entries are never edited or deleted.** Mistakes are fixed with a **reversal entry** (`reversalOf`), which cancels the original's effect. Both entries remain visible for audit.
- **Internal transfers** (cash → bank) change account balances but are excluded from income and expense.
- **Duplicate-submit protection.** Each form instance has an idempotency key, so a double tap returns the original entry instead of creating a second one.
- **Unique IDs** plus human-readable numbers (`TRX-2026-0042`).
- **Audit history.** Every significant action appends to an audit log (actor, action, detail, time).
- **Activities are reporting dimensions, not separate ledgers.** All money lives in one temple ledger, so nothing is double-counted. Activities are marked as **general** or **restricted** funds, and the dashboard shows how much of the balance is restricted.
- **Donations.** Only `verified` donations count toward campaign totals. Verifying creates **exactly one** linked income entry (idempotent: `donation:<id>`). Rejected donations never count.
- **Separate workspaces.** Each temple has its own accounts, categories, activities and ledger. One user can belong to several temples with different roles.

## Feature map

| Area | Where |
|---|---|
| Homepage, directory with search and location filter | `/`, `/pura` |
| Temple profile (contacts, campaigns, published summaries, reports, QR, bank info) | `/pura/[slug]` |
| Campaign page (animated progress, consent-aware donor list, activity feed, updates, WhatsApp, copy link, QR, donation confirmation, simulated donations) | `/donasi/[slug]` |
| Register → 3-step temple onboarding → new workspace | `/daftar`, `/onboarding` |
| Forgot/reset password (simulated link shown on screen) | `/lupa-sandi`, `/atur-ulang-sandi` |
| Dashboard (balance card, cash vs bank, restricted funds, quick actions, weekly/monthly/yearly chart, pending items) | `/app` |
| Step-by-step income/expense/transfer form with receipt upload and camera capture | `/app/transaksi/baru` |
| Transaction list (search, date/category/activity/account/status filters, sorting) and detail (receipt preview, confirm, correction, history) | `/app/transaksi` |
| Activities with budget usage and related transactions | `/app/kegiatan` |
| Campaign list, 4-step wizard, verification queue, manual donations, campaign updates, close/publish | `/app/campaign` |
| Reports: 7 types, presets and filters, PDF/Excel/CSV, WhatsApp text + Web Share PDF, publish snapshot to public | `/app/laporan` |
| Full-screen presentation (keyboard ←/→, F for fullscreen) | `/app/presentasi` |
| Users and roles with permission matrix, invitations | `/app/pengguna` |
| Settings: temple profile, my profile, categories, cash/bank accounts, notifications, transparency, security, report letterhead, appearance (large text, reduced motion) | `/app/pengaturan` |
| Notification center, audit log, platform admin | `/app/notifikasi`, `/app/audit`, `/app/platform` |

## Design notes

- **Palette:** emerald `#087F6D`, forest `#064E3B`, mint, warm ivory, gold accents. Body "muted" text is darkened to `#5F6B7A` (instead of `#718096`) to meet WCAG AA contrast on ivory.
- **Charts:** income/expense use emerald `#0A8A74` and amber `#E0904A`. This pair passed a colour-vision-deficiency check, which the brand red/green pair failed. Category distributions use ranked bars instead of pies.
- **Cultural elements:** an original candi-bentar / meru silhouette illustration, a patra-inspired lattice texture and gold ornament dividers, used sparingly.
- **Accessibility:** semantic landmarks, labelled controls, focus rings, focus-trapped dialogs, large touch targets, `prefers-reduced-motion` plus an in-app "Kurangi animasi" switch, and a large-text option.

## Demo mode

On the login page, **Coba mode demo** (or **Jalankan Demo** for the guided 11-step tour) loads fictional seed data in the browser only — handy for presentations. Exiting demo mode returns to the real data, which is never touched.
