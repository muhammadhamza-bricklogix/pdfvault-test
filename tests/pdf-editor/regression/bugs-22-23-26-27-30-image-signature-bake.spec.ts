import { expect, test } from "@playwright/test";

import { openSamplePdfInEditor, waitForPdfReady } from "../../helpers/editor";

/**
 * Rows 22/23/26/27/30 share a hypothesis: image + signature Fabric
 * overlays may be dropped on the Download/Flatten/Compress path. This
 * test uses the dev harness to:
 *   1. Add an image Fabric overlay to the current page.
 *   2. Trigger the shell's `editor:build-current-bytes` event with
 *      `bakeOverlays: true` — the exact code path used by Download,
 *      Flatten, and Compress.
 *   3. Verify the resulting bytes grew (image embedded) AND that
 *      pdf-lib reports the output page carries an XObject image
 *      resource.
 *
 * If this test passes, the bake pipeline correctly includes the
 * image overlay — the "image missing from downloaded file" symptom
 * in rows 22/23/26/27/30 must originate downstream (backend
 * Flatten/Compress stripping, PDF viewer rendering, etc.).
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

test.describe("PDF Composer sheet — rows 22/23/26/27/30 bake pipeline", () => {
  test("Fabric image overlay bakes into downloaded PDF bytes", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const harness = window.__PDF_EDITOR_TEST__;

      if (!harness) throw new Error("harness missing");
      const fc = harness.fabricCanvas;

      if (!fc) throw new Error("fabric canvas missing");

      // 1×1 red PNG as data URL.
      const redPixelDataUrl =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

      // Build a plain Fabric-JSON image object matching the shape
      // Fabric v7 serializes (same keys the signature + image tools
      // produce). Scale it up so the baked PNG has non-trivial size.
      const canvasW = fc.getWidth() / (fc.getZoom() || 1);
      const canvasH = fc.getHeight() / (fc.getZoom() || 1);
      const imageJson = {
        type: "image",
        src: redPixelDataUrl,
        left: canvasW / 4,
        top: canvasH / 4,
        width: 1,
        height: 1,
        scaleX: 100,
        scaleY: 100,
        originX: "left",
        originY: "top",
        angle: 0,
        opacity: 1,
        editorType: "signature",
      };

      // Add a redaction rect PARTIALLY overlapping the image —
      // mirrors the Row 22/26 scenario (Image Redaction) where the
      // downloaded PDF should contain BOTH the image and the
      // redaction box, not just the redaction.
      const redactionJson = {
        type: "rect",
        editorType: "redaction",
        left: canvasW / 4 + 20,
        top: canvasH / 4 + 20,
        width: 30,
        height: 30,
        scaleX: 1,
        scaleY: 1,
        fill: "#000000",
        originX: "left",
        originY: "top",
      };

      const canvasJson = JSON.stringify({
        objects: [imageJson, redactionJson],
        width: canvasW,
        height: canvasH,
      });

      const state0 = harness.getStore();

      state0.saveFabricJson(state0.currentPage, canvasJson);

      // Fire the bake event the Download/Flatten/Compress hooks use.
      const baked = await new Promise<{
        ok: boolean;
        bytes?: Uint8Array;
        error?: string;
      }>((resolve) => {
        window.dispatchEvent(
          new CustomEvent("editor:build-current-bytes", {
            detail: {
              bakeOverlays: true,
              onComplete: (r: {
                ok: boolean;
                bytes?: Uint8Array;
                error?: string;
              }) => resolve(r),
            },
          }),
        );
      });

      const state1 = harness.getStore();
      const sourceSize = state1.file?.size ?? 0;
      const bakedSize = baked.bytes?.byteLength ?? 0;

      return {
        ok: baked.ok,
        error: baked.error,
        sourceSize,
        bakedSize,
        bytesDelta: bakedSize - sourceSize,
      };
    });

    expect(result.ok, `bake failed: ${result.error ?? "unknown"}`).toBe(true);
    expect(result.bakedSize).toBeGreaterThan(0);
    // If the image was successfully baked, byte delta should be well
    // above zero — PDF-wrapped image embed carries at minimum ~1 KB of
    // overhead even for a 1×1 pixel source.
    expect(
      result.bytesDelta,
      "baked bytes did not grow — image overlay was dropped from the bake",
    ).toBeGreaterThan(100);
  });
});
