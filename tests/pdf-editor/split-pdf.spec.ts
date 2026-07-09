import { expect, test } from "@playwright/test";

import { FIXTURES, openSamplePdfInEditor, waitForPdfReady } from "../helpers/editor";

/**
 * Coverage for the new split-pdf feature.
 *
 * Two entry points:
 *   - Standalone route: /tools/split-pdf (auth-gated by proxy.ts)
 *   - Editor hamburger menu: opens SplitPdfModal against the loaded doc
 *
 * The pure split logic (parseRanges, splitPdf, buildZip) lives in
 * `lib/client/pdf-tools/split-pdf.ts` and is exercised indirectly here.
 * Both UI surfaces use the same logic, so we test mostly through the
 * editor modal (no auth required for /pdf-editor in local mode).
 */
test.describe("PDF editor — Split PDF (in-editor)", () => {
  test.beforeEach(async ({ page }) => {
    await openSamplePdfInEditor(page);
    await waitForPdfReady(page);
  });

  async function openSplitModal(page: import("@playwright/test").Page) {
    await page.getByRole("button", { name: /^split$/i }).first().click();
    await expect(
      page.getByRole("heading", { name: /split pdf/i }),
    ).toBeVisible({ timeout: 8_000 });
  }

  test("opens with page count + filename header", async ({ page }) => {
    await openSplitModal(page);

    // Modal body should show "<N> pages · <filename>" once pdf-lib finishes.
    await expect(
      page.getByText(/\d+\s+pages.*sample\.pdf/i).first(),
    ).toBeVisible({ timeout: 6_000 });
  });

  test("Custom ranges: valid input enables Split button + lists outputs", async ({
    page,
  }) => {
    await openSplitModal(page);

    const rangesInput = page.getByLabel(/page ranges/i).first();

    await rangesInput.fill("1");

    // Preview list should show one output for a single page.
    await expect(page.getByText(/output \(1 file\)/i)).toBeVisible({
      timeout: 3_000,
    });
    await expect(
      page.getByRole("button", { name: /split.*download/i }),
    ).toBeEnabled();
  });

  test("Custom ranges: out-of-bounds shows inline error + keeps button disabled", async ({
    page,
  }) => {
    await openSplitModal(page);

    const rangesInput = page.getByLabel(/page ranges/i).first();

    await rangesInput.fill("99-200");

    await expect(
      page.getByText(/beyond page \d+/i).first(),
    ).toBeVisible({ timeout: 2_000 });
    await expect(
      page.getByRole("button", { name: /split.*download/i }),
    ).toBeDisabled();
  });

  test("Custom ranges: malformed token shows readable error", async ({
    page,
  }) => {
    await openSplitModal(page);

    const rangesInput = page.getByLabel(/page ranges/i).first();

    await rangesInput.fill("abc, 1-3");

    await expect(
      page.getByText(/couldn't read "abc"/i).first(),
    ).toBeVisible({ timeout: 2_000 });
  });

  test("Custom ranges: reverse range (3-1) flagged", async ({ page }) => {
    await openSplitModal(page);

    const rangesInput = page.getByLabel(/page ranges/i).first();

    // sample.pdf has 3 pages — using 3-1 keeps both ends in-bounds so
    // the reverse-detection fires instead of the out-of-bounds branch.
    await rangesInput.fill("3-1");

    await expect(
      page.getByText(/starts after it ends/i).first(),
    ).toBeVisible({ timeout: 2_000 });
  });

  test("Every N pages: switching modes resets validation", async ({ page }) => {
    await openSplitModal(page);

    // Type bad input in ranges mode...
    await page.getByLabel(/page ranges/i).first().fill("999");
    await expect(page.getByText(/beyond page/i).first()).toBeVisible();

    // Switch tab → error message should clear because the new input is
    // pre-populated with the default "5".
    await page.getByRole("tab", { name: /every n pages/i }).click();
    await expect(page.getByText(/beyond page/i)).not.toBeVisible();

    // Default "5" should produce a valid preview.
    await expect(page.getByText(/output \(\d+ file/i)).toBeVisible({
      timeout: 2_000,
    });
  });

  test("Every N pages: 0 is rejected", async ({ page }) => {
    await openSplitModal(page);
    await page.getByRole("tab", { name: /every n pages/i }).click();
    await page.getByLabel(/pages per file/i).first().fill("0");

    await expect(
      page.getByText(/at least 1/i).first(),
    ).toBeVisible({ timeout: 2_000 });
  });

  test("Cancel closes the modal without firing a download", async ({
    page,
  }) => {
    await openSplitModal(page);

    let downloadFired = false;

    page.on("download", () => {
      downloadFired = true;
    });

    await page.getByRole("button", { name: /^cancel$/i }).click();

    await expect(
      page.getByRole("heading", { name: /split pdf/i }),
    ).not.toBeVisible({ timeout: 2_000 });
    expect(downloadFired).toBe(false);
  });

  test("Split & download fires a download (single-range → PDF)", async ({
    page,
  }) => {
    await openSplitModal(page);

    await page.getByLabel(/page ranges/i).first().fill("1");

    const downloadPromise = page.waitForEvent("download", { timeout: 10_000 });

    await page.getByRole("button", { name: /split.*download/i }).click();
    const download = await downloadPromise;

    // Filename uses the sanitised base + suffix.
    expect(download.suggestedFilename()).toMatch(/sample-page-1\.pdf/);
  });
});

test.describe("Split PDF — standalone route (/tools/split-pdf)", () => {
  test("Anonymous visit redirects to /sign-in with return path", async ({
    page,
  }) => {
    // Don't wait for the page's "load" event — the marketing layout
    // can stream slow assets and we only care about the redirect URL,
    // which fires server-side in proxy.ts before the body is shipped.
    await page.goto("/tools/split-pdf", { waitUntil: "domcontentloaded" });

    await expect.poll(() => page.url(), { timeout: 6_000 }).toMatch(/\/sign-in/);
    expect(decodeURIComponent(page.url())).toContain(
      "redirect_url=/tools/split-pdf",
    );
  });
});
