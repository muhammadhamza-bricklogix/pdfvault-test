import type { Page } from "@playwright/test";

import { expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const FIXTURES = {
  pdf: path.join(__dirname, "..", "fixtures", "sample.pdf"),
  docx: path.join(__dirname, "..", "fixtures", "sample.docx"),
  jpg: path.join(__dirname, "..", "fixtures", "sample.jpg"),
};

/**
 * Opens the editor at `/pdf-editor` and uploads the sample PDF. Waits until
 * the PDF canvas is mounted — `role="img"` with a "PDF page" aria-label is
 * the most reliable ready signal because it means pdf.js has parsed the
 * document and rendered the first page. Tool buttons may already be visible
 * before the PDF is ready, so waiting on them alone can race the canvas.
 */
export async function openSamplePdfInEditor(page: Page) {
  await page.goto("/pdf-editor");
  await page.locator('input[type="file"]').first().setInputFiles(FIXTURES.pdf);

  await expect(
    page.getByRole("img", { name: /PDF page/i }).first(),
  ).toBeVisible({ timeout: 15_000 });
}

/**
 * Waits for pdf.js to finish parsing the open document — the rendered page
 * canvas exposes its label as `PDF page X of Y`, which is available on both
 * desktop and mobile (the text-based page indicator only exists in the mobile
 * EditorInfoBar, so the canvas aria-label is the cross-layout signal).
 */
export async function waitForPdfReady(page: Page) {
  await expect
    .poll(
      async () => {
        const label = await page
          .getByRole("img", { name: /PDF page/i })
          .first()
          .getAttribute("aria-label")
          .catch(() => null);

        return label ?? "";
      },
      { timeout: 15_000, intervals: [200, 500, 1000] },
    )
    .toMatch(/PDF page\s+\d+\s+of\s+[1-9]\d*/i);
}

/**
 * Returns a promise that resolves with the form-data body of the next
 * `POST /conversion` request. Use to assert the frontend fired the expected
 * conversion type without depending on the backend response.
 */
export async function captureNextConversionRequest(
  page: Page,
  expectedType: string,
): Promise<void> {
  const request = await page.waitForRequest(
    (req) => req.url().includes("/conversion") && req.method() === "POST",
    { timeout: 10_000 },
  );

  const body = request.postDataBuffer()?.toString("utf-8") ?? "";

  expect(body, `Conversion request body for ${expectedType}`).toContain(
    expectedType,
  );
}
