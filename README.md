# PURA — Kas & Dana Punia Pura yang Transparan

> *"Semudah menulis di buku, sekuat sistem keuangan modern."*

PURA is an interactive, mobile-first **prototype** of a treasury and donation-transparency platform for Hindu temples (Pura) in Indonesia. It has two experiences:

- **Public portal** (no login): homepage, temple directory, temple profiles, fundraising campaign pages, published financial reports.
- **Temple administration** (simulated login): dashboard, transactions, activities, campaigns and donation verification, reports and exports, presentation mode, users and roles, settings, notifications, audit log.

> ⚠️ **Prototype only.** All names, temples (except the example name *Pura Dalem Durgandhini*), bank accounts and amounts are fictional. Authentication is simulated in the browser. **No payments are processed.** See [Prototype boundaries](#prototype-boundaries).

---

## Quick start

Requirements: **Node.js 18.18+** (tested on Node 22) and npm.

```bash
npm install
npm run dev          # http://localhost:3000
```

Production build:

```bash
npm run build
npm start            # http://localhost:3000
```

Other scripts: `npm run lint`, `npm run typecheck`.

No environment variables, API keys or external services are needed. Fonts are bundled via `@fontsource`, so the app also runs offline.

### Try it

1. Open `/` and press **Jalankan Demo** for an 11-step guided walkthrough. It runs on a separate copy of the seed data. Exiting restores your own data.
2. Or go to **Masuk** (`/masuk`) and tap a demo account. Any password of 6+ characters works, and passwords are never stored.

| Account | Role |
|---|---|
| `made@pura.demo` — I Made Wirata ("Pak Made") | Ketua Pengempon (chairperson); also Bendahara of a second temple |
| `ayu@pura.demo` — Ni Ketut Ayu Rahayu | Bendahara (treasurer) |
| `wayan@pura.demo` — I Wayan Sudiarta | Sekretaris (can only create drafts) |
| `nyoman@pura.demo` — I Nyoman Gede Artha | Auditor (read-only + audit log) |
| `admin@pura.demo` — Tim Platform PURA | Platform admin (temple registrations) |

From the profile menu you can also preview any role (**Lihat aplikasi sebagai peran**) or **reset the demo data**.

---

## Tech stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn-style hand-written UI primitives (`src/components/ui`) · Lucide icons · Framer Motion · Recharts · React Hook Form + Zod · Zustand (persisted to LocalStorage) · jsPDF + autotable (PDF) · SheetJS (Excel) · qrcode.react · Sonner (toasts).

> shadcn/ui is a copy-in component pattern, not a runtime dependency. The prototype uses its own small set of shadcn-style components (Button, Dialog/BottomSheet, Field, Switch, Segmented, Progress, Skeleton…) so it doesn't need the shadcn CLI or Radix.

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
  lib/
    types.ts             Domain model
    seed.ts              Fictional seed data (consistent ledger)
    ledger.ts            Pure accounting functions (balances, summaries, series)
    store.ts             Zustand store + all actions (single source of truth)
    permissions.ts       Role → permission matrix
    reports.ts           Seven report types → one document model
    export.ts            PDF / XLSX / CSV / Web Share
    format.ts            Rupiah and Indonesian date formatting, helpers
```

## Accounting rules (as implemented)

- **Balances are derived, never stored.** `balance = opening balance + Σ effect(confirmed entries)` (`lib/ledger.ts`). The dashboard's Rp17.250.000 comes from 1 January 2026 opening balances plus about 120 seed transactions for that temple.
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

## Prototype boundaries

What this prototype **does not** do, and what production would need:

| Prototype | Production requirement |
|---|---|
| Mock sessions in LocalStorage; any password accepted; no passwords stored | Server-side auth (hashed passwords / OTP via WhatsApp), secure HTTP-only sessions, 2FA |
| Role checks run in the browser | Authorization enforced on the server for every request |
| Data lives in this browser's LocalStorage (one device) | Server database with backups, multi-device sync, server-side append-only audit log |
| Donations are entered manually or **simulated** (clearly tagged "Simulasi") | Optional payment-gateway / bank-mutation integration with reconciliation |
| Password-reset email is simulated (link shown on screen) | Real email/WhatsApp delivery |
| WhatsApp share sends **text only** via `wa.me`. PDF sharing uses the Web Share API where supported, otherwise the PDF is downloaded for manual attachment | Same, or a hosted report link |
| Receipt uploads accept images only (compressed in-browser); seed receipts are illustrative SVGs | Object storage, PDF support, virus scanning |
| Weekly WhatsApp summary and 2FA are shown as "not yet available" | Implement |

Reset all prototype data at any time from **Profil → Atur ulang data demo** or **Pengaturan → Tampilan**.
