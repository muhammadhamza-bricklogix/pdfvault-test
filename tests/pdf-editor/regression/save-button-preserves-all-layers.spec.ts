import { expect, test } from "@playwright/test";

import {
  addAllCanaries,
  verifyCanaryLayers,
} from "../../helpers/canary-layers";
import { openSamplePdfInEditor, waitForPdfReady } from "../../helpers/editor";

/**
 * Kitchen-sink: signed-in user adds EVERY layer type — shape, text,
 * drawing, highlight, signature, image, page-number, watermark, bg
 * image — then fires `editor:save`. Every canary must survive
 * post-`applyPostSaveReset` in the store (which is what the next
 * save cycle will read).
 *
 * `POST /documents/upload` is stubbed so the spec is deterministic
 * + doesn't create a real doc row in the test user's library.
 *
 * Failures here indicate a regression in the Save-button pipeline:
 *   • hasUnsavedChanges short-circuit before upload.
 *   • flushLiveFabricPage skipped → live canvas not captured.
 *   • applyPostSaveReset didn't fire → hasUnsavedChanges stuck true.
 *   • applyPristineSweep stripped a layer type it shouldn't (shapes,
 *     drawings, highlights, signatures, and user-images stay in
 *     fabricJsonByPage; source-tied editModeText + pageNumber stay
 *     too per skill log 2026-06-19 (d)).
 *   • watermarkConfig / backgroundImageConfig reset by mistake.
 */

test.describe("PDF editor — Save button preserves all layers", () => {
  test("shape + text + drawing + highlight + signature + image + page-number + watermark + bg-image all survive Save", async ({
    page,
  }) => {
    await page.route(
      (url) => url.pathname.endsWith("/documents/upload"),
      async (route) => {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            id: "canary-doc-save-button",
            filename: "sample.pdf",
            contentType: "application/pdf",
            url: "https://example.invalid/canary.pdf",
            editorState: null,
            originalContentType: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        });
      },
    );

    await openSamplePdfInEditor(page);
    await waitForPdfReady(page);
    await page.waitForFunction(
      () => Boolean(window.__PDF_EDITOR_TEST__?.fabricCanvas),
      undefined,
      { timeout: 15_000 },
    );

    await addAllCanaries(page);

    // Wait for the flush to land in `fabricJsonByPage` — the
    // snapshot handler fires on `object:added`.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const store = window.__PDF_EDITOR_TEST__!.getStore();

            return store.hasUnsavedChanges;
          }),
        { timeout: 5_000 },
      )
      .toBe(true);

    const uploadResponsePromise = page.waitForResponse((response) =>
      response.url().includes("/documents/upload"),
    );

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("editor:save"));
    });

    await uploadResponsePromise;

    // Post-save: hasUnsavedChanges → false, currentDocumentId set.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const store = window.__PDF_EDITOR_TEST__!.getStore();

            return {
              hasUnsavedChanges: store.hasUnsavedChanges,
              currentDocumentId: store.currentDocumentId,
            };
          }),
        { timeout: 10_000 },
      )
      .toEqual({
        hasUnsavedChanges: false,
        currentDocumentId: "canary-doc-save-button",
      });

    const restored = await verifyCanaryLayers(page);

    expect(restored.hasCanaryShape, "shape lost across Save").toBe(true);
    expect(restored.hasCanaryText, "text lost across Save").toBe(true);
    expect(restored.hasCanaryDraw, "drawing lost across Save").toBe(true);
    expect(restored.hasCanaryHighlight, "highlight lost across Save").toBe(
      true,
    );
    expect(restored.hasCanarySignature, "signature lost across Save").toBe(
      true,
    );
    expect(restored.hasCanaryImage, "user image lost across Save").toBe(true);
    expect(restored.hasCanaryPageNumber, "page number lost across Save").toBe(
      true,
    );
    expect(restored.watermarkEnabled, "watermark config reset by Save").toBe(
      true,
    );
    expect(restored.watermarkText).toBe("CANARY-WATERMARK");
    expect(restored.bgImageEnabled, "bg image config reset by Save").toBe(
      true,
    );
    expect(restored.bgImageHasData, "bg image data blanked by Save").toBe(
      true,
    );
  });
});
