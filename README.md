# PURA — Kas & Dana Punia Pura yang Transparan

> *"Semudah menulis di buku, sekuat sistem keuangan modern."*

📘 **Panduan lengkap berbahasa Indonesia (setup, Google, email, deploy, backup): [docs/PANDUAN.md](docs/PANDUAN.md)**
🗒️ **Keputusan yang masih terbuka & persiapan BDDN: [docs/KEPUTUSAN.md](docs/KEPUTUSAN.md)**

PURA is a mobile-first treasury and punia (donation) transparency app for Balinese Hindu temples. It **only records** — it never holds or moves money. Umat transfer by m-banking to the temple's official account and upload the proof; pengurus verify it against the bank statement. It replaces WhatsApp broadcasts of the temple's cash position.

## Roles

| Role | Scope |
|---|---|
| **Admin Utama** (one, protected by DB triggers) | Back Office: banjar, temples, temple bank accounts, staff (incl. changing a pengurus' email), Log Aktivitas, backups. Views every temple read-only (`admin_view`); changing a temple's records needs **Mode darurat** (reason required, 60 min, one temple, labelled in both logs) |
| **Pengurus Banjar** | Dashboard + sahkan / tolak / koreksi punia for every temple its banjar supports (`temple_banjars`), incl. temples without pengurus. No other ledger changes, no bank or user management |
| **Pengurus Pura** | Own temple(s): verification, manual punia, expenses, reports, public-view settings, Riwayat Audit Pura |
| **Pemeriksa** | Read-only for a temple |
| **Umat** | Self-registered; own punia history and account only |

Access is computed server-side in `src/server/context.ts` (`templeAccess`). Staff roles are only ever granted in the Back Office.

## Quick start (local)

Requirements: Node.js 20 LTS and PostgreSQL (free [Neon](https://neon.tech) or local).

```bash
npm install
cp .env.example .env              # DATABASE_URL, ADMIN_EMAIL, SETUP_TOKEN (SMTP optional locally)
npm run db:migrate                # tables + integrity triggers
npm run db:seed-demo -- --ya      # optional: fictional demo data (empty DB only)
npm run dev                       # http://localhost:3000 → /setup once
```

Email (SMTP) and Google are both optional: `/api/auth/options` tells the login page what to show. Without SMTP the email-link button is hidden and the digest is off; in development the link is shown on screen instead. Set `NEXT_PUBLIC_DEMO_MODE=true` only on the demo deployment: it shows a "SITUS DEMO" banner and keeps the site out of search engines (`robots.txt`, `noindex` meta, `X-Robots-Tag`).

| Script | What it does |
|---|---|
| `npm run db:migrate` | Creates/updates tables (idempotent) |
| `npm run db:seed-demo -- --ya` | Fictional data: 2 banjar, 6 temples (one shared, one without pengurus), staff, umat. Refuses a non-empty DB |
| `npm run db:reset-demo -- --ya-hapus-data-demo` | Wipes and re-seeds the DEMO database. Refuses if any temple name does not start with "CONTOH " |
| `npm run test:e2e` | Playwright end-to-end tests. Needs `E2E_DATABASE_URL` pointing to a throw-away DB whose name contains `test`/`e2e` |
| `npm run backup` / `npm run restore -- <file>` | Full JSON backup incl. photos / restore into an empty DB |
| `npm run admin:reset` | Emergency one-time sign-in link for Admin Utama (requires DB access) |
| `npm run typecheck` / `npm run lint` | Checks |

Deploy: import the repo in Vercel, set the variables from `.env.example`. `vercel.json` runs migrations before every build and schedules the daily digest cron.

## Architecture

- **Database:** PostgreSQL via Drizzle ORM (`src/server/db/schema.ts`, migrations in `drizzle/`).
- **API:** every change goes through `POST /api/commands` (`src/server/registry.ts` → `commands*.ts`): Zod validation, server-side role check, one DB transaction, activity-log row in the same transaction.
- **Sign-in:** Google OAuth (authorization code + PKCE, `id_token` claims checked) or a one-time email link (hashed token, 15 min, consumed by POST so mail scanners can't burn it). Email via SMTP (Brevo recommended). Emails are matched case-insensitively. Session tokens are stored only as SHA-256; `HttpOnly; SameSite=Lax; Secure` cookies; same-origin check on POSTs; sign-in throttling and lockout.
- **Database triggers:**
  - `activity_log` is append-only;
  - Admin Utama cannot be deleted/demoted/disabled, and only one may exist;
  - confirmed transactions are immutable (the only allowed change is anonymising a punia entry when its donor deletes their account);
  - `pura_guard_donation`: a punia cannot be verified by its own submitter (by user id or email); verified punia cannot change amount/status/temple/date, may only become more private, and a correction (`corrected_at`) can never be undone. Corrections are made with a reversal entry (`correctPunia`).
- **Names:** the permanent Log Aktivitas and notifications never contain donor names. "dicatat oleh" (`inputByName`) is added for staff only; Pemeriksa see "Anonim". The punia report has a shareable version (Anonim) and an internal full version.
- **Public data:** built only in `src/server/public.ts`. Anonymous donors become "Anonim" on the server; real names, emails, messages and proofs never leave it. Per-temple toggles for balance, recent transactions and punia list.
- **Attachments:** magic-byte validated images stored in Postgres, served with access checks (temple staff, related Pengurus Banjar, Admin Utama, or the uploader).
- **Duplicates:** same file hash, or same amount + date + reference, is refused; same amount + date is flagged for pengurus.
- **Digest:** `/api/cron/digest` (Vercel Cron, daily, `CRON_SECRET`) emails each pengurus at most once a day when punia are waiting.
- **PWA:** `app/manifest.ts`, `public/sw.js` (never caches `/api/*`), offline page, `/pasang` install guide.

## Main routes

| Who | Routes |
|---|---|
| Public | `/`, `/pura`, `/pura/[slug]`, `/pura/[slug]/laporan/[id]`, `/donasi/[slug]`, `/pasang`, `/kebijakan-privasi` |
| Umat | `/umat`, `/umat/punia`, `/umat/akun`, `/pura/[slug]/punia` |
| Auth | `/masuk`, `/masuk/tautan`, `/setup`, `/keluar` |
| Staff | `/app` (dashboard), `/app/punia` (verification + manual input), `/app/banjar`, `/app/transaksi`, `/app/kegiatan`, `/app/campaign`, `/app/laporan`, `/app/presentasi`, `/app/pengguna`, `/app/audit`, `/app/pengaturan`, `/app/notifikasi` |
| Admin Utama | `/app/admin` (Back Office), `/app/log-aktivitas` |

## Accounting rules

- Balances are derived (`opening balance + Σ confirmed entries`), never stored.
- Confirmed entries are never edited or deleted; mistakes are fixed with reversal entries.
- Verifying a punia creates exactly one income entry (idempotent key `donation:<id>`), categorised by purpose (umum / odalan / pembangunan / lainnya).
- Activities and campaigns are reporting dimensions on one temple ledger, so nothing is double-counted.

## Tech stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · hand-written shadcn-style UI · Lucide · Framer Motion · Recharts · React Hook Form + Zod · PostgreSQL + Drizzle ORM · nodemailer · Zustand (only display preferences persist on the device) · jsPDF + autotable · SheetJS · Playwright.
