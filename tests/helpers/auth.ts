import { test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_STATE = path.join(__dirname, "..", ".auth", "user.json");

/**
 * Call inside a test that needs an authenticated browser session. If the
 * Clerk test user hasn't been set up yet (tests/.auth/user.json missing),
 * the test is marked as `skip` so the report shows it pending rather than
 * "failed".
 */
export function skipIfUnauthenticated() {
  test.skip(
    !fs.existsSync(STORAGE_STATE),
    "Auth-gated test — run sign-in setup first (see tests/auth.setup.ts and README).",
  );
}
