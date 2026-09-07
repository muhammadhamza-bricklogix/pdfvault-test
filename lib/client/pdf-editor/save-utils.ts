import type { Canvas as FabricCanvas } from "fabric";

import { usePdfEditorStore } from "@/lib/client/stores";
import { logger } from "@/lib/shared/utils/logger";

import {
  isIdentityOrder,
  materializeSidebarReorder,
  stripPageNumberOverlays,
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
  const canvasW = Math.max(1, Math.round(parsed.width));
  const canvasH = Math.max(1, Math.round(parsed.height));

  el.width = canvasW;
  el.height = canvasH;
  el.style.position = "fixed";
  el.style.left = "-9999px";
  el.style.top = "-9999px";
  document.body.appendChild(el);

  const fc = new Canvas(el, {
    backgroundColor: "transparent",
    enableRetinaScaling: false,
    height: canvasH,
    width: canvasW,
  });

  try {
    // Wait for webfonts to be ready BEFORE loadFromJSON — text objects
    // measure themselves against the resolved font, and a not-yet-loaded
    // font produces zero-width glyphs / mis-positioned bboxes that
    // render as blank in the PNG.
    if (typeof document !== "undefined" && document.fonts?.ready) {
      await document.fonts.ready;
    }

    await fc.loadFromJSON(parsed);

    // QA 2026-09-07: Fabric v7 `loadFromJSON` resolves before object
    // caches are populated for freehand `path` objects (PencilBrush
    // strokes from highlight + draw tools). The subsequent `renderAll`
    // paints them into their EMPTY object caches instead of the main
    // canvas → PNG is transparent → downloaded PDF is missing the
    // highlight/draw layers even though `bytesDelta` grew from the
    // PNG being embedded. Fixes:
    //   1. Disable object caching so every render goes straight to the
    //      main canvas (no cache indirection).
    //   2. Mark every object `dirty` so Fabric re-computes bboxes +
    //      re-runs render for each one on the next paint pass.
    //   3. Call `setCoords()` so hit-test / bbox helpers use the
    //      just-loaded coordinates rather than defaults from the JSON
    //      constructor path.
    for (const obj of fc.getObjects()) {
      try {
        (obj as { objectCaching?: boolean }).objectCaching = false;
        (obj as { dirty?: boolean }).dirty = true;
        if (
          typeof (obj as { setCoords?: () => void }).setCoords === "function"
        ) {
          (obj as { setCoords: () => void }).setCoords();
        }
      } catch {
        // Best-effort — don't let one malformed object block the render.
      }
    }

    // Yield to the browser once so any queued microtask / image load
    // finishes before we snapshot the pixels. Cheap belt-and-braces
    // against Fabric's async internals settling AFTER renderAll.
    await new Promise<void>((resolve) => {
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => resolve());
      } else {
        setTimeout(resolve, 0);
      }
    });

    fc.renderAll();

    const dataUrl = fc.toDataURL({ format: "png", multiplier: 3 });

    // Diagnostic — sample the canvas pixel buffer to check whether the render
    // actually painted visible content. `likelyBlank` from data-URL size alone
    // is a poor signal because a 612×792×3-multiplier alpha PNG has ~100 KB
    // of PNG-header + zlib-baseline overhead even when fully transparent.
    // Read the actual alpha channel: if EVERY pixel has alpha === 0, the
    // canvas is truly blank and the raster we embed into the PDF will be
    // invisible. This is the exact "bytes grow but nothing is visible in
    // downloaded PDF" failure mode we've been chasing since 2026-09-07.
    let nonTransparentPixels = 0;
    let sampledPixels = 0;
    let alphaSampleFailed = false;

    try {
      const ctx = /** @type any */ el.getContext("2d");

      if (ctx) {
        // Sample every 8th row/column so we don't pull megabytes of image
        // data — this is a diagnostic, not a full scan. 8× subsampling on
        // a 612×792 canvas = ~7.5k pixel samples, plenty to detect content.
        const sample = ctx.getImageData(0, 0, canvasW, canvasH);
        const data = sample.data;

        for (let y = 0; y < canvasH; y += 8) {
          for (let x = 0; x < canvasW; x += 8) {
            const idx = (y * canvasW + x) * 4;
            const alpha = data[idx + 3];

            sampledPixels++;
            if (alpha > 0) nonTransparentPixels++;
          }
        }
      } else {
        alphaSampleFailed = true;
      }
    } catch (err) {
      alphaSampleFailed = true;
      logger.warn("[PDFedits] EXPORT-DIAG: alpha sample threw", { err });
    }

    logger.info("[PDFedits] EXPORT-DIAG: renderFabricJsonToPng", {
      canvasW,
      canvasH,
      objectCount: fc.getObjects().length,
      dataUrlChars: dataUrl.length,
      likelyBlank: dataUrl.length < 2000,
      nonTransparentPixels,
      sampledPixels,
      pixelFillRatio:
        sampledPixels > 0
          ? Math.round((nonTransparentPixels / sampledPixels) * 10000) / 100
          : null,
      alphaSampleFailed,
      trulyBlank: !alphaSampleFailed && nonTransparentPixels === 0,
    });

    return dataUrl;
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
 *
 * When `liveCanvas` is provided AND its object count matches the parsed JSON,
 * we render the subset from the LIVE canvas by temporarily hiding the
 * non-target objects and calling `toDataURL`. This bypasses the Fabric v7
 * `loadFromJSON` → fresh-canvas rendering bug that produces a nearly-blank
 * PNG for freehand `path` objects (draw + highlight tools) — the objectCaching
 * workaround alone was insufficient. The live canvas has already painted the
 * strokes correctly (that's what the user sees on screen), so `toDataURL`
 * captures the same pixels. See QA 2026-09-07 log: pixelFillRatio: 0.39 on
 * offscreen render vs. clearly-visible strokes on live canvas.
 */
export async function renderFabricSubsetToPng(
  parsed: ParsedFabricJson,
  objectIndices: number[],
  liveCanvas?: FabricCanvas | null,
): Promise<string | null> {
  if (!objectIndices.length || !parsed.objects?.length) return null;

  const filteredObjects = objectIndices
    .map((i) => parsed.objects![i])
    .filter(Boolean);

  if (!filteredObjects.length) return null;

  if (liveCanvas) {
    const liveResult = renderSubsetFromLiveCanvas(
      liveCanvas,
      objectIndices,
      parsed,
    );

    if (liveResult) return liveResult;
    // fall through to offscreen render if live-canvas path bailed
  }

  const subset: ParsedFabricJson = {
    ...parsed,
    objects: filteredObjects,
  };

  return renderFabricJsonToPng(subset);
}

/**
 * Renders a subset of the LIVE fabric canvas by hiding non-target objects,
 * calling toDataURL, and restoring visibility. Only usable when the live
 * canvas is 1:1 aligned with the parsed JSON (same object order + count).
 * Returns null if alignment can't be verified; caller falls back to the
 * offscreen JSON-based render.
 */
function renderSubsetFromLiveCanvas(
  liveCanvas: FabricCanvas,
  objectIndices: number[],
  parsed: ParsedFabricJson,
): string | null {
  try {
    const liveObjects = liveCanvas.getObjects();
    const parsedObjects = parsed.objects ?? [];

    if (liveObjects.length !== parsedObjects.length) {
      logger.warn(
        "[PDFedits] EXPORT-DIAG: live/parsed object count mismatch; falling back to offscreen render",
        {
          liveCount: liveObjects.length,
          parsedCount: parsedObjects.length,
        },
      );

      return null;
    }

    const targetSet = new Set(objectIndices);
    const originalVisibility = liveObjects.map(
      (o) => (o as { visible?: boolean }).visible ?? true,
    );
    const originalZoom = liveCanvas.getZoom();
    const originalViewport = liveCanvas.viewportTransform
      ? [...liveCanvas.viewportTransform]
      : null;

    // Hide non-target objects
    for (let i = 0; i < liveObjects.length; i++) {
      (liveObjects[i] as { visible: boolean }).visible = targetSet.has(i);
    }

    // Reset zoom + viewport to identity so the exported PNG is at base
    // coords (matches how the offscreen render sizes the canvas).
    if (originalZoom !== 1) liveCanvas.setZoom(1);
    if (originalViewport) {
      liveCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    }

    liveCanvas.renderAll();

    const canvasW = Math.max(1, Math.round(parsed.width));
    const canvasH = Math.max(1, Math.round(parsed.height));
    const dataUrl = liveCanvas.toDataURL({
      format: "png",
      multiplier: 3,
      width: canvasW,
      height: canvasH,
      left: 0,
      top: 0,
    });

    // Restore visibility + viewport + zoom
    for (let i = 0; i < liveObjects.length; i++) {
      (liveObjects[i] as { visible: boolean }).visible = originalVisibility[i]!;
    }
    if (originalViewport) {
      liveCanvas.setViewportTransform(
        originalViewport as [number, number, number, number, number, number],
      );
    }
    if (originalZoom !== 1) liveCanvas.setZoom(originalZoom);
    liveCanvas.renderAll();

    logger.info("[PDFedits] EXPORT-DIAG: rendered subset from LIVE canvas", {
      canvasW,
      canvasH,
      subsetCount: objectIndices.length,
      totalObjects: liveObjects.length,
      dataUrlChars: dataUrl.length,
    });

    return dataUrl;
  } catch (err) {
    logger.warn(
      "[PDFedits] EXPORT-DIAG: live-canvas subset render threw; falling back",
      { err },
    );

    return null;
  }
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

  logger.debug("[PDFedits] flush: live canvas →", {
    displayPage,
    objectCount: liveObjects.length,
    types: summary,
  });

  // Guard against wiping stored edits when the live canvas is empty because
  // it's mid-remount (fresh Canvas created, async `loadFromJSON` hasn't
  // resolved yet). This race fires in the Save-before-Export flow:
  // `applyPostSaveReset` swaps the file → pdf.js reloads → Fabric re-mounts
  // → `editor:export` dispatches immediately after → flush serializes an
  // empty canvas and clobbers `fabricJsonByPage[source]` with `{objects:[]}`
  // → merge draws nothing on the page and every edit disappears from the
  // export. Tools now persist their own edits synchronously (see
  // `use-eraser-tool.ts`, `use-image-tool.ts`, `use-shape-tool.ts`,
  // `use-annotations-editor.ts`, `SignatureModal.tsx`, `use-draw-tool.ts`,
  // `use-highlight-tool.ts`), so the stored map is the source of truth
  // whenever the live canvas is unexpectedly empty.
  const store = usePdfEditorStore.getState();

  if (liveObjects.length === 0) {
    const source = store.getSourcePageIndex(displayPage);
    const existing = store.fabricJsonByPage.get(source);

    if (existing) {
      let existingObjectCount = 0;

      try {
        const parsed = JSON.parse(existing) as { objects?: unknown[] };

        existingObjectCount = parsed.objects?.length ?? 0;
      } catch {
        existingObjectCount = 0;
      }

      if (existingObjectCount > 0) {
        logger.warn(
          "[PDFedits] flush: skipping empty-canvas overwrite of non-empty store entry",
          {
            displayPage,
            sourcePage: source,
            existingObjectCount,
          },
        );

        return;
      }
    }
  }

  store.saveFabricJson(displayPage, serializeFabricCanvas(fabricCanvas));
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
  // EXPORT-DIAG: what did buildEditedPdfBytes actually receive from the caller?
  logger.info("[PDFedits] EXPORT-DIAG: buildEditedPdfBytes entry", {
    currentPage,
    bakeOverlays,
    fileName: file?.name ?? null,
    fabricCanvasPresent: !!fabricCanvas,
    fabricCanvasObjectCount: fabricCanvas
      ? fabricCanvas.getObjects().length
      : null,
  });

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

  // EXPORT-DIAG: post-flush snapshot — did the flush actually land in the store?
  try {
    const postFlushSummary: Record<number, { count: number; types: string[] }> =
      {};

    fabricJsonByPage.forEach((json, pageNum) => {
      try {
        const parsed = JSON.parse(json) as {
          objects?: { type?: string; editorType?: string }[];
        };
        const objs = parsed.objects ?? [];

        postFlushSummary[pageNum] = {
          count: objs.length,
          types: objs.map(
            (o) => `${o.type ?? "?"}${o.editorType ? `:${o.editorType}` : ""}`,
          ),
        };
      } catch {
        postFlushSummary[pageNum] = { count: -1, types: [] };
      }
    });
    logger.info("[PDFedits] EXPORT-DIAG: post-flush fabricJsonByPage", {
      pages: Array.from(fabricJsonByPage.keys()),
      pageOrderLength: pageOrder.length,
      summary: postFlushSummary,
    });
  } catch (diagErr) {
    logger.warn("[PDFedits] EXPORT-DIAG: post-flush log failed", diagErr);
  }

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

  const bytes = await mergeFabricEditsIntoPdf({
    backgroundImageConfig: bgShouldBake ? backgroundImageConfig : null,
    fabricJsonByPage: mergeJsonForBake,
    fontDataMap: fontDataByLoadedName,
    // QA 2026-09-07: pass the live fabric canvas + its current page so the
    // merge can raster the current page's freehand path objects directly
    // from the live canvas (already correctly painted) instead of the
    // Fabric v7 offscreen `loadFromJSON` path (which produces a nearly-
    // blank PNG — pixelFillRatio 0.39%). Only applies to the page the
    // live canvas currently shows; other pages fall back to offscreen.
    liveFabricCanvas: fabricCanvas,
    liveCanvasPage: currentPage,
    pageOrder: mergePageOrder,
    pdfDocument,
    sourceBytes: mergeSourceBytes,
    watermarkConfig: wmShouldBake ? watermarkConfig : null,
  });

  // BAKE-INVARIANT CHECK: if the store thinks there are Fabric edits for any
  // page but the merged bytes are byte-identical to the source, the bake
  // silently dropped every overlay — the exported/uploaded PDF will be the
  // untouched original. This is the exact "I am still getting the un-edited
  // pdf" symptom the user has been reporting. Loud WARN so the failure is
  // impossible to miss in the console, with enough detail to identify which
  // page(s) had edits that vanished.
  try {
    const sourceLen = mergeSourceBytes.byteLength;
    const bytesLen = bytes.byteLength;
    const nonEmptyEditPages: number[] = [];

    mergeJsonForBake.forEach((json, pageNum) => {
      try {
        const parsed = JSON.parse(json) as { objects?: unknown[] };

        if ((parsed.objects?.length ?? 0) > 0) nonEmptyEditPages.push(pageNum);
      } catch {
        /* ignore parse errors — separate diag surfaces them */
      }
    });

    if (bytesLen === sourceLen && nonEmptyEditPages.length > 0) {
      logger.warn(
        "[PDFedits] BAKE-INVARIANT VIOLATED: merged bytes identical to source despite non-empty fabric edits",
        {
          sourceLen,
          bytesLen,
          nonEmptyEditPages,
          totalFabricPages: mergeJsonForBake.size,
          bakeOverlays,
          hadRemap: !!remappedState,
        },
      );
    } else {
      logger.info("[PDFedits] EXPORT-DIAG: bake-invariant ok", {
        sourceLen,
        bytesLen,
        bytesDelta: bytesLen - sourceLen,
        bytesIdenticalToSource: bytesLen === sourceLen,
        nonEmptyEditPages,
      });
    }
  } catch (diagErr) {
    logger.warn("[PDFedits] EXPORT-DIAG: bake-invariant check failed", diagErr);
  }

  return { bytes, remappedState };
}
