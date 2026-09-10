import { expect, test } from "@playwright/test";

import { openSamplePdfInEditor, waitForPdfReady } from "../../helpers/editor";

/**
 * Regression: user creates a shape, clicks Save, then tries to click
 * the shape again. The shape MUST remain selectable + erasable after
 * the save.
 *
 * Reported 2026-09-10 (Uzair): "my edited objects are not clickable
 * and choosable after saving." The 2026-06-09 design intent —
 * `applyPristineSweep` strips shapes / drawings / highlights / user-
 * images / signatures / arrows from `fabricJsonByPage` post-save
 * because they're baked into the bytes — killed post-save
 * interactivity in the editor. This spec pins the fix in place:
 *
 *   • Draw a rect on the canvas.
 *   • Fire `editor:save` (stubbed backend so no real library row).
 *   • Wait for `applyPostSaveReset` to fire (hasUnsavedChanges →
 *     false, currentDocumentId set).
 *   • Assert the rect is STILL in `fabricJsonByPage[currentPage]`
 *     AND still on the live Fabric canvas AND still has
 *     `selectable: true`, `evented: true`.
 *   • Verify Fabric's `findTarget` resolves the rect at its scene
 *     coords — the actual signal that click-to-select works.
 */

test.describe("PDF editor — shape stays selectable + erasable after Save", () => {
  test("rectangle survives applyPristineSweep and remains selectable + Fabric.findTarget resolves it", async ({
    page,
  }) => {
    await page.route(
      (url) => url.pathname.endsWith("/documents/upload"),
      async (route) => {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            id: "canary-doc-save-shape",
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

    // Draw the canary rect. Match the shape-tool mouseUp path:
    // create Rect → set evented + selectable to true → fire
    // object:added so the history handler serializes it into
    // fabricJsonByPage.
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
      rect.set({ evented: true, selectable: true });
      fc.add(rect);
      fc.fire("object:added", { target: rect });
      fc.requestRenderAll();
    });

    // Wait for the store's dirty flag to flip — proves the history
    // handler picked up object:added and serialized the rect into
    // `fabricJsonByPage`.
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

    // Fire the Save button's event and wait for the stubbed upload
    // to complete.
    const uploadResponsePromise = page.waitForResponse((response) =>
      response.url().includes("/documents/upload"),
    );

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("editor:save"));
    });

    await uploadResponsePromise;

    // Wait for applyPostSaveReset: hasUnsavedChanges → false,
    // currentDocumentId set.
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
        currentDocumentId: "canary-doc-save-shape",
      });

    // Assertions:
    //   1. Rect present in `fabricJsonByPage[currentPage]` post-save.
    //   2. Rect present on live Fabric canvas.
    //   3. Rect has selectable + evented = true.
    //   4. Fabric.findTarget resolves the rect at scene (240, 240)
    //      — the actual click-to-select signal.
    const state = await page.evaluate(() => {
      const store = window.__PDF_EDITOR_TEST__!.getStore();
      const pageJson = store.fabricJsonByPage.get(store.currentPage);
      const storedObjs = (() => {
        if (!pageJson) return [] as Array<{ editorType?: string }>;
        try {
          const parsed = JSON.parse(pageJson) as {
            objects?: Array<{ editorType?: string }>;
          };

          return parsed.objects ?? [];
        } catch {
          return [];
        }
      })();

      const fc = window.__PDF_EDITOR_TEST__!.fabricCanvas;
      const liveObjs = fc
        ? (fc.getObjects() as Array<{
            editorType?: string;
            selectable?: boolean;
            evented?: boolean;
          }>)
        : [];
      const liveRect = liveObjs.find((o) => o.editorType === "canaryRect");

      return {
        storedRectPresent: storedObjs.some(
          (o) => o.editorType === "canaryRect",
        ),
        liveRectPresent: !!liveRect,
        liveRectSelectable: liveRect?.selectable ?? null,
        liveRectEvented: liveRect?.evented ?? null,
      };
    });

    expect(
      state.storedRectPresent,
      "rect stripped from fabricJsonByPage by applyPristineSweep",
    ).toBe(true);
    expect(
      state.liveRectPresent,
      "rect gone from live Fabric canvas after save",
    ).toBe(true);
    expect(
      state.liveRectSelectable,
      "rect.selectable is false after save — click-to-select broken",
    ).toBe(true);
    expect(
      state.liveRectEvented,
      "rect.evented is false after save — eraser can't find target",
    ).toBe(true);

    // findTarget check — the definitive click-to-select signal.
    const findTargetResult = await page.evaluate(() => {
      const fc = window.__PDF_EDITOR_TEST__!.fabricCanvas!;
      const canvasEl = (fc as unknown as { upperCanvasEl: HTMLCanvasElement })
        .upperCanvasEl;
      const rect = canvasEl.getBoundingClientRect();
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
        foundRect: target?.editorType === "canaryRect",
      };
    });

    expect(
      findTargetResult.foundRect,
      "Fabric.findTarget did NOT resolve the rect at scene(240,240) after Save — click-to-select is broken",
    ).toBe(true);
  });
});
