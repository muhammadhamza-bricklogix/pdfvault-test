import { expect, test } from "@playwright/test";

import {
  addAllCanaries,
  verifyCanaryLayers,
} from "../../helpers/canary-layers";
import { openSamplePdfInEditor, waitForPdfReady } from "../../helpers/editor";

/**
 * Kitchen-sink: signed-in user adds every layer type, then triggers
 * `editor:save-before-action` — the event used by Done → Download,
 * Merge, Share, Manage Pages, and Save & Reload. All canaries must
 * survive the flush → persist → applyPostSaveReset chain.
 *
 * Uses `skipReset: false` so the full save-and-reset path exercises
 * (matches Save & Reload / Merge / Manage Pages behavior). The
 * skipReset: true path (used by Done → Download to leave store.file
 * on the original bytes for the follow-up export) is a separate
 * concern and doesn't need its own regression here — the export
 * flow guard sits in `useExportEditor`.
 */

test.describe("PDF editor — save-before-action preserves all layers", () => {
  test("all canary layers survive save-before-action + applyPostSaveReset", async ({
    page,
  }) => {
    await page.route(
      (url) => url.pathname.endsWith("/documents/upload"),
      async (route) => {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            id: "canary-doc-save-before-action",
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

    // Fire save-before-action with a Promise-wrapped onComplete so we
    // can await the save resolution deterministically (matches the
    // pattern real callers like ReloadConfirmModal + MergePdfModal
    // use — QA 2026-08-21).
    const saveResult = await Promise.all([
      uploadResponsePromise,
      page.evaluate(
        () =>
          new Promise<{ ok: boolean; reason?: string }>((resolve) => {
            window.dispatchEvent(
              new CustomEvent("editor:save-before-action", {
                detail: {
                  force: true,
                  onComplete: (result: { ok: boolean; reason?: string }) =>
                    resolve(result),
                },
              }),
            );
          }),
      ),
    ]);

    expect(saveResult[1].ok, "save-before-action failed").toBe(true);

    const restored = await verifyCanaryLayers(page);

    expect(restored.hasCanaryShape).toBe(true);
    expect(restored.hasCanaryText).toBe(true);
    expect(restored.hasCanaryDraw).toBe(true);
    expect(restored.hasCanaryHighlight).toBe(true);
    expect(restored.hasCanarySignature).toBe(true);
    expect(restored.hasCanaryImage).toBe(true);
    expect(restored.hasCanaryPageNumber).toBe(true);
    expect(restored.watermarkEnabled).toBe(true);
    expect(restored.watermarkText).toBe("CANARY-WATERMARK");
    expect(restored.bgImageEnabled).toBe(true);
    expect(restored.bgImageHasData).toBe(true);
  });
});
