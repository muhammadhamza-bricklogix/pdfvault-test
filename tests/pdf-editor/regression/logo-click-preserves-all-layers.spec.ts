import { expect, test } from "@playwright/test";

import {
  addAllCanaries,
  verifyCanaryLayers,
} from "../../helpers/canary-layers";
import { openSamplePdfInEditor, waitForPdfReady } from "../../helpers/editor";

/**
 * Kitchen-sink: signed-in user adds every layer type, clicks the logo.
 * All canaries must survive the `editor:navigate-after-save` pipeline
 * — including the pre-save flush + force-exit-editing block that PR
 * #68 (2026-09-10) added to match the Save button's behaviour.
 *
 * `clearFileAfter: false` on the dispatched event so the store is
 * still readable for assertion. In real usage the logo click uses
 * `clearFileAfter: true` so the store wipes; that's a UX detail,
 * not a save-flow correctness concern.
 */

test.describe("PDF editor — Logo click preserves all layers", () => {
  test("shape + text + drawing + highlight + signature + image + page-number + watermark + bg-image all survive logo click", async ({
    page,
  }) => {
    await page.route(
      (url) => url.pathname.endsWith("/documents/upload"),
      async (route) => {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            id: "canary-doc-logo-click",
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

    // Wait for hasUnsavedChanges to flip so the save actually runs
    // (nav-save has a `!hasUnsavedChanges` early return when force
    // is false — we set force: true below to be safe either way).
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
      window.dispatchEvent(
        new CustomEvent("editor:navigate-after-save", {
          detail: {
            url: "/dashboard",
            clearFileAfter: false,
            force: true,
          },
        }),
      );
    });

    await uploadResponsePromise;

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
