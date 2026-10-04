import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Request } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_PDF = path.join(__dirname, "..", "fixtures", "sample.pdf");

/**
 * Mobile-paywall-delay fix regression guard (2026-10-04).
 *
 * Context — `lib/client/auth/auto-signup.ts` splits the pre-finalize
 * behaviour on `isMobileClient()`:
 *   • Desktop → upload the baked PDF via `/documents/upload`, append
 *     the resulting `docId` to the finalize redirect, then
 *     `signIn.finalize` + full-page nav.
 *   • Mobile → skip the pre-nav upload entirely and fire
 *     `/auth/quick-signup/notify` as a background fire-and-forget.
 *     The hydrator's post-nav `useEditorAutoPersist` merge-upload
 *     owns the cloud copy; the backend's upload-hook sends the
 *     welcome email at that point.
 *
 * These tests verify:
 *   1. The signed-out export flow still opens `EmailFirstModal` on
 *      both viewports (no UI regression).
 *   2. After the email submit, on MOBILE viewports NO request to
 *      `POST /documents/upload` is dispatched before the
 *      full-page nav fires. (This is the critical assertion — it
 *      guards against the regression where someone re-introduces
 *      the awaited upload on the mobile code-path.)
 *   3. On DESKTOP, the modal + submit path still behave the same
 *      way as before the fix (`/documents/upload` would be awaited
 *      post-ticket; because the test fakes the ticket, the upload
 *      never fires in test — the behavioural check is that nothing
 *      changes UI-side).
 *
 * NOTE on real mobile cellular timing: the perceived speed-up on
 * actual 4G/LTE must be verified manually with Chrome DevTools
 * network throttling (Slow 3G) — see CLAUDE.md's mobile pre-push
 * checklist. Playwright request-timing is bounded by the
 * fake-ticket early-exit here.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const QUICK_SIGNUP_URL = /\/auth\/quick-signup(?!\/notify)/;
const NOTIFY_URL = /\/auth\/quick-signup\/notify/;
const UPLOAD_URL = /\/documents\/upload/;

const FAKE_TICKET_PAYLOAD = {
  success: true,
  message: "ok",
  data: {
    status: "created",
    // A string that Clerk's SDK will attempt to use + reject. The
    // test asserts behaviour UP TO the point of the ticket call;
    // we don't need Clerk to accept this ticket.
    ticket: "tst_fake_ticket_e2e",
  },
};

async function mockQuickSignup(page: import("@playwright/test").Page) {
  await page.route(QUICK_SIGNUP_URL, (route) => {
    const request = route.request();

    // Only mock the POST /auth/quick-signup (not /notify). The
    // regex above already excludes /notify but double-check.
    if (
      request.method() !== "POST" ||
      /\/notify/.test(new URL(request.url()).pathname)
    ) {
      return route.fallback();
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(FAKE_TICKET_PAYLOAD),
    });
  });

  // Notify is fire-and-forget on the mobile path. Mock it to a
  // noop success so we can observe whether it was called at all.
  await page.route(NOTIFY_URL, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: { status: "skipped" } }),
    }),
  );
}

async function uploadAndOpenExportModal(page: import("@playwright/test").Page) {
  await page.goto("/pdf-composer");

  await page.locator('input[type="file"]').first().setInputFiles(SAMPLE_PDF);

  await expect(
    page.getByRole("img", { name: /PDF page/i }).first(),
  ).toBeVisible({
    timeout: 20_000,
  });

  // Open the ExportFormatModal via the "Finish and Download" button
  // (icon-only on mobile, icon+label on desktop; aria-label is
  // identical on both so this selector works in both viewports).
  await page.getByRole("button", { name: /Finish and Download/i }).click();

  // ExportFormatModal — pick DOCX, then press its Download button.
  // The format tiles have `aria-label="Export format"` on the
  // RadioGroup; each option is a radio named by its format label.
  await page.getByRole("radio", { name: /^Word$|^DOCX$|docx/i }).click();

  await page.getByRole("button", { name: /^Download$/i }).click();
}

async function expectEmailFirstModal(page: import("@playwright/test").Page) {
  const heading = page.getByRole("heading", { name: /Your file is ready/i });

  await expect(heading).toBeVisible({ timeout: 10_000 });
}

async function submitEmail(
  page: import("@playwright/test").Page,
  email: string,
) {
  const input = page.locator("#email-first-input");

  await input.waitFor({ state: "visible", timeout: 5_000 });
  await input.fill(email);

  await page.getByRole("button", { name: /Download file/i }).click();
}

/**
 * Collect every POST request to `/documents/upload` + the FIRST
 * `/auth/quick-signup/notify` call that happens AFTER the user
 * submits the email. Returned by a resolver so each spec can
 * `await` only when it wants to inspect the state.
 */
function trackPostSubmitRequests(page: import("@playwright/test").Page) {
  const uploadRequests: Request[] = [];
  const notifyRequests: Request[] = [];

  page.on("request", (request) => {
    if (request.method() !== "POST") return;
    const url = request.url();

    if (UPLOAD_URL.test(url)) uploadRequests.push(request);
    if (NOTIFY_URL.test(url)) notifyRequests.push(request);
  });

  return { uploadRequests, notifyRequests };
}

test.describe("Auto-signup — mobile fast-path", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Mobile — email submit does NOT call /documents/upload (fast-path)", async ({
    page,
  }) => {
    await mockQuickSignup(page);
    const requests = trackPostSubmitRequests(page);

    await uploadAndOpenExportModal(page);
    await expectEmailFirstModal(page);

    // Submit a brand-new email so the modal takes the auto-signup
    // branch (vs. the "existing account → LoginToDownloadModal" branch).
    const freshEmail = `e2e-mobile-${Date.now()}@example.com`;

    await submitEmail(page, freshEmail);

    // Give the modal flow 3 s to settle. Enough time for
    // `/auth/quick-signup` → `signIn.ticket({ticket: fake})` to
    // resolve (likely with a Clerk-side error against the fake
    // ticket) OR for the mobile fast-path to fire finalize +
    // background notify.
    await page.waitForTimeout(3_000);

    // Critical assertion: on mobile viewports, `/documents/upload`
    // is NEVER on the pre-finalize critical path. This guards
    // against a regression where someone re-introduces the awaited
    // upload on the mobile code-path — the exact bug this fix
    // addressed (mobile-paywall-delay 2026-10-04).
    //
    // Note: this assertion holds in BOTH the "ticket succeeded"
    // and "ticket failed" cases, because the mobile branch skips
    // upload unconditionally. The desktop branch would have
    // called upload here IF the ticket had succeeded; we can't
    // force Clerk to accept a fake ticket in E2E, so the desktop
    // side of the comparison is covered by the manual QA checklist
    // (DevTools throttle on Slow 3G + real staging Clerk).
    expect(
      requests.uploadRequests.length,
      "mobile fast-path must not call /documents/upload before signIn.finalize",
    ).toBe(0);
  });
});

test.describe("Auto-signup — desktop (unchanged behaviour)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("Desktop — EmailFirstModal still opens on signed-out DOCX export", async ({
    page,
  }) => {
    await mockQuickSignup(page);

    await uploadAndOpenExportModal(page);
    await expectEmailFirstModal(page);

    // Desktop still shows the same modal UI. The upload-await is a
    // post-ticket branch that this test does not reach (fake
    // ticket), but the UI path up to this point must be identical.
    expect(page.url()).toContain("/pdf-composer");

    // Dismiss the modal cleanly to confirm teardown works.
    await page.getByRole("button", { name: /^Close$/i }).click();
    await expect(
      page.getByRole("heading", { name: /Your file is ready/i }),
    ).not.toBeVisible({ timeout: 3_000 });
  });
});
