import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const STORAGE_STATE = path.join(__dirname, "tests/.auth/user.json");
const hasStoredAuth = fs.existsSync(STORAGE_STATE);

/**
 * Critical-path E2E suite. Boots against an existing dev server (run
 * `bun run dev` before `bun run test:e2e`). Uses the locally installed
 * Chrome (channel: "chrome") so we don't have to download a Chromium build —
 * useful in restricted-network environments.
 *
 * Auth strategy:
 * - The `setup` project tries to sign in via Clerk dev test credentials and
 *   caches the storage state to tests/.auth/user.json. Once cached, all
 *   subsequent runs reuse it without re-authenticating.
 * - Unauthenticated specs (home, auth-gating, public editor) ignore the
 *   storage state by calling `test.use({ storageState: {...} })`.
 *
 * Reports:
 * - HTML report at `playwright-report/` (open with `bun run test:e2e:report`)
 * - JSON at `test-results/results.json`
 * - Markdown summary at `test-results/REPORT.md`
 *   (run `node scripts/playwright-report-md.mjs` after a run)
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [
    ["html", { open: "never" }],
    ["json", { outputFile: "test-results/results.json" }],
    ["list"],
  ],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Video disabled by default — requires ffmpeg. Run
    // `npx playwright install ffmpeg` and switch to "retain-on-failure" to
    // capture videos.
    video: "off",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
      },
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        // The new editor toolbar renders 21 tool buttons across floating pill
        // groups. At Playwright's default 1280x720 Desktop Chrome viewport the
        // leftmost (Select, Edit) and rightmost (Manage Pages) pills are
        // horizontally clipped and unreachable by click. 1920x1080 keeps the
        // full toolbar in viewport so functional tests can reach every tool.
        viewport: { width: 1920, height: 1080 },
        ...(hasStoredAuth ? { storageState: STORAGE_STATE } : {}),
      },
      // No dependency on setup — we want all unauthenticated tests to run
      // regardless of whether the Clerk test user exists yet. Auth-gated
      // tests will fail individually with a clear "not signed in" assertion
      // if the storage state is missing; that's the right signal.
    },
  ],
});
