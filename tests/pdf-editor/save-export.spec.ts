import { test, expect } from "@playwright/test";

import { openSamplePdfInEditor, waitForPdfReady } from "../helpers/editor";

const EXPORT_FORMATS = [
  "PDF (.pdf)",
  "Word (.docx)",
  "Excel (.xlsx)",
  "PowerPoint (.pptx)",
  "JPG image",
  "PNG image",
  "HTML",
  "Plain text (.txt)",
];

/**
 * The Save button + Export options dropdown live in the mobile EditorInfoBar.
 * The desktop PvEditorTopChrome uses a Download dropdown instead.
 */
test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await openSamplePdfInEditor(page);
  await waitForPdfReady(page);
});

test.describe("PDF editor — Save dropdown", () => {
  test("Save button + Export options dropdown are present", async ({ page }) => {
    // On mobile the Save button text is visually hidden; locate by class + text.
    await expect(
      page.locator('button.button--primary', { hasText: /save/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /export options/i }).first(),
    ).toBeVisible();
  });

  test(`Export menu lists all ${EXPORT_FORMATS.length} formats`, async ({
    page,
  }) => {
    await page.getByRole("button", { name: /export options/i }).click();

    for (const label of EXPORT_FORMATS) {
      await expect(
        page.getByText(label, { exact: false }).first(),
      ).toBeVisible();
    }
  });
});
