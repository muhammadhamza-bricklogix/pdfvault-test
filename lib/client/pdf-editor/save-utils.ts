import type { Canvas as FabricCanvas } from "fabric";
import type { BackgroundImageConfig } from "@/lib/client/stores/pdf-editor-store";

import { usePdfEditorStore } from "@/lib/client/stores";
import { logger } from "@/lib/shared/utils/logger";

import {
  isIdentityOrder,
  materializeSidebarReorder,
  stripPageNumberOverlays,
} from "./materialize-page-order";
import { parseFabricJson } from "./fabric-render";
import { mergeFabricEditsIntoPdf } from "./merge-pdf";
import { sanitizeSourceBytesForPdfLib } from "./sanitize-source-bytes";

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

    logger.debug("[PDFedits] serialize: editModeText breakdown", {
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

// Object types the worker can draw without a DOM canvas. Anything else
// (images, annotations, unknown types) falls back to raster and must stay
// on the main thread where `document.createElement('canvas')` is available.
const WORKER_SAFE_TYPES = new Set([
  "ellipse",
  "group",
  "i-text",
  "itext",
  "line",
  "path",
  "rect",
  "text",
  "textbox",
  "triangle",
]);

function objectNeedsMainThread(obj: Record<string, unknown>): boolean {
  const type = String(obj.type ?? "").toLowerCase();
  const editorType = (obj as { editorType?: string }).editorType;

  if (editorType === "annotation" || type === "image") return true;

  return !WORKER_SAFE_TYPES.has(type);
}

/**
 * Determines whether the merge can safely run inside a Web Worker.
 *
 * Background-image baking requires the live pdf.js document proxy, which the
 * worker does not have. Images, annotations, and any unknown Fabric object
 * type are rasterized via a DOM canvas, so they also keep the merge on the
 * main thread.
 */
function canMergeInWorker(
  backgroundImageConfig: BackgroundImageConfig | null,
  fabricJsonByPage: Map<number, string>,
): boolean {
  if (backgroundImageConfig?.enabled && backgroundImageConfig?.imageData) {
    return false;
  }

  for (const json of fabricJsonByPage.values()) {
    const parsed = parseFabricJson(json);

    if (!parsed) continue;

    const objects = (parsed.objects ?? []) as Record<string, unknown>[];

    if (objects.some(objectNeedsMainThread)) return false;
  }

  return true;
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

  logger.debug("[PDFedits] flush: live canvas →", {
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
  /**
   * Raster scale for rendered page backgrounds. Capped to the configured
   * maximum to prevent runaway memory use on high-resolution exports.
   */
  rasterScale?: number;
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
  rasterScale,
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

    // Single-shot save: the rebuilt bytes carry the reorder AND the merge
    // below bakes overlays into the same output, so one upload covers
    // everything. The remapped (display-slot-keyed) Fabric map flows through
    // both the merge here AND the post-save commit, so the editor's overlay
    // state matches the cloud file on reload.
    mergeSourceBytes = materialized.sourceBytes.buffer as ArrayBuffer;
    mergeFabricJsonByPage = materialized.fabricJsonByPage;
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

  // Save path (`bakeOverlays === false`): keep `pageNumber` overlays OUT of
  // the merge input so they're NOT drawn into the PDF content stream. They
  // continue to live in `fabricJsonByPage` (cloud `editorState` payload) and
  // the editor renders them as Fabric IText on reload, regardless of whether
  // `suppressText` is on for the page. The download/Export path leaves them
  // in so the user's downloaded PDF carries the labels. See skill log
  // 2026-06-19 (d) for why the bake-then-strip pattern broke for users who
  // had also extracted text on the same pages.
  const mergeJsonForBake = bakeOverlays
    ? mergeFabricJsonByPage
    : stripPageNumberOverlays(mergeFabricJsonByPage);

  // After materialize, source bytes already carry the reorder, so the merge
  // walks pages 1..N as identity. Pass an identity pageOrder of the same
  // length so the merge sees a consistent (currently unused) parameter.
  const mergePageOrder = remappedState
    ? Array.from({ length: pageOrder.length }, (_, i) => i + 1)
    : pageOrder;

  // Background-image baking needs the live pdf.js document to render source
  // pages, so it must stay on the main thread. The common Save/Export path
  // (watermark, text edits, shapes) can run in a worker to keep the UI
  // responsive on large documents.
  const mergeInput = {
    backgroundImageConfig: bgShouldBake ? backgroundImageConfig : null,
    fabricJsonByPage: mergeJsonForBake,
    fontDataMap: fontDataByLoadedName,
    pageOrder: mergePageOrder,
    rasterScale,
    sourceBytes: mergeSourceBytes,
    watermarkConfig: wmShouldBake ? watermarkConfig : null,
  };

  // Offload the CPU-heavy pdf-lib merge to a worker whenever it does not
  // need the live pdf.js document or a DOM canvas. On failure we fall back
  // to the main thread so the save/export still completes.
  let bytes: Uint8Array;

  if (
    canMergeInWorker(mergeInput.backgroundImageConfig, mergeFabricJsonByPage)
  ) {
    try {
      const { mergeInWorker } = await import("./workers/pdf-merge.worker.api");

      bytes = await mergeInWorker(mergeInput);
    } catch (err) {
      logger.warn(
        "[PDFedits] Worker merge failed, falling back to main thread",
        err,
      );
      bytes = await mergeFabricEditsIntoPdf({ ...mergeInput, pdfDocument });
    }
  } else {
    bytes = await mergeFabricEditsIntoPdf({ ...mergeInput, pdfDocument });
  }

  return { bytes, remappedState };
}
