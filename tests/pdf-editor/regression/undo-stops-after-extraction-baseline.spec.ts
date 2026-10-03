import { expect, test } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  test("one text add + one undo = undo button disabled (no phantom extraction snapshots)", async ({
    page,
  }) => {
    await page.goto("/pdf-composer");
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles(SAMPLE_PDF);

    await expect(
      page.getByRole("img", { name: /PDF page/i }).first(),
    ).toBeVisible({ timeout: 30_000 });

    const undoButton = page.getByRole("button", { name: /^undo$/i }).first();
    const redoButton = page.getByRole("button", { name: /^redo$/i }).first();

    // Give auto-extraction time to add IText objects + fire
    // `resetHistoryBaselineIfVirgin`.
    await page.waitForTimeout(2500);

    // Starting state after extraction: nothing undoable.
    await expect(undoButton).toBeDisabled();
    await expect(redoButton).toBeDisabled();

    // Add exactly one text object via the Text tool.
    await page.getByRole("button", { name: /^text$/i }).first().click();
    await page
      .locator("canvas.upper-canvas")
      .first()
      .click({ position: { x: 220, y: 220 } });
    await page.keyboard.type("QA");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    // Now the user has ONE real undoable action.
    await expect(undoButton).toBeEnabled();
    await expect(redoButton).toBeDisabled();

    // One click of undo reverts the text add.
    await undoButton.click();
    await page.waitForTimeout(300);

    // After this single undo, the stack is back to the extraction
    // baseline. Undo MUST be disabled — any further undo would start
    // removing extracted source-text objects (the exact bug this fix
    // prevents).
    await expect(undoButton).toBeDisabled();
    // Redo is enabled because the text-add is now in the redo stack.
    await expect(redoButton).toBeEnabled();
  });
});
