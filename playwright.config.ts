import { defineConfig, devices } from "@playwright/test";

// End-to-end tests. They need a SEPARATE, throw-away database whose name contains "test" or
// "e2e" (it is wiped and filled with fictional demo data before every run):
//   E2E_DATABASE_URL=postgres://.../pura_e2e npm run test:e2e
const PORT = 3100;
const DB = process.env.E2E_DATABASE_URL ?? "";
// Second server on an EMPTY database, for the very first run: /setup → sign in → Back Office.
export const SETUP_PORT = 3101;
export const setupDbUrl = () => {
  if (process.env.E2E_SETUP_DATABASE_URL) return process.env.E2E_SETUP_DATABASE_URL;
  if (!DB) return "";
  const u = new URL(DB);
  u.pathname = `${u.pathname}_setup`;
  return u.toString();
};
// Test-only code for the /setup page of the empty test database (not a real secret).
export const E2E_SETUP_TOKEN = "kode-setup-khusus-tes-e2e-000000";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, ...devices["Pixel 7"], locale: "id-ID", timezoneId: "Asia/Makassar" },
  webServer: [
    {
      command: `npx next dev -p ${PORT}`,
      url: `http://localhost:${PORT}/api/health`,
      timeout: 180_000,
      reuseExistingServer: false,
      // Tests run against fictional demo data, so the server runs as a DEMO site (noindex, banner).
      env: { DATABASE_URL: DB, ADMIN_EMAIL: "admin@contoh.id", SMTP_HOST: "", APP_TIMEZONE: "Asia/Makassar", NEXT_PUBLIC_DEMO_MODE: "true" },
    },
    {
      command: `npx next dev -p ${SETUP_PORT}`,
      // Readiness check without the database: it is created by global-setup, which runs afterwards.
      url: `http://localhost:${SETUP_PORT}/robots.txt`,
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        DATABASE_URL: setupDbUrl(), ADMIN_EMAIL: "admin.baru@contoh.id", SETUP_TOKEN: E2E_SETUP_TOKEN, SMTP_HOST: "",
        APP_TIMEZONE: "Asia/Makassar", NEXT_DIST_DIR: ".next-e2e-setup",
      },
    },
  ],
});
