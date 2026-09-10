import { expect, test } from "@playwright/test";

import { openSamplePdfInEditor, waitForPdfReady } from "../../helpers/editor";

/**
 * Regression: signed-out user drops a PDF, adds edits, hard-refreshes → all
 * edits must survive via IDB (`useSignedOutAutoPersist` snapshots to IDB
 * every 800ms after `hasUnsavedChanges` flips true;
 * `PendingEditorFileHydrator` restores on next mount).
 *
 * This class of regression has bitten us multiple times in 2026-09:
 *   • 2026-09-09 — safety-net effect wrote fabricJsonByPage in a loop,
 *     eventually broke selection/eraser (reverted).
 *   • Ongoing "sidebar shows edits, main doesn't" reports.
 *
 * The spec adds two Fabric objects (rectangle + textbox) directly via the
 * test harness (bypasses UI flakiness), waits for the IDB snapshot debounce
 * to elapse, reloads, and asserts both objects are back on the canvas.
 */

// Signed-out — no storage state.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("PDF editor — signed-out reload preserves edits", () => {
  test("rectangle + textbox survive a hard reload via IDB rehydrate", async ({
    page,
  }) => {
    // Fresh session — clear IDB so a stale snapshot from a prior run can't
    // masquerade as this run's edits. Runs before navigation because we
    // need to be on the origin.
    await openSamplePdfInEditor(page);
    await waitForPdfReady(page);

    // Wait for the test harness + first render to settle.
    await page.waitForFunction(
      () => Boolean(window.__PDF_EDITOR_TEST__?.fabricCanvas),
      undefined,
      { timeout: 15_000 },
    );

    // Add two Fabric objects programmatically. `addRect` puts a red 100x60
    // rectangle at (200, 200); `addText` puts "REGRESSION-CANARY" at
    // (200, 320). Both non-editModeText overlays so they'll be exported
    // as-is and detected on reload by their textual identifiers.
    await page.evaluate(async () => {
      const fc = window.__PDF_EDITOR_TEST__!.fabricCanvas;

      if (!fc) throw new Error("fabricCanvas missing at test entry");

      const { Rect, Textbox } = await import("fabric");
      const rect = new Rect({
        left: 200,
        top: 200,
        width: 100,
        height: 60,
        fill: "red",
      });

      (rect as unknown as { editorType?: string }).editorType = "canaryRect";
      fc.add(rect);

      const text = new Textbox("REGRESSION-CANARY", {
        left: 200,
        top: 320,
        fontSize: 20,
        fill: "#000000",
        width: 260,
        splitByGrapheme: true,
      });

      (text as unknown as { editorType?: string }).editorType = "canaryText";
      fc.add(text);
      fc.fire("object:added", { target: rect });
      fc.fire("object:added", { target: text });
      fc.requestRenderAll();
    });

    // Wait for the debounced IDB snapshot to fire (useSignedOutAutoPersist
    // uses IDLE_DEBOUNCE_MS = 800). Buffer of 1500ms so a slow IDB write
    // still lands before the reload.
    await page.waitForTimeout(1500);

    // Hard reload — new pdf.js load, new Fabric mount, PendingEditorFileHydrator
    // Step 2 should probe IDB and restore file + fabricJsonByPage.
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForPdfReady(page);

    // Wait for the harness on the reloaded page.
    await page.waitForFunction(
      () => Boolean(window.__PDF_EDITOR_TEST__?.fabricCanvas),
      undefined,
      { timeout: 15_000 },
    );

    // Give the Fabric mount effect its font-ready await (see
    // use-fabric-canvas.ts mount effect) + a small buffer.
    await page.waitForTimeout(500);

    // Assertion: both canary objects are back on the live canvas.
    const restored = await page.evaluate(() => {
      const fc = window.__PDF_EDITOR_TEST__!.fabricCanvas;

      if (!fc) return null;

      const objs = fc.getObjects() as Array<{
        editorType?: string;
        text?: string;
      }>;

      return {
        totalObjects: objs.length,
        hasCanaryRect: objs.some((o) => o.editorType === "canaryRect"),
        hasCanaryText: objs.some(
          (o) => o.editorType === "canaryText" && o.text === "REGRESSION-CANARY",
        ),
      };
    });

    expect(restored, "test harness missing after reload").not.toBeNull();
    expect(restored!.hasCanaryRect).toBe(true);
    expect(restored!.hasCanaryText).toBe(true);
    expect(restored!.totalObjects).toBeGreaterThanOrEqual(2);
  });
});
