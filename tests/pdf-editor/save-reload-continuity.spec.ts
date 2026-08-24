import { expect, test } from "@playwright/test";
import fs from "node:fs";

import { FIXTURES, openSamplePdfInEditor, waitForPdfReady } from "../helpers/editor";

// Public specs don't need auth.
test.use({ storageState: { cookies: [], origins: [] } });

/**
 * Guards the post-save reload UX regressions introduced 2026-08-24:
 *
 *   (a) `hasEverLoadedPdf` sticky latch in the store — the second time a
 *       `pdfDocument === null` transition happens, `EditorLayout` must NOT
 *       return `<EditorLoadingShell />` or `null` (which unmounts the whole
 *       editor tree and blanks the pdf canvas).
 *
 *   (b) `use-page-renderer.ts` skips `canvas.width = viewport.width` when
 *       dims are unchanged, because assigning to `canvas.width` — even to
 *       the same value — is spec-mandated to clear the bitmap to fully
 *       transparent (reads as a black flash on the pv-canvas background).
 *
 *   (c) In-flight render on the OLD (just-destroyed) pdf.js doc throws
 *       `Cannot read properties of null (reading 'sendWithPromise')`;
 *       cosmetic noise that must be silenced from the console.
 *
 * The test simulates a save-triggered file swap by pushing a fresh `File`
 * blob of the same bytes into `store.setFile` — the same shape
 * `applyPostSaveReset(savedFile)` uses. The tree should stay mounted,
 * the canvas should stay in the DOM, and the console should be quiet.
 */
test.describe("PDF editor — save-reload continuity", () => {
  test("editor tree stays mounted through a file-swap reload; no black flash; no sendWithPromise noise", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        consoleErrors.push(msg.text());
      }
    });

    await openSamplePdfInEditor(page);
    await waitForPdfReady(page);

    // Wait for the test harness + first render to settle.
    await page.waitForFunction(
      () => !!window.__PDF_EDITOR_TEST__?.getStore?.(),
    );
    await page.waitForFunction(
      () => window.__PDF_EDITOR_TEST__!.getStore().pdfDocument != null,
      undefined,
      { timeout: 15_000 },
    );

    // Prove the sticky latch flipped on the initial load.
    const latchedAfterFirstLoad = await page.evaluate(
      () => window.__PDF_EDITOR_TEST__!.getStore().hasEverLoadedPdf,
    );
    expect(latchedAfterFirstLoad).toBe(true);

    // Capture the visible-canvas selector so we can prove it stays mounted.
    const canvasLocator = page.getByRole("img", { name: /PDF page/i }).first();
    const initialCanvasHandle = await canvasLocator.elementHandle();
    expect(initialCanvasHandle).not.toBeNull();

    // Sample a pixel in the middle of the rendered PDF page. Any non-black
    // (>0) pixel means content is painted. Post-swap, this pixel must
    // remain non-black across the full reload window — no black flash.
    const samplePixelDuringReload = async () =>
      canvasLocator.evaluate((el) => {
        const canvas = el as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");

        if (!ctx || canvas.width === 0 || canvas.height === 0) return null;
        const x = Math.floor(canvas.width / 2);
        const y = Math.floor(canvas.height / 2);
        const p = ctx.getImageData(x, y, 1, 1).data;

        // Alpha channel is our black-flash proxy: freshly-cleared canvas
        // is fully transparent (alpha 0), which composites black over the
        // grey pv-canvas background. Any painted PDF pixel has alpha 255.
        return { r: p[0], g: p[1], b: p[2], a: p[3] };
      });

    const preSwapPixel = await samplePixelDuringReload();
    expect(preSwapPixel, "pdf canvas must have painted content before swap")
      .not.toBeNull();
    expect(preSwapPixel!.a).toBeGreaterThan(0);

    // Push a fresh File with the SAME bytes — mimics what
    // `applyPostSaveReset(savedFile)` does after Save uploads baked bytes.
    // Same-dim same-content, so the `canvas.width` guard should skip the
    // clear and pdf.js should repaint in-place with no visible break.
    // Bytes go over as base64 because raw ArrayBuffer args through
    // page.evaluate serialize as {} on Chromium.
    const pdfBytes = fs.readFileSync(FIXTURES.pdf);
    const base64 = pdfBytes.toString("base64");

    await page.evaluate((b64) => {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);

      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const store = window.__PDF_EDITOR_TEST__!.getStore();
      const freshFile = new File([bytes], "sample.pdf", {
        type: "application/pdf",
        lastModified: Date.now(),
      });

      store.setFile(freshFile);
    }, base64);

    // Poll the visible canvas during the reload window. The dimensions
    // are identical → the `canvas.width` assignment guard must skip →
    // pixel alpha stays > 0 across the whole transition. If the regression
    // returns, this asserts fails within the first sample.
    const alphaSamples: number[] = [];

    for (let i = 0; i < 8; i++) {
      const p = await samplePixelDuringReload();

      alphaSamples.push(p?.a ?? -1);
      await page.waitForTimeout(50);
    }

    // Every sample must have painted content — no black frame anywhere in
    // the reload window.
    for (const alpha of alphaSamples) {
      expect(alpha, `canvas alpha samples must all stay > 0 (got ${alphaSamples.join(",")})`)
        .toBeGreaterThan(0);
    }

    // Wait for the reload to complete (new pdfDocument non-null again).
    await page.waitForFunction(
      () => window.__PDF_EDITOR_TEST__!.getStore().pdfDocument != null,
      undefined,
      { timeout: 15_000 },
    );

    // The canvas element must be the SAME DOM node — proves the editor
    // tree never unmounted. `hasEverLoadedPdf` gate covers this.
    const postCanvasHandle = await canvasLocator.elementHandle();

    expect(postCanvasHandle).not.toBeNull();
    const isSameNode = await page.evaluate(
      ([a, b]) => a === b,
      [initialCanvasHandle, postCanvasHandle] as const,
    );

    expect(isSameNode, "the pdf canvas element must persist across a reload").toBe(true);

    // The EditorLoadingShell must not have been mounted during the swap.
    // It uses the `role="status"` + specific text; a rough guard is fine.
    const loadingShellsSeen = await page.evaluate(() => {
      // If the shell had rendered even briefly, its skeleton class remains
      // detectable via DOM query. We check for its presence NOW (post-
      // reload) as a smoke test that nothing lingered.
      return document.querySelectorAll('[data-testid="editor-loading-shell"]')
        .length;
    });

    expect(loadingShellsSeen).toBe(0);

    // Console must not contain the specific pdf.js worker-destroy noise.
    const sendWithPromiseErrors = consoleErrors.filter((e) =>
      /sendWithPromise/i.test(e),
    );

    expect(
      sendWithPromiseErrors,
      "in-flight-render error must be silenced on doc destroy",
    ).toHaveLength(0);
  });
});
