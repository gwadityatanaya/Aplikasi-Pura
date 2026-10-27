import { defineConfig, devices } from "@playwright/test";

// End-to-end tests. They need a SEPARATE, throw-away database whose name contains "test" or
// "e2e" (it is wiped and filled with fictional demo data before every run):
//   E2E_DATABASE_URL=postgres://.../pura_e2e npm run test:e2e
const PORT = 3100;
const DB = process.env.E2E_DATABASE_URL ?? "";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, ...devices["Pixel 7"], locale: "id-ID", timezoneId: "Asia/Makassar" },
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: { DATABASE_URL: DB, ADMIN_EMAIL: "admin@contoh.id", SMTP_HOST: "", APP_TIMEZONE: "Asia/Makassar" },
  },
});
