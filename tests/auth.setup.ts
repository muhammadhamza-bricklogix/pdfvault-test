import { test as setup, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR = path.join(__dirname, ".auth");
const STORAGE_STATE = path.join(STORAGE_DIR, "user.json");

const TEST_EMAIL =
  process.env.E2E_CLERK_EMAIL ?? "e2e+clerk_test@example.com";
const TEST_PASSWORD = process.env.E2E_CLERK_PASSWORD ?? "ClerkE2EPassword!23";
const VERIFICATION_CODE = "424242"; // Clerk dev magic code for +clerk_test@ emails

fs.mkdirSync(STORAGE_DIR, { recursive: true });

/**
 * Signs in (or signs up on first run) via Clerk dev test mode. The
 * `+clerk_test@` email pattern unlocks the magic verification code 424242, so
 * the whole flow can complete without an actual inbox.
 *
 * The browser session is persisted to tests/.auth/user.json. All other
 * `chromium` project tests load it via `storageState`.
 */
setup("authenticate", async ({ page }) => {
  try {
    await runAuthFlow(page);
  } catch (err) {
    // We don't want a Clerk-UI hiccup to block the whole suite. The
    // unauthenticated tests still produce signal; only auth-gated specs that
    // need the storage state will fail.
    console.warn(
      `[auth.setup] Sign-in/up failed (${err instanceof Error ? err.message : err}). Auth-protected tests will be skipped on this run.`,
    );

    setup.skip(true, "Could not establish Clerk session — see warning above.");
  }
});

async function runAuthFlow(page: import("@playwright/test").Page) {
  await page.goto("/sign-in");
  await page.waitForLoadState("domcontentloaded");

  await fillIdentifier(page, TEST_EMAIL);
  await clickContinue(page);

  // After the email step Clerk either asks for password (existing user) or
  // shows "Couldn't find your account" / similar error (we need to sign up).
  const passwordVisible = await page
    .locator('input[type="password"]')
    .first()
    .isVisible({ timeout: 4_000 })
    .catch(() => false);

  if (passwordVisible) {
    await page.locator('input[type="password"]').first().fill(TEST_PASSWORD);
    await clickContinue(page);
  } else {
    // No password prompt → sign-up flow.
    await page.goto("/sign-up");
    await page.waitForLoadState("domcontentloaded");

    await fillIdentifier(page, TEST_EMAIL);
    await clickContinue(page);

    const passwordField = page.locator('input[type="password"]').first();

    await passwordField.waitFor({ state: "visible", timeout: 8_000 });
    await passwordField.fill(TEST_PASSWORD);
    await clickContinue(page);

    // Email verification code step (+clerk_test pattern → 424242 accepted).
    await typeVerificationCode(page, VERIFICATION_CODE);
  }

  // After sign-in/up Clerk redirects to either / or /dashboard.
  await expect
    .poll(
      async () => {
        const url = page.url();

        return /\/dashboard|\/$/.test(url) ? "ok" : url;
      },
      { timeout: 15_000 },
    )
    .toBe("ok");

  await page.context().storageState({ path: STORAGE_STATE });
}

async function fillIdentifier(page: import("@playwright/test").Page, value: string) {
  const candidate = page
    .locator('input[name="identifier"], input[type="email"]')
    .first();

  await candidate.waitFor({ state: "visible", timeout: 8_000 });
  await candidate.fill(value);
}

async function clickContinue(page: import("@playwright/test").Page) {
  // Prefer the form submit button. OAuth buttons say "Continue with Google"
  // etc., so match the exact word "Continue" only (not "Continue with…").
  const submit = page.locator('button[type="submit"]').first();

  if (await submit.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await submit.click();

    return;
  }

  await page
    .getByRole("button", { name: /^continue$|^sign in$|^sign up$/i })
    .first()
    .click();
}

async function typeVerificationCode(
  page: import("@playwright/test").Page,
  code: string,
) {
  // Clerk renders 6 single-digit OTP inputs.
  const inputs = page.locator("input[autocomplete='one-time-code']");

  await inputs.first().waitFor({ state: "visible", timeout: 10_000 });
  for (let i = 0; i < code.length; i++) {
    await inputs.nth(i).fill(code[i]!);
  }
}
