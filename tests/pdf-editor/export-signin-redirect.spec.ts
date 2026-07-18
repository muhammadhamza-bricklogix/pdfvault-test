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

  test("non-PDF export as signed-out redirects to sign-in with the export in the return URL", async ({
    page,
  }) => {
    await page.goto("/pdf-composer");

    // Drop the sample PDF into the empty-state file picker.
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles(SAMPLE_PDF);

    // Wait for the PDF to render.
    await expect(
      page.getByRole("img", { name: /PDF page/i }).first(),
    ).toBeVisible({ timeout: 20_000 });

    // Open the Download / Export dropdown and pick a non-PDF format so the
    // export path hits the auth gate. Desktop chrome uses the "Download"
    // button label; mobile info bar uses "Export options".
    const downloadTrigger = page
      .getByRole("button", { name: /^(download|export options)$/i })
      .first();

    await downloadTrigger.click();
    await page
      .locator('[role="menuitem"][data-key="docx"]')
      .first()
      .click();

    // Should redirect to sign-in with the export format preserved in
    // redirect_url so we can auto-fire the export on return.
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
});
