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
 * the drawing-tools toolbar (radiogroup) is mounted — that's the earliest
 * signal that the editor shell is fully rendered. The PDF parse may still be
 * in flight; call `waitForPdfReady(page)` if you need a known page count.
 */
export async function openSamplePdfInEditor(page: Page) {
  await page.goto("/pdf-editor");
  await page.locator('input[type="file"]').first().setInputFiles(FIXTURES.pdf);

  await expect(page.getByRole("radiogroup").first()).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * Waits for pdf.js to finish parsing the open document — the "Page X of Y"
 * indicator updates from 0 to the real page count when ready.
 *
 * Uses a regex that tolerates the responsive markup, where "Page" / " of " /
 * "/" appear inside spans that swap via Tailwind's `hidden sm:inline`.
 */
export async function waitForPdfReady(page: Page) {
  await expect
    .poll(
      async () => {
        const text = await page
          .getByText(/Page\s*\d+/i)
          .first()
          .innerText()
          .catch(() => null);

        return text?.trim() ?? "";
      },
      { timeout: 15_000, intervals: [200, 500, 1000] },
    )
    .toMatch(/Page\s*\d+\s+of\s+[1-9]\d*/i);
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
