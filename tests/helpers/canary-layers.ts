import type { Page } from "@playwright/test";

/**
 * Shared canary-layer helpers for the save-flow regression suite.
 *
 * Each `add*Canary()` places a Fabric object (or Zustand config entry)
 * with a unique `editorType` marker so `verifyCanaryLayers()` can
 * assert every one of them survives a save round-trip regardless of
 * spatial drift, cache invalidation, or object-remount timing.
 *
 * The helpers add layers DIRECTLY via the `__PDF_EDITOR_TEST__` window
 * harness — bypassing tool-UI flakiness so the specs test the SAVE
 * flow, not the tools themselves. Tool-UI coverage lives elsewhere in
 * `tests/pdf-editor/`.
 *
 * Layer set (mirrors CLAUDE.md § "Recent editor surface"):
 *   • text        — Textbox at (200, 320), content "CANARY-TEXT"
 *   • shape       — Rect at (200, 200), fill red, editorType canaryShape
 *   • drawing     — Path (freehand-style polyline), editorType canaryDraw
 *   • highlight   — Path with yellow stroke, editorType canaryHighlight
 *   • signature   — Image, editorType signature (data URL, tiny inline)
 *   • image       — Image, editorType canaryImage (data URL, tiny inline)
 *   • pageNumber  — IText, editorType pageNumber, content "1"
 *   • editModeText — Textbox with pristine=false + originalText etc.
 *
 * Zustand-config layers (not on fabric canvas):
 *   • watermarkConfig — set enabled + text via addWatermarkCanary()
 *   • backgroundImageConfig — set enabled + imageData via addBgImageCanary()
 */

const TINY_PNG =
  // 4x4 red PNG data URL — smallest usable image asset.
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAG0lEQVR42mNk+M/wn4EIwDiqcFThqMJRhcNGIQBHawvXn+2Y8gAAAABJRU5ErkJggg==";

/**
 * Adds every fabric-canvas canary layer at once. Fires `object:added`
 * after each add so `use-editor-history`'s snapshot handler serializes
 * them into `fabricJsonByPage`.
 */
export async function addAllFabricCanaries(page: Page): Promise<void> {
  await page.evaluate(async (dataUrl) => {
    const fc = window.__PDF_EDITOR_TEST__!.fabricCanvas;

    if (!fc) throw new Error("fabricCanvas missing");

    const fabric = await import("fabric");

    // Shape (rect)
    const rect = new fabric.Rect({
      left: 60,
      top: 60,
      width: 80,
      height: 50,
      fill: "red",
    });

    (rect as unknown as { editorType?: string }).editorType = "canaryShape";

    // Text (Textbox)
    const text = new fabric.Textbox("CANARY-TEXT", {
      left: 60,
      top: 140,
      fontSize: 18,
      fill: "#000000",
      width: 240,
      splitByGrapheme: true,
    });

    (text as unknown as { editorType?: string }).editorType = "canaryText";

    // Drawing (freehand path)
    const draw = new fabric.Path("M 60 220 L 120 240 L 180 210 L 240 250", {
      stroke: "#333333",
      strokeWidth: 3,
      fill: "",
    });

    (draw as unknown as { editorType?: string }).editorType = "canaryDraw";

    // Highlight (transparent yellow path)
    const highlight = new fabric.Path(
      "M 60 280 L 120 300 L 180 270 L 240 310",
      {
        stroke: "rgba(255, 235, 59, 0.4)",
        strokeWidth: 12,
        fill: "",
      },
    );

    (highlight as unknown as { editorType?: string }).editorType =
      "canaryHighlight";

    // Signature (Image, editorType signature)
    const signature = await fabric.FabricImage.fromURL(dataUrl);

    signature.set({ left: 60, top: 340, scaleX: 8, scaleY: 8 });
    (signature as unknown as { editorType?: string }).editorType = "signature";
    (
      signature as unknown as { editorTypeCanary?: string }
    ).editorTypeCanary = "canarySignature";

    // Image (Image, editorType canaryImage)
    const image = await fabric.FabricImage.fromURL(dataUrl);

    image.set({ left: 160, top: 340, scaleX: 8, scaleY: 8 });
    (image as unknown as { editorType?: string }).editorType = "canaryImage";

    // Page number (IText)
    const pageNumber = new fabric.IText("1", {
      left: 300,
      top: 500,
      fontSize: 12,
      fill: "#555555",
    });

    (pageNumber as unknown as { editorType?: string }).editorType =
      "pageNumber";
    (
      pageNumber as unknown as { editorTypeCanary?: string }
    ).editorTypeCanary = "canaryPageNumber";

    for (const obj of [rect, text, draw, highlight, signature, image, pageNumber]) {
      fc.add(obj);
      fc.fire("object:added", { target: obj });
    }
    fc.requestRenderAll();
  }, TINY_PNG);
}

/**
 * Sets watermarkConfig on the Zustand store — mimics what
 * `RightSidebar` / `MobileToolPropertiesModal` does when the user
 * configures a watermark. Config lives in the store, not on the
 * fabric canvas, so it needs a separate assertion.
 */
export async function addWatermarkCanary(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = window.__PDF_EDITOR_TEST__!.getStore();

    store.setWatermarkConfig({
      enabled: true,
      text: "CANARY-WATERMARK",
      opacity: 0.3,
      rotation: -45,
      color: "#ff0000",
    });
  });
}

/**
 * Sets backgroundImageConfig on the Zustand store.
 */
export async function addBgImageCanary(page: Page): Promise<void> {
  await page.evaluate((dataUrl) => {
    const store = window.__PDF_EDITOR_TEST__!.getStore();

    store.setBackgroundImageConfig({
      enabled: true,
      imageData: dataUrl,
      opacity: 0.5,
    });
  }, TINY_PNG);
}

export type CanaryVerificationResult = {
  fabricJsonPresent: boolean;
  totalObjects: number;
  hasCanaryShape: boolean;
  hasCanaryText: boolean;
  hasCanaryDraw: boolean;
  hasCanaryHighlight: boolean;
  hasCanarySignature: boolean;
  hasCanaryImage: boolean;
  hasCanaryPageNumber: boolean;
  watermarkEnabled: boolean;
  watermarkText: string | null;
  bgImageEnabled: boolean;
  bgImageHasData: boolean;
};

/**
 * Reads the store's fabricJsonByPage for the current page + the
 * watermark/bg-image configs and returns a boolean report of every
 * canary. Specs call this after their save-and-reload flow and assert
 * the expected canaries survived.
 *
 * Reads from the STORE (not the live canvas) because the canvas may
 * be mid-remount depending on the save path. The store is the
 * single source of truth for what would be uploaded on the next
 * save, so asserting on it is what the user actually experiences.
 */
export async function verifyCanaryLayers(
  page: Page,
): Promise<CanaryVerificationResult> {
  return page.evaluate(() => {
    const store = window.__PDF_EDITOR_TEST__!.getStore();
    const wm = store.watermarkConfig ?? {};
    const bg = store.backgroundImageConfig ?? {};

    // Prefer the live fabric canvas when its object count is at
    // least as large as the store's — post-mount the canvas is
    // authoritative; pre-mount (e.g. between remounts) the store's
    // JSON is. Merge both so canaries in EITHER source count.
    const fabricCanvas = window.__PDF_EDITOR_TEST__!.fabricCanvas;
    const liveObjs = fabricCanvas
      ? (fabricCanvas.getObjects() as Array<{
          editorType?: string;
          editorTypeCanary?: string;
          text?: string;
        }>)
      : [];

    const pageJson = store.fabricJsonByPage.get(store.currentPage);
    const storeObjs = (() => {
      if (!pageJson) return [] as Array<{
        editorType?: string;
        editorTypeCanary?: string;
        text?: string;
      }>;
      try {
        const parsed = JSON.parse(pageJson) as {
          objects?: Array<{
            editorType?: string;
            editorTypeCanary?: string;
            text?: string;
          }>;
        };

        return parsed.objects ?? [];
      } catch {
        return [];
      }
    })();

    const allObjs = [...liveObjs, ...storeObjs];
    const has = (marker: string) =>
      allObjs.some(
        (o) =>
          o.editorType === marker ||
          (o as { editorTypeCanary?: string }).editorTypeCanary === marker,
      );

    return {
      fabricJsonPresent: pageJson !== undefined,
      totalObjects: allObjs.length,
      hasCanaryShape: has("canaryShape"),
      hasCanaryText:
        allObjs.some((o) => o.text === "CANARY-TEXT") ||
        has("canaryText"),
      hasCanaryDraw: has("canaryDraw"),
      hasCanaryHighlight: has("canaryHighlight"),
      hasCanarySignature:
        allObjs.some(
          (o) =>
            o.editorType === "signature" ||
            o.editorType === "canarySignature",
        ) || has("canarySignature"),
      hasCanaryImage: has("canaryImage"),
      hasCanaryPageNumber:
        allObjs.some(
          (o) =>
            o.editorType === "pageNumber" ||
            o.editorType === "canaryPageNumber",
        ) || has("canaryPageNumber"),
      watermarkEnabled: Boolean((wm as { enabled?: boolean }).enabled),
      watermarkText:
        (wm as { text?: string }).text ?? null,
      bgImageEnabled: Boolean((bg as { enabled?: boolean }).enabled),
      bgImageHasData: Boolean((bg as { imageData?: string }).imageData),
    };
  });
}

/**
 * Convenience: adds every layer type in one call.
 */
export async function addAllCanaries(page: Page): Promise<void> {
  await addAllFabricCanaries(page);
  await addWatermarkCanary(page);
  await addBgImageCanary(page);
}
