import type { Canvas as FabricCanvas } from "fabric";

import { usePdfEditorStore } from "@/lib/client/stores";

import { mergeFabricEditsIntoPdf } from "./merge-pdf";
import { sanitizeSourceBytesForPdfLib } from "./sanitize-source-bytes";

export type ParsedFabricJson = {
  height: number;
  objects?: unknown[];
  width: number;
  [key: string]: unknown;
};

/**
 * Serializes a Fabric canvas to a JSON string and embeds the base (zoom=1)
 * canvas dimensions. Object coordinates are always in base space (Fabric zoom
 * handles the visual scaling), so we divide by the current zoom to get the
 * logical dimensions that match the object coordinate space.
 */
export function serializeFabricCanvas(canvas: FabricCanvas): string {
  const zoom = canvas.getZoom() || 1;
  const baseWidth = canvas.getWidth() / zoom;
  const baseHeight = canvas.getHeight() / zoom;

  // Fabric v6's `toJSON()` preserves own-properties set at object
  // construction (including our `editorType`, `pristine`,
  // `pdfTextWidth`). It's null-arg in v6 — passing a propertiesToInclude
  // list throws TS2554. If a custom prop ever stops surviving the
  // round-trip, register it via `FabricObject.customProperties` instead.
  const json = canvas.toJSON() as Record<string, unknown>;

  // Strip ephemeral watermark preview objects — they are visual-only and must
  // never leak into persisted page state, history snapshots, or the export pipeline.
  if (Array.isArray(json.objects)) {
    json.objects = (json.objects as Record<string, unknown>[]).filter(
      (obj) => obj.editorType !== "watermarkPreview",
    );
  }

  return JSON.stringify({
    ...json,
    height: baseHeight,
    width: baseWidth,
  });
}

export function parseFabricJson(json: string): ParsedFabricJson | null {
  const parsed = JSON.parse(json) as ParsedFabricJson;

  if (!parsed.objects?.length) return null;
  if (!parsed.width || !parsed.height) return null;

  return parsed;
}

/**
 * Renders a Fabric JSON snapshot to a PNG data URL via a temporary offscreen
 * canvas. The width/height in the JSON match the live editor canvas at the
 * time the snapshot was taken, so object coordinates are valid as-is.
 */
export async function renderFabricJsonToPng(
  parsed: ParsedFabricJson,
): Promise<string> {
  const { Canvas } = await import("fabric");

  const el = document.createElement("canvas");

  el.width = Math.round(parsed.width);
  el.height = Math.round(parsed.height);
  el.style.position = "fixed";
  el.style.left = "-9999px";
  el.style.top = "-9999px";
  document.body.appendChild(el);

  const fc = new Canvas(el, {
    backgroundColor: "transparent",
    enableRetinaScaling: false,
    height: el.height,
    width: el.width,
  });

  try {
    await fc.loadFromJSON(parsed);
    fc.renderAll();

    return fc.toDataURL({ format: "png", multiplier: 3 });
  } finally {
    fc.dispose();

    if (document.body.contains(el)) {
      document.body.removeChild(el);
    }
  }
}

/**
 * Renders only the objects at the given indices from a Fabric JSON snapshot
 * to a PNG data URL. Used by the hybrid merge pipeline to rasterize the
 * subset of objects that cannot be drawn as vectors (e.g. images).
 * Returns `null` if no objects pass the filter.
 */
export async function renderFabricSubsetToPng(
  parsed: ParsedFabricJson,
  objectIndices: number[],
): Promise<string | null> {
  if (!objectIndices.length || !parsed.objects?.length) return null;

  const filteredObjects = objectIndices
    .map((i) => parsed.objects![i])
    .filter(Boolean);

  if (!filteredObjects.length) return null;

  const subset: ParsedFabricJson = {
    ...parsed,
    objects: filteredObjects,
  };

  return renderFabricJsonToPng(subset);
}

/** Decodes a `data:image/png;base64,...` URL into raw PNG bytes. */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1];

  if (!base64) {
    throw new Error("Invalid data URL: missing base64 payload");
  }

  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);

  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  return bytes;
}

/** Persists the live Fabric canvas into the store for a display slot. */
export function flushLiveFabricPage(
  displayPage: number,
  fabricCanvas: FabricCanvas,
) {
  // Diagnostic: log what's actually on the live canvas at flush time.
  // Helps debug "edits weren't saved" reports — if `objects` is empty
  // here the canvas had nothing to flush in the first place; if
  // populated, look at the merge logs to see why they weren't baked.
  const liveObjects = fabricCanvas.getObjects();
  const summary = liveObjects.map((o) => ({
    type: (o as { type?: string }).type,
    editorType: (o as { editorType?: string }).editorType,
    pristine: (o as { pristine?: boolean }).pristine,
  }));

  /* eslint-disable-next-line no-console */
  console.info("[PDFedits] flush: live canvas →", {
    displayPage,
    objectCount: liveObjects.length,
    types: summary,
  });

  usePdfEditorStore
    .getState()
    .saveFabricJson(displayPage, serializeFabricCanvas(fabricCanvas));
}

type BuildEditedPdfInput = {
  currentPage: number;
  fabricCanvas: FabricCanvas | null;
  file: File;
  /**
   * Bake the watermark + background image overlays into the output bytes.
   *
   * - `false` (default, used by `persistEditorDocument` / cloud Save): keep
   *   the cloud-saved PDF clean. Overlays live in `editorState` JSON only
   *   and are re-applied as live previews each session. No stacking, no
   *   per-save degradation, no PDF text drift.
   * - `true` (used by `useExportEditor` / download): apply the overlays so
   *   the downloaded copy carries them. The cloud original is untouched.
   */
  bakeOverlays?: boolean;
};

/**
 * Flushes the active page's live canvas into the store, then merges every
 * page's Fabric overlay into the source PDF and returns the saved bytes.
 * Shared by the save (upload) and export (download) pipelines.
 */
export async function buildEditedPdfBytes({
  currentPage,
  fabricCanvas,
  file,
  bakeOverlays = false,
}: BuildEditedPdfInput): Promise<Uint8Array> {
  if (fabricCanvas) {
    flushLiveFabricPage(currentPage, fabricCanvas);
  }

  const {
    backgroundImageConfig,
    fabricJsonByPage,
    fontDataByLoadedName,
    pageOrder,
    pdfDocument,
    watermarkConfig,
  } = usePdfEditorStore.getState();

  if (!pdfDocument) {
    throw new Error("PDF document not loaded");
  }

  const rawSourceBytes = await file.arrayBuffer();
  const sourceBytes = await sanitizeSourceBytesForPdfLib(
    rawSourceBytes,
    pdfDocument,
  );

  // Bake-overlays gate: when false (Save path) the cloud PDF stays clean —
  // overlays are an editor-side render concern only, persisted as JSON in
  // `editorState`. The downloaded Export path opts in to bake them into the
  // output bytes so the user's downloaded file actually carries the watermark.
  const wmShouldBake =
    bakeOverlays && watermarkConfig.enabled && watermarkConfig.text;
  const bgShouldBake =
    bakeOverlays &&
    backgroundImageConfig.enabled &&
    !!backgroundImageConfig.imageData;

  return mergeFabricEditsIntoPdf({
    backgroundImageConfig: bgShouldBake ? backgroundImageConfig : null,
    fabricJsonByPage,
    fontDataMap: fontDataByLoadedName,
    pageOrder,
    pdfDocument,
    sourceBytes,
    watermarkConfig: wmShouldBake ? watermarkConfig : null,
  });
}
