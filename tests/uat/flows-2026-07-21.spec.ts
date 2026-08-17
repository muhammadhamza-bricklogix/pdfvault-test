import { expect, test } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * UAT spec — verifies the user-signed flows in
 * `public/PDFVault.ai User Flow & Pricing.pdf` (20 Jul 2026).
 *
 * Row-per-flow coverage:
 *   Row 1  — Landing PDF drop → composer opens (Flow 2 start).
 *   Row 2  — Composer edit → Download PDF → sign-in modal → cancel/confirm.
 *   Row 3  — Composer edit → Download DOCX → sign-in modal.
 *   Row 4  — /convert/word-to-pdf drop → sign-in modal at upload
 *            (Flow 1, gate BEFORE conversion — this branch's fix).
 *   Row 5  — /convert/pdf-to-word drop → sign-in modal at upload
 *            (Flow 1 alignment — this branch's fix flipped this from
 *            the old composer-preview behavior).
 *   Row 6  — Extract Images tile → drop PDF → click Extract → sign-in.
 *   Row 7  — Compress tile → drop PDF → click Compress → sign-in.
 *   Rows 8–9 — Signed-in unentitled + entitled flows.
 *              **Not automated here.** Clerk auth cache is required
 *              and the paywall iframe cannot be driven from CI.
 *              Documented as manual rows in the accompanying
 *              docs/uat/flows-2026-07-21.md report.
 *   Rows 10–11 — Pricing check ($0.99 / $24.99).
 *              **Manual DevTools step** — inspect
 *              `POST /billing/checkout-intent` response body while the
 *              paywall is open. Frontend already renders whatever the
 *              intent returns, so this is a backend verification, not
 *              a UI one.
 *
 * All automated rows run signed-out (`storageState: { cookies: [], origins: [] }`).
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_PDF = path.join(__dirname, "..", "fixtures", "sample.pdf");
const SAMPLE_DOCX = path.join(__dirname, "..", "fixtures", "sample.docx");

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("UAT — flows-2026-07-21 (guest)", () => {
  test("Row 1 — Landing PDF drop opens the composer (Flow 2 entry)", async ({
    page,
  }) => {
    await page.goto("/pdf-composer");
    await page.locator('input[type="file"]').first().setInputFiles(SAMPLE_PDF);

    await expect(
      page.getByRole("img", { name: /PDF page/i }).first(),
    ).toBeVisible({ timeout: 20_000 });

    // No paywall / sign-in modal on entry — Flow 2 is free-edit until
    // the user tries to download.
    await expect(
      page.getByRole("heading", { name: /Sign in to download/i }),
    ).not.toBeVisible();
  });

  test("Row 2 — Composer Download → PDF gates on sign-in (Flow 2 gate step)", async ({
    page,
  }) => {
    await page.goto("/pdf-composer");
    await page.locator('input[type="file"]').first().setInputFiles(SAMPLE_PDF);

    await expect(
      page.getByRole("img", { name: /PDF page/i }).first(),
    ).toBeVisible({ timeout: 20_000 });

    await page
      .getByRole("button", { name: /^(download|export options)$/i })
      .first()
      .click();
    await page.locator('[role="menuitem"][data-key="pdf"]').first().click();

    // Per the doc's Flow 2 step 4, download must gate on sign-in even
    // for the PDF format (the older test in export-signin-redirect.spec.ts
    // asserted PDF is free — that expectation is now stale after the
    // "gate all downloads" fix, and is flagged in the UAT report).
    await expect(
      page.getByRole("heading", { name: /Sign in to download/i }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("Row 3 — Composer Download → DOCX gates on sign-in with export=docx in return URL", async ({
    page,
  }) => {
    await page.goto("/pdf-composer");
    await page.locator('input[type="file"]').first().setInputFiles(SAMPLE_PDF);

    await expect(
      page.getByRole("img", { name: /PDF page/i }).first(),
    ).toBeVisible({ timeout: 20_000 });

    await page
      .getByRole("button", { name: /^(download|export options)$/i })
      .first()
      .click();
    await page.locator('[role="menuitem"][data-key="docx"]').first().click();

    await expect(
      page.getByRole("heading", { name: /Sign in to download/i }),
    ).toBeVisible({ timeout: 5_000 });

    await page.getByRole("button", { name: /Sign in & continue/i }).click();

    await expect(page).toHaveURL(/\/sign-in\?redirect_url=/, {
      timeout: 10_000,
    });
    const returnTo = decodeURIComponent(
      new URL(page.url()).searchParams.get("redirect_url") ?? "",
    );

    expect(returnTo).toContain("/pdf-composer");
    expect(returnTo).toContain("export=docx");
  });

  test("Row 4 — /convert/word-to-pdf drop fires sign-in modal AT UPLOAD (Flow 1 gate step)", async ({
    page,
  }) => {
    // Fail-fast network guard — assert we DON'T call the backend
    // conversion endpoint before payment. Any request to /conversion
    // during this test is a violation of the doc's "no free tier /
    // sign-in before conversion" rule.
    const conversionCalls: string[] = [];

    page.on("request", (req) => {
      if (req.url().includes("/conversion")) {
        conversionCalls.push(req.method() + " " + req.url());
      }
    });

    await page.goto("/convert/word-to-pdf");
    await page.locator('input[type="file"]').first().setInputFiles(SAMPLE_DOCX);

    // Sign-in modal fires immediately — no editor, no toast, no
    // /conversion request.
    await expect(
      page.getByRole("heading", { name: /Sign in to convert/i }),
    ).toBeVisible({ timeout: 5_000 });

    // Confirm return URL points back to the same convert route so
    // auto-resume can pick up the stashed file post-signin.
    await page.getByRole("button", { name: /Sign in & continue/i }).click();
    await expect(page).toHaveURL(/\/sign-in\?redirect_url=/, {
      timeout: 10_000,
    });
    const returnTo = decodeURIComponent(
      new URL(page.url()).searchParams.get("redirect_url") ?? "",
    );

    expect(returnTo).toContain("/convert/word-to-pdf");
    expect(conversionCalls).toEqual([]);
  });

  test("Row 5 — /convert/pdf-to-word drop fires sign-in modal AT UPLOAD (branch fix — Flow 1 alignment)", async ({
    page,
  }) => {
    // Same discipline as Row 4: no /conversion call before payment.
    const conversionCalls: string[] = [];

    page.on("request", (req) => {
      if (req.url().includes("/conversion")) {
        conversionCalls.push(req.method() + " " + req.url());
      }
    });

    await page.goto("/convert/pdf-to-word");
    await page.locator('input[type="file"]').first().setInputFiles(SAMPLE_PDF);

    // Pre-fix (main branch), this drop opened the composer with an
    // export=docx auto-launch. Post-fix, the sign-in modal fires at
    // upload time exactly like /convert/word-to-pdf.
    await expect(
      page.getByRole("heading", { name: /Sign in to convert/i }),
    ).toBeVisible({ timeout: 5_000 });

    // Guest should NOT reach the pdf-composer preview.
    expect(page.url()).toContain("/convert/pdf-to-word");
    expect(page.url()).not.toContain("/pdf-composer");

    await page.getByRole("button", { name: /Sign in & continue/i }).click();
    await expect(page).toHaveURL(/\/sign-in\?redirect_url=/, {
      timeout: 10_000,
    });
    const returnTo = decodeURIComponent(
      new URL(page.url()).searchParams.get("redirect_url") ?? "",
    );

    expect(returnTo).toContain("/convert/pdf-to-word");
    expect(conversionCalls).toEqual([]);
  });

  test("Row 6 — Extract Images: composer entry → sign-in prompt at Extract click", async ({
    page,
  }) => {
    // Extract Images is a Flow 2 tool per the current spec — guest can
    // enter the composer, gate fires at the Extract action.
    await page.goto("/pdf-composer?tool=extract-images");
    await page.locator('input[type="file"]').first().setInputFiles(SAMPLE_PDF);

    await expect(
      page.getByRole("img", { name: /PDF page/i }).first(),
    ).toBeVisible({ timeout: 20_000 });

    // The hydrator auto-dispatches `editor:extract-images` for
    // ?tool=extract-images. Signed-out user hits the sign-in prompt.
    await expect(
      page.getByRole("heading", { name: /Sign in to extract images/i }),
    ).toBeVisible({ timeout: 8_000 });
  });

  test("Row 7 — Compress: composer entry → sign-in prompt at Compress click", async ({
    page,
  }) => {
    await page.goto("/pdf-composer?tool=compress");
    await page.locator('input[type="file"]').first().setInputFiles(SAMPLE_PDF);

    await expect(
      page.getByRole("img", { name: /PDF page/i }).first(),
    ).toBeVisible({ timeout: 20_000 });

    // Hydrator opens the CompressModal automatically for ?tool=compress.
    await expect(
      page.getByRole("heading", { name: /Compress PDF/i }),
    ).toBeVisible({ timeout: 5_000 });

    // Click Compress & download → sign-in prompt for guest.
    await page.getByRole("button", { name: /Compress & download/i }).click();

    await expect(
      page.getByRole("heading", { name: /Sign in to compress/i }),
    ).toBeVisible({ timeout: 5_000 });
  });
});
