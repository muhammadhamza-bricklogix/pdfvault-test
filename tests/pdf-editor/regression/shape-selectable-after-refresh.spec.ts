import { expect, test } from "@playwright/test";

import { openSamplePdfInEditor, waitForPdfReady } from "../../helpers/editor";

/**
 * Regression: user creates a shape (rect/ellipse), refreshes the page,
 * then tries to click the shape to select it or erase it. After refresh
 * the shape must remain selectable + erasable.
 *
 * Reported 2026-09-10 (Uzair): "Shape can no longer be selected or
 * erased after refresh."
 *
 * Repro pattern the user describes: create shape → shape selectable OK
 * → refresh (Cmd+R / Ctrl+R) → try to click the shape → nothing
 * happens.
 *
 * Testable assertion: after refresh, the restored Fabric object must
 * have `selectable: true` AND `evented: true` AND the canvas must
 * have `selection: true` + `skipTargetFind: false`. If any of those
 * four are wrong, click-to-select is broken and eraser breaks too
 * (it uses `findTarget` under the hood which respects the same
 * flags).
 *
 * Uses the signed-out reload path (IDB rehydrate) because it doesn't
 * need a backend + gives fastest CI signal. A signed-in equivalent
 * would test the cloud editorState rehydrate path — same failure
 * class if this one fails.
 */

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("PDF editor — shape stays selectable + erasable after refresh", () => {
  test("rectangle restored from IDB has selectable:true, evented:true, canvas.selection:true, canvas.skipTargetFind:false", async ({
    page,
  }) => {
    await openSamplePdfInEditor(page);
    await waitForPdfReady(page);
    await page.waitForFunction(
      () => Boolean(window.__PDF_EDITOR_TEST__?.fabricCanvas),
      undefined,
      { timeout: 15_000 },
    );

    // Draw a rectangle via the test harness, following the same code
    // path use-shape-tool.ts uses at mouseUp: create Rect, then set
    // evented+selectable to true (mouseUp restores interactivity).
    await page.evaluate(async () => {
      const fc = window.__PDF_EDITOR_TEST__!.fabricCanvas;

      if (!fc) throw new Error("fabricCanvas missing");

      const { Rect } = await import("fabric");
      const rect = new Rect({
        left: 200,
        top: 200,
        width: 120,
        height: 80,
        fill: "red",
      });

      (rect as unknown as { editorType?: string }).editorType = "canaryRect";
      // Match the shape tool's mouseUp: force interactive.
      rect.set({ evented: true, selectable: true });
      fc.add(rect);
      fc.fire("object:added", { target: rect });
      fc.requestRenderAll();
    });

    // Wait for the debounced IDB snapshot (useSignedOutAutoPersist
    // IDLE_DEBOUNCE_MS = 800). 1500ms buffer.
    await page.waitForTimeout(1500);

    // ── Refresh ──
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForPdfReady(page);
    await page.waitForFunction(
      () => Boolean(window.__PDF_EDITOR_TEST__?.fabricCanvas),
      undefined,
      { timeout: 15_000 },
    );

    // Buffer for the Fabric mount effect's `document.fonts.ready` await.
    await page.waitForTimeout(500);

    // Post-refresh assertions:
    //   1. Rect restored on the canvas.
    //   2. Rect's `selectable` + `evented` are both TRUE.
    //   3. Canvas `selection` is TRUE + `skipTargetFind` is FALSE.
    // All four must hold for click-to-select to work + eraser to find
    // targets.
    const state = await page.evaluate(() => {
      const fc = window.__PDF_EDITOR_TEST__!.fabricCanvas;

      if (!fc) return null;

      const objs = fc.getObjects() as Array<{
        editorType?: string;
        selectable?: boolean;
        evented?: boolean;
        type?: string;
      }>;
      const rect = objs.find((o) => o.editorType === "canaryRect");

      return {
        rectPresent: !!rect,
        rectSelectable: rect?.selectable ?? null,
        rectEvented: rect?.evented ?? null,
        canvasSelection: (fc as unknown as { selection: boolean }).selection,
        canvasSkipTargetFind: (
          fc as unknown as { skipTargetFind?: boolean }
        ).skipTargetFind ?? false,
      };
    });

    expect(state, "test harness missing after refresh").not.toBeNull();
    expect(state!.rectPresent, "rectangle lost after refresh").toBe(true);
    expect(
      state!.rectSelectable,
      "rectangle.selectable is false after refresh — click-to-select broken",
    ).toBe(true);
    expect(
      state!.rectEvented,
      "rectangle.evented is false after refresh — eraser can't find target",
    ).toBe(true);
    expect(
      state!.canvasSelection,
      "canvas.selection is false after refresh — rubber-band select disabled",
    ).toBe(true);
    expect(
      state!.canvasSkipTargetFind,
      "canvas.skipTargetFind is true after refresh — hit-testing disabled",
    ).toBe(false);

    // Extra: verify Fabric's own findTarget resolves the rect when
    // asked. If any of the above hold true but findTarget still fails,
    // there's a lower-level Fabric issue.
    const findTargetResult = await page.evaluate(() => {
      const fc = window.__PDF_EDITOR_TEST__!.fabricCanvas!;
      const canvasEl = (fc as unknown as { upperCanvasEl: HTMLCanvasElement })
        .upperCanvasEl;
      const rect = canvasEl.getBoundingClientRect();
      // Click at (240, 240) in scene coords — inside the rect at
      // (200,200) width=120 height=80. Convert to page coords using
      // the upper-canvas's client rect origin.
      const clientX = rect.left + 240;
      const clientY = rect.top + 240;
      const fake = new MouseEvent("mousedown", {
        clientX,
        clientY,
        bubbles: true,
      });
      const findTarget = (
        fc as unknown as {
          findTarget?: (e: Event) => { editorType?: string } | undefined;
        }
      ).findTarget;
      const target = findTarget?.call(fc, fake) ?? undefined;

      return {
        hasFindTarget: typeof findTarget === "function",
        foundRect: target?.editorType === "canaryRect",
      };
    });

    expect(findTargetResult.hasFindTarget).toBe(true);
    expect(
      findTargetResult.foundRect,
      "Fabric.findTarget didn't resolve the rect at scene(240,240) — click-to-select is broken",
    ).toBe(true);
  });
});
