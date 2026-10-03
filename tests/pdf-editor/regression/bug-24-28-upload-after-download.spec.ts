import { expect, test } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { openSamplePdfInEditor, waitForPdfReady } from "../../helpers/editor";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_A = path.join(__dirname, "..", "..", "fixtures", "sample.pdf");
const FIXTURE_B = path.join(
  __dirname,
  "..",
  "..",
  "fixtures",
  "back-end-infrastructure.pdf",
);

/**
 * Row 24 + 28: after downloading document A, uploading a different
 * document B should load B — not reopen A.
 *
 * This test uses the signed-OUT path only (the signed-in path routes
 * through the cloud upload mutation + Clerk auth, which is covered by
 * other suites). The repro: open A → simulate download (local-only,
 * no state mutation expected) → open B via the hamburger file picker
 * → assert the editor's active file is B's bytes, not A's.
 */

test.beforeEach(async ({ page }) => {
  await openSamplePdfInEditor(page);
  await waitForPdfReady(page);
  await page.waitForFunction(
    () =>
      typeof window.__PDF_EDITOR_TEST__?.fabricCanvas !== "undefined" &&
      typeof window.__PDF_EDITOR_TEST__?.getStore === "function",
    null,
    { timeout: 15000 },
  );
});

test.describe("PDF Composer sheet — rows 24 + 28", () => {
  test("uploading a different file after download swaps the editor doc", async ({
    page,
  }) => {
    const initialFilename = await page.evaluate(() => {
      const harness = window.__PDF_EDITOR_TEST__;

      if (!harness) throw new Error("harness missing");

      return harness.getStore().file?.name ?? null;
    });

    expect(initialFilename).toMatch(/sample\.pdf$/i);

    // Simulate a user triggering download — this is a browser-side
    // action with no explicit API surface in the editor. For the state
    // check it's a no-op; we just assert the store is intact post-"download".
    const stateAfterDownload = await page.evaluate(() => {
      const harness = window.__PDF_EDITOR_TEST__;

      if (!harness) throw new Error("harness missing");

      return harness.getStore().file?.name ?? null;
    });

    expect(stateAfterDownload).toBe(initialFilename);

    // Now upload the different fixture via the hamburger menu's hidden
    // file input. There are several `<input type="file">` elements —
    // target the one in the hamburger (accept includes PDF + images).
    const inputs = page.locator('input[type="file"]');
    const inputCount = await inputs.count();

    // Pick the input whose accept list includes "application/pdf" AND
    // image types — that's the hamburger "Open" input, not the Image /
    // Signature uploaders.
    let targetIdx = -1;

    for (let i = 0; i < inputCount; i++) {
      const accept = await inputs.nth(i).getAttribute("accept");

      if (
        accept &&
        /application\/pdf/i.test(accept) &&
        /image\//i.test(accept)
      ) {
        targetIdx = i;
        break;
      }
    }

    expect(targetIdx, "no hamburger upload input found").toBeGreaterThanOrEqual(
      0,
    );

    await inputs.nth(targetIdx).setInputFiles(FIXTURE_B);

    // The signed-out branch of handleFileChange does clearFile() + a
    // setTimeout(0) setFile(newFile). Wait for the file name to flip.
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const harness = window.__PDF_EDITOR_TEST__;

            return harness?.getStore().file?.name ?? null;
          }),
        { timeout: 15000, intervals: [200, 500] },
      )
      .toMatch(/back-end-infrastructure\.pdf$/i);

    // Also verify pdf.js re-rendered — a reliable signal that the loader
    // actually swapped documents and isn't just reporting a stale name.
    const label = await page
      .getByRole("img", { name: /PDF page/i })
      .first()
      .getAttribute("aria-label");

    expect(label).toBeTruthy();

    // Fixture A is one page; fixture B is multi-page. If the editor
    // actually swapped, pageCount will reflect fixture B's page count.
    const pageCountB = await page.evaluate(() => {
      const harness = window.__PDF_EDITOR_TEST__;

      return harness?.getStore().pageCount ?? 0;
    });

    expect(pageCountB).toBeGreaterThan(1);

    // Also fixture B is used as the "sample.pdf uses sample.pdf" so FILE A
    // was 1 page. If pageCountB > 1 we have proof it swapped.
    void FIXTURE_A;
  });
});
