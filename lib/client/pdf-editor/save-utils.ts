import type { Canvas as FabricCanvas } from "fabric";

import { usePdfEditorStore } from "@/lib/client/stores";

import {
  isIdentityOrder,
  materializeSidebarReorder,
} from "./materialize-page-order";
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

  // Fabric v6's `toJSON()` only serializes class-registered properties.
  // The `installFabricCustomizations()` toObject patch should extend that,
  // but we also explicitly copy custom props from each live object below
  // as a belt-and-braces measure. The merge pipeline's `pristine` check
  // is the sole signal that decides whether the source word is whited
  // out + redrawn vs. left untouched on Save — dropping it on the
  // round-trip produces the "every word on the edited line shows
  // duplicated" symptom (QA report 2026-06-17).
  const json = canvas.toJSON() as Record<string, unknown>;

  // Strip ephemeral watermark preview objects — they are visual-only and must
  // never leak into persisted page state, history snapshots, or the export pipeline.
  if (Array.isArray(json.objects)) {
    json.objects = (json.objects as Record<string, unknown>[]).filter(
      (obj) => obj.editorType !== "watermarkPreview",
    );
  }

  // Explicit copy of custom props from live Fabric objects → JSON.
  // Pairs each serialized object with its live Fabric counterpart and
  // overlays the live values for our custom keys. Order is preserved
  // because Fabric's toJSON emits objects in `getObjects()` order, and
  // we filtered the same way. If anything ever desyncs the order we
  // fall back to the toJSON value (so this can never silently corrupt).
  const liveObjects = canvas.getObjects().filter((o) => {
    return (o as { editorType?: string }).editorType !== "watermarkPreview";
  });

  if (
    Array.isArray(json.objects) &&
    json.objects.length === liveObjects.length
  ) {
    const objs = json.objects as Record<string, unknown>[];

    for (let i = 0; i < objs.length; i++) {
      const live = liveObjects[i] as unknown as Record<string, unknown>;

      for (const k of [
        "editorType",
        "pristine",
        "originalText",
        "originalLeft",
        "originalTop",
        "originalWidth",
        "originalHeight",
        "pdfTextWidth",
      ]) {
        if (live[k] !== undefined) objs[i][k] = live[k];
      }
    }

    // DEBUG: serialized editModeText summary — used to confirm `pristine`
    // and `originalText` survive the toJSON round-trip into the JSON that
    // the merge pipeline reads.
    const eds = objs.filter((o) => o.editorType === "editModeText");
    const modifiedCount = eds.filter((o) => o.pristine !== true).length;

    /* eslint-disable-next-line no-console */
    console.info("[PDFedits] serialize: editModeText breakdown", {
      total: eds.length,
      modified: modifiedCount,
      pristine: eds.length - modifiedCount,
      samples: eds.slice(0, 5).map((o) => ({
        text: typeof o.text === "string" ? o.text.slice(0, 24) : null,
        textLen: typeof o.text === "string" ? o.text.length : null,
        originalText:
          typeof o.originalText === "string"
            ? o.originalText.slice(0, 24)
            : null,
        textMatches: o.text === o.originalText,
        pristine: o.pristine,
        left: o.left,
        originalLeft: o.originalLeft,
      })),
    });
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
 * Page-order-aware state returned to the caller when the sidebar reorder was
 * materialized into the source bytes. `merge-pdf.ts` is off-limits and does
 * NOT consume `pageOrder`, so when the user has drag-dropped pages in the
 * sidebar we rebuild source bytes in the new order BEFORE the merge (using
 * the proven Manage Pages rebuild path). That rebuild rekeys all the
 * source-page-indexed editor state — Fabric JSON, history, extracted pages —
 * which the caller must commit via `applyPostSaveReset` once the cloud
 * upload succeeds. Shape mirrors the Map/Set types in the store.
 */
export type BuildEditedPdfRemappedState = {
  extractedPages: Set<number>;
  fabricJsonByPage: Map<number, string>;
  historyByPage: Map<number, string[]>;
  historyIndexByPage: Map<number, number>;
};

export type BuildEditedPdfResult = {
  bytes: Uint8Array;
  /** Present iff sidebar reorder was materialized this save. */
  remappedState?: BuildEditedPdfRemappedState;
};

/**
 * Flushes the active page's live canvas into the store, then merges every
 * page's Fabric overlay into the source PDF and returns the saved bytes.
 * Shared by the save (upload) and export (download) pipelines.
 *
 * When `pageOrder` is non-identity (the user drag-dropped thumbnails in the
 * sidebar), the source bytes are rebuilt in the new order first and the
 * source-keyed editor state is remapped to the new display slots; the
 * remapped state is returned alongside the merged bytes so the caller can
 * commit it post-upload.
 */
export async function buildEditedPdfBytes({
  currentPage,
  fabricCanvas,
  file,
  bakeOverlays = false,
}: BuildEditedPdfInput): Promise<BuildEditedPdfResult> {
  if (fabricCanvas) {
    flushLiveFabricPage(currentPage, fabricCanvas);
  }

  const {
    backgroundImageConfig,
    extractedPages,
    fabricJsonByPage,
    fontDataByLoadedName,
    historyByPage,
    historyIndexByPage,
    pageOrder,
    pdfDocument,
    watermarkConfig,
  } = usePdfEditorStore.getState();

  if (!pdfDocument) {
    throw new Error("PDF document not loaded");
  }

  const rawSourceBytes = await file.arrayBuffer();
  const sanitizedSourceBytes = await sanitizeSourceBytesForPdfLib(
    rawSourceBytes,
    pdfDocument,
  );

  let mergeSourceBytes: ArrayBuffer = sanitizedSourceBytes;
  let mergeFabricJsonByPage: Map<number, string> = fabricJsonByPage;
  let remappedState: BuildEditedPdfRemappedState | undefined;

  if (pageOrder.length > 0 && !isIdentityOrder(pageOrder)) {
    const materialized = await materializeSidebarReorder({
      extractedPages,
      fabricJsonByPage,
      historyByPage,
      historyIndexByPage,
      pageOrder,
      pdfDocument,
      sourceBytes: sanitizedSourceBytes,
    });

    // First-stage upload: bake ONLY the reorder into the bytes. Overlays
    // (Fabric edits, page-number labels, edited text) stay as JSON in the
    // remapped state. This mirrors the Manage Pages two-stage save model
    // — the caller flips `pendingCloudSaveAfterReload` after `applyPostSaveReset`,
    // and `useEditorAutoPersist` fires a second save on the reloaded
    // identity-order file which goes through the normal merge + sweep path
    // and bakes the overlays.
    //
    // Why not bake here directly: the in-place bake on materialized bytes
    // hides QA-reported edge cases (`pageNumber` labels disappearing when
    // edit-text suppression is also active on the page — pdf.js's native
    // text paint is off so the baked label is hidden behind the empty
    // Fabric overlay that the sweep just stripped). Routing through the
    // proven identity-bake path on the reload avoids the whole class of
    // bugs at the cost of one extra cloud upload per sidebar reorder.
    mergeSourceBytes = materialized.sourceBytes.buffer as ArrayBuffer;
    mergeFabricJsonByPage = new Map();
    remappedState = {
      extractedPages: materialized.extractedPages,
      fabricJsonByPage: materialized.fabricJsonByPage,
      historyByPage: materialized.historyByPage,
      historyIndexByPage: materialized.historyIndexByPage,
    };
  }

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

  // After materialize, source bytes already carry the reorder, so the merge
  // walks pages 1..N as identity. Pass an identity pageOrder of the same
  // length so the merge sees a consistent (currently unused) parameter.
  const mergePageOrder = remappedState
    ? Array.from({ length: pageOrder.length }, (_, i) => i + 1)
    : pageOrder;

  const bytes = await mergeFabricEditsIntoPdf({
    backgroundImageConfig: bgShouldBake ? backgroundImageConfig : null,
    fabricJsonByPage: mergeFabricJsonByPage,
    fontDataMap: fontDataByLoadedName,
    pageOrder: mergePageOrder,
    pdfDocument,
    sourceBytes: mergeSourceBytes,
    watermarkConfig: wmShouldBake ? watermarkConfig : null,
  });

  return { bytes, remappedState };
}
