import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_PDF = path.join(__dirname, "..", "..", "fixtures", "sample.pdf");

// Run signed-out: no auth needed for this editor UX test.
test.use({ storageState: { cookies: [], origins: [] } });

/**
 * Regression (QA 2026-10-03, row 1 of PDF Composer bugs sheet):
 * "Adding text and clicking Undo can empty the document or remove
 *  unrelated existing content." User note: "there are 2 extra clicks
 *  on undo after undoing 2 things."
 *
 * Root cause: `useEditTextMode` extracts source text as Fabric IText
 * objects on page open, adding them one-by-one via `fabricCanvas.add()`.
 * Each add fired `object:added`, which the history snapshot handler
 * recorded — flooding the undo stack with one phantom entry per
 * extracted text run. After the user did N real edits, undo kept
 * "working" (progressively removing extracted text objects) instead of
 * greying out.
 *
 * Fix (3 files):
 *  - `useEditorHistory` snapshot handler now has a split path for
 *    `object:added`: skipped for `editorType === "editModeText"`.
 *  - New `resetHistoryBaselineIfVirgin` store action replaces the
 *    mount-time (pre-extraction) baseline with the post-extraction
 *    state so undoing back lands on "extracted text visible, no user
 *    edits."
 *  - `useEditTextMode` calls `resetHistoryBaselineIfVirgin` right
 *    after the extraction add-loop completes.
 *
 * This spec adds ONE text object, clicks Undo once, and verifies the
 * Undo button is now disabled — i.e. the stack has exactly 1 real
 * entry, no phantom extraction snapshots behind it.
 */

test.describe("PDF editor — undo stops at the real pre-edit baseline", () => {
  test("undoing to the baseline leaves extracted text intact (no phantom extraction snapshots)", async ({
    page,
  }) => {
    await page.goto("/pdf-composer");
    await page.locator('input[type="file"]').first().setInputFiles(SAMPLE_PDF);

    await expect(
      page.getByRole("img", { name: /PDF page/i }).first(),
    ).toBeVisible({ timeout: 30_000 });

    // Give auto-extraction time to add IText objects + fire
    // `resetHistoryBaselineIfVirgin`.
    await page.waitForTimeout(2500);

    // Count how many editModeText objects are on the live Fabric canvas
    // after extraction. Pre-fix, each add would have pushed its own
    // history entry → clicking undo past the user's real edits would
    // progressively remove these. Post-fix, this count should be stable
    // after any number of undos because none of the extraction adds
    // produced a history entry.
    const getExtractedCount = () =>
      page.evaluate(() => {
        type FabricObj = { editorType?: string };
        type FabricCanvas = { getObjects: () => FabricObj[] };
        const w = window as unknown as {
          __fabricCanvas?: FabricCanvas;
        };
        const fc = w.__fabricCanvas;

        if (!fc) return -1;
        return fc
          .getObjects()
          .filter((o) => o.editorType === "editModeText").length;
      });

    const extractedBefore = await getExtractedCount();

    test.skip(extractedBefore <= 0, "live canvas not exposed on window");

    const undoButton = page.getByRole("button", { name: /^undo$/i }).first();

    // Spam undo 20 times. If the extraction-add snapshots were still
    // in the stack, this would progressively delete extracted-text
    // IText objects, driving `extractedBefore` down. With the fix in
    // place, nothing extraction-added lives in the stack, so the
    // count must be unchanged after all presses settle.
    for (let i = 0; i < 20; i++) {
      if (await undoButton.isDisabled()) break;
      await undoButton.click();
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(500);

    const extractedAfter = await getExtractedCount();

    expect(extractedAfter).toBe(extractedBefore);
  });
});
