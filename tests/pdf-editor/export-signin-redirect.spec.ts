import { expect, test } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_PDF = path.join(__dirname, "..", "fixtures", "sample.pdf");

// Force anonymous — this spec exercises the signed-out export gate.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Editor export — signed-out flow", () => {
  test("PDF export as signed-out DOES NOT redirect (client-side only, no auth needed)", async ({
    page,
  }) => {
    await page.goto("/pdf-composer");

    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles(SAMPLE_PDF);

    await expect(
      page.getByRole("img", { name: /PDF page/i }).first(),
    ).toBeVisible({ timeout: 20_000 });

    const downloadTrigger = page
      .getByRole("button", { name: /^(download|export options)$/i })
      .first();

    await downloadTrigger.click();
    await page.locator('[role="menuitem"][data-key="pdf"]').first().click();

    // PDF export is client-side only — should NOT bounce to sign-in.
    // Give the redirect a chance to (not) happen.
    await page.waitForTimeout(1000);
    expect(page.url()).not.toContain("/sign-in");
    expect(page.url()).toContain("/pdf-composer");
  });

  test("non-PDF export as signed-out opens the Sign-In confirm modal, and confirming redirects to /sign-in with the export in the return URL", async ({
    page,
  }) => {
    await page.goto("/pdf-composer");

    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles(SAMPLE_PDF);

    await expect(
      page.getByRole("img", { name: /PDF page/i }).first(),
    ).toBeVisible({ timeout: 20_000 });

    const downloadTrigger = page
      .getByRole("button", { name: /^(download|export options)$/i })
      .first();

    await downloadTrigger.click();
    await page
      .locator('[role="menuitem"][data-key="docx"]')
      .first()
      .click();

    // Sign-in prompt modal should appear (not an immediate redirect).
    const promptHeading = page.getByRole("heading", {
      name: /Sign in to download/i,
    });

    await expect(promptHeading).toBeVisible({ timeout: 5_000 });

    // URL still on /pdf-composer — no redirect until user confirms.
    expect(page.url()).toContain("/pdf-composer");
    expect(page.url()).not.toContain("/sign-in");

    // Confirm → redirect to /sign-in with correct redirect_url.
    await page
      .getByRole("button", { name: /Sign in & continue/i })
      .click();

    await expect(page).toHaveURL(/\/sign-in\?redirect_url=/, {
      timeout: 10_000,
    });

    const currentUrl = new URL(page.url());
    const returnTo = decodeURIComponent(
      currentUrl.searchParams.get("redirect_url") ?? "",
    );

    expect(returnTo).toContain("/pdf-composer");
    expect(returnTo).toContain("export=docx");
  });

  test("non-PDF export as signed-out can be cancelled from the modal — user stays on the editor", async ({
    page,
  }) => {
    await page.goto("/pdf-composer");

    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles(SAMPLE_PDF);

    await expect(
      page.getByRole("img", { name: /PDF page/i }).first(),
    ).toBeVisible({ timeout: 20_000 });

    await page
      .getByRole("button", { name: /^(download|export options)$/i })
      .first()
      .click();
    await page
      .locator('[role="menuitem"][data-key="docx"]')
      .first()
      .click();

    await expect(
      page.getByRole("heading", { name: /Sign in to download/i }),
    ).toBeVisible({ timeout: 5_000 });

    await page.getByRole("button", { name: /^Cancel$/i }).click();

    // Modal dismisses, user is still on /pdf-composer with the file
    // loaded — no redirect happened.
    await expect(
      page.getByRole("heading", { name: /Sign in to download/i }),
    ).not.toBeVisible({ timeout: 3_000 });
    expect(page.url()).toContain("/pdf-composer");
    expect(page.url()).not.toContain("/sign-in");
  });
});
