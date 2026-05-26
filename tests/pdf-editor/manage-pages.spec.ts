import { test, expect } from "@playwright/test";

import { openSamplePdfInEditor } from "../helpers/editor";

test.beforeEach(async ({ page }) => {
  await openSamplePdfInEditor(page);
});

test.describe("PDF editor — Manage Pages", () => {
  test("modal opens without runtime errors", async ({ page }) => {
    const errors: string[] = [];

    page.on("pageerror", (e) => errors.push(e.message));

    await page.getByRole("button", { name: /manage pages/i }).first().click();

    // Exclude the Next.js dev-tools error overlay (also uses role=dialog).
    await expect(
      page.locator('[role="dialog"]:not([data-nextjs-dialog])').first(),
    ).toBeVisible({ timeout: 5_000 });

    expect(errors).toEqual([]);
  });
});
