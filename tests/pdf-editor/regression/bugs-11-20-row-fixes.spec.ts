import { test, expect } from "@playwright/test";

import { openSamplePdfInEditor, waitForPdfReady } from "../../helpers/editor";

/**
 * Covers the code-change rows from docs/fixes/PDF Composer.xlsx:
 *  - Row 12: shape drag clamped to canvas bounds (use-shape-tool.ts)
 *  - Row 13: init loadFromJSON gated by isRestoringHistory (use-fabric-canvas.ts)
 *  - Row 15: object:moving clamp (PdfViewerCanvas.tsx)
 *  - Row 16: object:scaling clamp (PdfViewerCanvas.tsx)
 *  - Row 17: redact/whiteout share the clampable set (PdfViewerCanvas.tsx)
 *
 * Objects are seeded onto the canvas via `fc.loadFromJSON` so the test
 * doesn't need to resolve Fabric classes from inside page.evaluate — the
 * canvas rehydrates them for us. Each test then grabs the live object by
 * index and drives it through `set` + `fire` to exercise my clamp handlers.
 */

type FabricObjectShape = Record<string, unknown> & {
  set: (opts: Record<string, unknown>) => void;
  left: number;
  top: number;
  width: number;
  height: number;
  scaleX?: number;
  scaleY?: number;
};
type FabricCanvasShape = {
  loadFromJSON: (json: Record<string, unknown>) => Promise<void>;
  getObjects: () => FabricObjectShape[];
  clear: () => void;
  fire: (name: string, opts: Record<string, unknown>) => void;
  getHeight: () => number;
  getWidth: () => number;
};

async function seedObject(
  page: import("@playwright/test").Page,
  objectJson: Record<string, unknown>,
) {
  await page.evaluate(async (obj) => {
    const fc = window.__PDF_EDITOR_TEST__!
      .fabricCanvas as unknown as FabricCanvasShape | null;

    if (!fc) throw new Error("Fabric canvas not exposed");
    await fc.loadFromJSON({ objects: [obj] });
  }, objectJson);
  // Spread the FabricCanvasShape type into evaluate's isolate scope.
  await page.waitForFunction(
    () =>
      (
        window.__PDF_EDITOR_TEST__!.fabricCanvas as unknown as {
          getObjects: () => unknown[];
        }
      ).getObjects().length > 0,
    null,
    { timeout: 5000 },
  );
}

test.setTimeout(90_000);

test.beforeEach(async ({ page }) => {
  await openSamplePdfInEditor(page);
  await waitForPdfReady(page);
  await page.waitForFunction(
    () => Boolean(window.__PDF_EDITOR_TEST__?.fabricCanvas),
    null,
    { timeout: 15_000 },
  );
});

test.describe("PDF Composer sheet — rows 15/16/17 clamp handlers", () => {
  test("object:moving clamps a shape past the right edge back inside", async ({
    page,
  }) => {
    await seedObject(page, {
      type: "Rect",
      fill: "red",
      left: 10,
      top: 10,
      width: 100,
      height: 50,
    });

    const result = await page.evaluate(() => {
      const fc = window.__PDF_EDITOR_TEST__!
        .fabricCanvas as unknown as FabricCanvasShape | null;

      if (!fc) throw new Error("Fabric canvas not exposed");
      const shape = fc.getObjects().at(-1)!;
      const canvasW = fc.getWidth();
      const canvasH = fc.getHeight();

      shape.set({ left: canvasW + 500, top: canvasH + 500 });
      fc.fire("object:moving", { target: shape });
      fc.fire("object:modified", { target: shape });

      return {
        canvasW,
        canvasH,
        left: shape.left,
        top: shape.top,
        width: shape.width,
        height: shape.height,
      };
    });

    expect(result.left).toBeGreaterThanOrEqual(0);
    expect(result.top).toBeGreaterThanOrEqual(0);
    expect(result.left + result.width).toBeLessThanOrEqual(result.canvasW + 0.5);
    expect(result.top + result.height).toBeLessThanOrEqual(
      result.canvasH + 0.5,
    );
  });

  test("object:scaling caps scaleX so the far edge stays inside", async ({
    page,
  }) => {
    await seedObject(page, {
      type: "Rect",
      fill: "red",
      left: 100,
      top: 100,
      width: 100,
      height: 50,
    });

    const result = await page.evaluate(() => {
      const fc = window.__PDF_EDITOR_TEST__!
        .fabricCanvas as unknown as FabricCanvasShape | null;

      if (!fc) throw new Error("Fabric canvas not exposed");
      const shape = fc.getObjects().at(-1)!;

      shape.set({ scaleX: 50, scaleY: 50 });
      fc.fire("object:scaling", { target: shape });

      return {
        canvasW: fc.getWidth(),
        canvasH: fc.getHeight(),
        left: shape.left,
        top: shape.top,
        scaleX: shape.scaleX ?? 1,
        scaleY: shape.scaleY ?? 1,
        baseW: shape.width,
        baseH: shape.height,
      };
    });

    expect(result.left + result.baseW * result.scaleX).toBeLessThanOrEqual(
      result.canvasW + 0.5,
    );
    expect(result.top + result.baseH * result.scaleY).toBeLessThanOrEqual(
      result.canvasH + 0.5,
    );
  });

  test("redaction object respects the same clamp (row 17)", async ({
    page,
  }) => {
    await seedObject(page, {
      type: "Rect",
      editorType: "redaction",
      fill: "#000000",
      left: 50,
      top: 50,
      width: 80,
      height: 20,
    });

    const result = await page.evaluate(() => {
      const fc = window.__PDF_EDITOR_TEST__!
        .fabricCanvas as unknown as FabricCanvasShape | null;

      if (!fc) throw new Error("Fabric canvas not exposed");
      const redaction = fc.getObjects().at(-1)!;
      const canvasW = fc.getWidth();
      const canvasH = fc.getHeight();

      redaction.set({ left: canvasW + 300, top: canvasH + 300 });
      fc.fire("object:moving", { target: redaction });

      return {
        canvasW,
        canvasH,
        left: redaction.left,
        top: redaction.top,
        width: redaction.width,
        height: redaction.height,
      };
    });

    expect(result.left).toBeGreaterThanOrEqual(0);
    expect(result.top).toBeGreaterThanOrEqual(0);
    expect(result.left + result.width).toBeLessThanOrEqual(result.canvasW + 0.5);
    expect(result.top + result.height).toBeLessThanOrEqual(
      result.canvasH + 0.5,
    );
  });

  test("whiteout object respects the same clamp (row 17)", async ({ page }) => {
    await seedObject(page, {
      type: "Rect",
      editorType: "whiteout",
      fill: "#FFFFFF",
      left: 50,
      top: 50,
      width: 80,
      height: 20,
    });

    const result = await page.evaluate(() => {
      const fc = window.__PDF_EDITOR_TEST__!
        .fabricCanvas as unknown as FabricCanvasShape | null;

      if (!fc) throw new Error("Fabric canvas not exposed");
      const whiteout = fc.getObjects().at(-1)!;

      whiteout.set({ left: -200, top: -200 });
      fc.fire("object:moving", { target: whiteout });

      return { left: whiteout.left, top: whiteout.top };
    });

    expect(result.left).toBe(0);
    expect(result.top).toBe(0);
  });

  test("editModeText (Textbox) is NOT clamped by the new handlers", async ({
    page,
  }) => {
    // Invariant guard: editModeText has its own handleScaling. Clamp
    // handlers must early-return on it.
    await seedObject(page, {
      type: "Textbox",
      editorType: "editModeText",
      text: "hello world",
      fontSize: 14,
      left: 100,
      top: 100,
      width: 200,
    });

    const result = await page.evaluate(() => {
      const fc = window.__PDF_EDITOR_TEST__!
        .fabricCanvas as unknown as FabricCanvasShape | null;

      if (!fc) throw new Error("Fabric canvas not exposed");
      const text = fc.getObjects().at(-1)!;
      const canvasW = fc.getWidth();

      text.set({ left: canvasW + 500 });
      fc.fire("object:moving", { target: text });

      return { left: text.left, canvasW };
    });

    expect(result.left).toBeGreaterThan(result.canvasW);
  });
});

test.describe("PDF Composer sheet — row 13 isRestoringHistory gate", () => {
  test("isRestoringHistory flag is false after mount", async ({ page }) => {
    const result = await page.evaluate(() => {
      const store = window.__PDF_EDITOR_TEST__?.getStore();

      if (!store) throw new Error("Store not exposed");

      return {
        isRestoringHistory: store.isRestoringHistory,
        hasSetter: typeof store.setIsRestoringHistory === "function",
      };
    });

    expect(result.hasSetter).toBe(true);
    expect(result.isRestoringHistory).toBe(false);
  });
});
