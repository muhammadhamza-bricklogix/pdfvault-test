import { test, expect } from "@playwright/test";

import { skipIfUnauthenticated } from "../helpers/auth";
import { openSamplePdfInEditor, waitForPdfReady } from "../helpers/editor";

/**
 * The "Browse all tools" trigger lives in the mobile EditorInfoBar. The
 * desktop PvEditorTopChrome renders tools directly in the pill toolbar and
 * does not surface this modal entry point.
 */
test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await openSamplePdfInEditor(page);
  await waitForPdfReady(page);
});

test.describe("Conversion — Tools modal in editor", () => {
  test("opens from the editor top bar", async ({ page }) => {
    await page
      .getByRole("button", { name: /browse all tools|^tools$/i })
      .first()
      .click();

    await expect(
      page.getByRole("heading", { name: /^tools$/i }).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("clicking a tile navigates to a real /tools/<slug> page", async ({
    page,
  }) => {
    // Tiles navigate to /tools/<slug> which is auth-gated.
    skipIfUnauthenticated();

    await page
      .getByRole("button", { name: /browse all tools|^tools$/i })
      .first()
      .click();

    const firstTile = page
      .locator('button[aria-label*="PDF"], button[aria-label*="JPG"]')
      .first();

    await firstTile.waitFor({ timeout: 10_000 });
    await firstTile.click();

    await expect(page).toHaveURL(/\/tools\//, { timeout: 5_000 });
    await expect(
      page.locator("text=This page could not be found"),
    ).toHaveCount(0);
  });
});
