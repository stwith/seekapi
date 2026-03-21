import { defineConfig } from "@playwright/test";

/**
 * Playwright config for SeekAPI operator console E2E tests.
 *
 * Prerequisites:
 *   npx playwright install chromium
 *
 * The test suite starts both backend and frontend via webServer config.
 * Backend runs in-memory (no DATABASE_URL) on port 3044.
 * Frontend dev server runs on port 5174 and proxies /v1 to backend.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:5174",
    headless: true,
  },
  webServer: [
    {
      command:
        "ADMIN_API_KEY=test_admin_key ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000 PORT=3044 node --import=tsx ../src/app/server.ts",
      cwd: import.meta.dirname,
      port: 3044,
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
    {
      command: "VITE_API_PORT=3044 npx vite --port 5174 --strictPort",
      cwd: import.meta.dirname,
      port: 5174,
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
