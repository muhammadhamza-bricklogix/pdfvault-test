import type { Canvas as FabricCanvas } from "fabric";

import { usePdfEditorStore } from "@/lib/client/stores";

import { mergeFabricEditsIntoPdf } from "./merge-pdf";

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

type BuildEditedPdfInput = {
  currentPage: number;
  fabricCanvas: FabricCanvas | null;
  file: File;
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
}: BuildEditedPdfInput): Promise<Uint8Array> {
  if (fabricCanvas) {
    usePdfEditorStore
      .getState()
      .saveFabricJson(currentPage, serializeFabricCanvas(fabricCanvas));
  }

  const {
    fabricJsonByPage,
    fontDataByLoadedName,
    pdfDocument,
    watermarkConfig,
  } = usePdfEditorStore.getState();

  if (!pdfDocument) {
    throw new Error("PDF document not loaded");
  }

  const sourceBytes = await file.arrayBuffer();

  return mergeFabricEditsIntoPdf({
    fabricJsonByPage,
    fontDataMap: fontDataByLoadedName,
    pdfDocument,
    sourceBytes,
    watermarkConfig: watermarkConfig.enabled ? watermarkConfig : null,
  });
}
