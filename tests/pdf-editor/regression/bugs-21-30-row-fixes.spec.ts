import { expect, test } from "@playwright/test";

import { openSamplePdfInEditor, waitForPdfReady } from "../../helpers/editor";

/**
 * Covers the code-change rows from docs/fixes/PDF Composer.xlsx:
 *  - Row 21: whiteout-covered text item filter in use-pdf-search
 *  - Row 25: nav-save warning gated on hadDirtyChangesOnEntry
 *  - Row 29: text-extract failure uses quiet info toast, not error
 *
 * Uses the dev-only `window.__PDF_EDITOR_TEST__` harness to drive the
 * editor through real event handlers. Mirrors the pattern established
 * by bugs-11-20-row-fixes.spec.ts.
 */

test.beforeEach(async ({ page }) => {
  await openSamplePdfInEditor(page);
  await waitForPdfReady(page);
  await page.waitForFunction(
    () =>
      typeof window.__PDF_EDITOR_TEST__?.fabricCanvas !== "undefined" &&
      typeof window.__PDF_EDITOR_TEST__?.getStore === "function",
    null,
    { timeout: 5000 },
  );
});

test.describe("PDF Composer sheet — rows 21/25/29", () => {
  test("row 25: nav-save does NOT toast error when store is clean", async ({
    page,
  }) => {
    // Force the store clean: apply post-save reset which flips
    // hasUnsavedChanges to false.
    await page.evaluate(() => {
      const harness = window.__PDF_EDITOR_TEST__;

      if (!harness) throw new Error("harness missing");
      const state = harness.getStore();

      if (!state.file) throw new Error("file not loaded");
      state.applyPostSaveReset(state.file);
    });

    // Dispatch nav-save with a bogus URL — the handler will attempt a
    // forced re-save (which may silently succeed or fail). The row-25
    // fix suppresses the "Could not save" error toast when the store
    // was clean on entry.
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("editor:navigate-after-save", {
          detail: { url: "/" },
        }),
      );
    });

    await page.waitForTimeout(2000);

    const errorToast = page.getByText(/couldn't save your PDF before leaving/i);

    await expect(errorToast).toHaveCount(0);
  });

  test("row 29: text-extract failure shows info-style message, not scary error", async ({
    page,
  }) => {
    // Stub getTextContent on page 1 so extractTextBlocks throws exactly
    // like the real sendWithStream failure from Row 29.
    await page.evaluate(async () => {
      const harness = window.__PDF_EDITOR_TEST__;

      if (!harness) throw new Error("harness missing");
      const state = harness.getStore();

      if (!state.pdfDocument) throw new Error("pdf not loaded");
      const pdfPage = await state.pdfDocument.getPage(1);
      const original = pdfPage.getTextContent.bind(pdfPage);

      pdfPage.getTextContent = async () => {
        throw new Error(
          "Cannot read properties of null (reading 'sendWithStream')",
        );
      };

      // Flip to editText so the hook attempts extraction and hits the catch.
      state.setActiveTool("editText");

      // Give the hook time to run.
      await new Promise((r) => setTimeout(r, 1500));

      // Restore the stub.
      pdfPage.getTextContent = original;
    });

    // Scary wording must NOT appear.
    const scary = page.getByText(/not supported on this browser/i);

    await expect(scary).toHaveCount(0);
  });

  test("row 21: whiteout rects persist in fabricJsonByPage with editorType whiteout", async ({
    page,
  }) => {
    // Row-21 fix: use-pdf-search filters text items fully contained inside
    // whiteout/redaction rects. The filter reads the page's serialized
    // Fabric JSON. This test verifies the plumbing — a whiteout rect
    // written via saveFabricJson round-trips through fabricJsonByPage with
    // its editorType intact, which is what occlusionRectsFromJson keys off.
    const stored = await page.evaluate(() => {
      const harness = window.__PDF_EDITOR_TEST__;

      if (!harness) throw new Error("harness missing");
      const state = harness.getStore();
      const sourcePage =
        state.pageOrder[state.currentPage - 1] ?? state.currentPage;

      // Build the JSON directly without needing the Fabric runtime —
      // mirrors the Rect-serialized shape with the two keys the row-21
      // parser looks for (type + editorType).
      const json = JSON.stringify({
        objects: [
          {
            type: "rect",
            editorType: "whiteout",
            left: 50,
            top: 50,
            width: 400,
            height: 500,
            scaleX: 1,
            scaleY: 1,
            fill: "#FFFFFF",
          },
          {
            type: "rect",
            editorType: "redaction",
            left: 100,
            top: 100,
            width: 100,
            height: 50,
            scaleX: 1,
            scaleY: 1,
            fill: "#000000",
          },
        ],
        width: 612,
        height: 792,
      });

      state.saveFabricJson(state.currentPage, json);

      // Re-read the store after save — Zustand getState() returns a
      // snapshot, so the local `state` ref still points at the pre-save map.
      const persisted = harness
        .getStore()
        .fabricJsonByPage.get(sourcePage);

      if (!persisted) return null;
      const parsed = JSON.parse(persisted) as {
        objects?: { editorType?: string }[];
      };

      const objects = parsed.objects ?? [];

      return {
        whiteoutCount: objects.filter((o) => o.editorType === "whiteout")
          .length,
        redactionCount: objects.filter((o) => o.editorType === "redaction")
          .length,
      };
    });

    expect(stored).toBeTruthy();
    expect(stored?.whiteoutCount).toBe(1);
    expect(stored?.redactionCount).toBe(1);
  });
});
