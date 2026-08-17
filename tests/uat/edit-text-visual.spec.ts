import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Visual capture for `Back-end_infrastructure.pdf`:
 *   - `select.png` before Edit is activated (pdf.js native paint)
 *   - `edit-text.png` right after Edit activates (Fabric IText overlay)
 *
 * Sanity check for the 2026-07-23 lineHeight + canvas-measure fixes.
 * The two screenshots should look identical to the eye. Anything
 * bigger, wrapped, or shifted is a regression to investigate.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(
  __dirname,
  "..",
  "fixtures",
  "back-end-infrastructure.pdf",
);

test.use({ storageState: { cookies: [], origins: [] } });

test("Edit-Text before / after screenshots for the reported PDF", async ({
  page,
}) => {
  await page.goto("/pdf-composer");
  await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);

  await expect(
    page.getByRole("img", { name: /PDF page/i }).first(),
  ).toBeVisible({ timeout: 20_000 });

  await page.waitForFunction(
    () =>
      !!window.__PDF_EDITOR_TEST__?.fabricCanvas &&
      !!window.__PDF_EDITOR_TEST__?.getStore?.(),
    { timeout: 20_000 },
  );

  // Give pdf.js a beat to finish painting the first page + fonts.
  await page.waitForTimeout(500);

  await page.screenshot({
    path: "test-results/edit-text/select.png",
    fullPage: false,
  });

  await page.evaluate(() =>
    window.__PDF_EDITOR_TEST__!.getStore().setActiveTool("editText"),
  );

  await page.waitForFunction(
    () => {
      const store = window.__PDF_EDITOR_TEST__?.getStore();

      if (!store) return false;

      return store.extractedPages.has(
        store.getSourcePageIndex(store.currentPage),
      );
    },
    { timeout: 20_000 },
  );

  await page.waitForTimeout(500);

  await page.screenshot({
    path: "test-results/edit-text/edit-text.png",
    fullPage: false,
  });

  console.log(
    "[edit-text-visual] wrote test-results/edit-text/{select,edit-text}.png — compare visually.",
  );
});
