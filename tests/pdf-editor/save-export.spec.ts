import { test, expect } from "@playwright/test";

import { openSamplePdfInEditor } from "../helpers/editor";

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

test.beforeEach(async ({ page }) => {
  await openSamplePdfInEditor(page);
});

test.describe("PDF editor — Save dropdown", () => {
  test("Save button + Export options dropdown are present", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /^save$/i }).first(),
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
