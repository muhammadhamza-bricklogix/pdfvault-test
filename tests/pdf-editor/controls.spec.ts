import { test, expect } from "@playwright/test";

import { openSamplePdfInEditor, waitForPdfReady } from "../helpers/editor";

test.beforeEach(async ({ page }) => {
  await openSamplePdfInEditor(page);
});

test.describe("PDF editor — top-bar controls", () => {
  test("Redo button is disabled when there is nothing to redo", async ({
    page,
  }) => {
    await expect(
      page.getByRole("button", { name: /^redo$/i }).first(),
    ).toBeDisabled();
  });

  test("zoom-in changes the zoom percentage", async ({ page }) => {
    const zoomLabel = page.locator("text=/^\\d+%$/").first();
    const before = (await zoomLabel.textContent())?.trim();

    await page.getByRole("button", { name: /zoom in/i }).first().click();
    await page.waitForTimeout(150);

    const after = (await zoomLabel.textContent())?.trim();

    expect(after, `before=${before} after=${after}`).not.toBe(before);
  });

  test("next-page button advances the page indicator", async ({ page }) => {
    await waitForPdfReady(page);

    const label = page.getByText(/Page\s*\d+/i).first();
    const before = (await label.innerText())?.trim();

    await page.getByRole("button", { name: /next page/i }).first().click();
    await page.waitForTimeout(200);

    const after = (await label.innerText())?.trim();

    expect(after, `before=${before} after=${after}`).not.toBe(before);
  });
});
