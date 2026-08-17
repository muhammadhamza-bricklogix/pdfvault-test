import { expect, test } from "@playwright/test";

import { openSamplePdfInEditor } from "../helpers/editor";

/**
 * Regression coverage for the new editor toolbar layout bug: at the default
 * 1280x720 Playwright Desktop Chrome viewport the leftmost (Select, Edit)
 * and rightmost (Manage Pages) tool buttons are horizontally clipped and
 * unreachable by click. The desktop project in playwright.config.ts therefore
 * runs at 1920x1080; this spec intentionally uses the smaller viewport to
 * document and guard the issue.
 */
test.describe("PDF editor — toolbar overflow at 1280x720", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page }) => {
    await openSamplePdfInEditor(page);
  });

  test("Select and Manage Pages buttons are clipped from viewport", async ({
    page,
  }) => {
    const selectButton = page.getByRole("button", { name: /^select$/i }).first();
    const managePagesButton = page
      .getByRole("button", { name: /^manage pages$/i })
      .first();

    await expect(selectButton).toBeVisible();
    await expect(selectButton).not.toBeInViewport();

    await expect(managePagesButton).toBeVisible();
    await expect(managePagesButton).not.toBeInViewport();
  });
});
