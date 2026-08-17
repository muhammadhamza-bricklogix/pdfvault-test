import type { Canvas as FabricCanvas } from "fabric";
import type { Document } from "@/lib/shared/types/documents.types";
import type { BuildEditedPdfRemappedState } from "@/lib/client/pdf-editor/save-utils";

import { documentsService } from "@/lib/shared/api/services/documents.service";
import { buildEditedPdfBytes } from "@/lib/client/pdf-editor/save-utils";
import { usePdfEditorStore } from "@/lib/client/stores";
import { logger } from "@/lib/shared/utils/logger";

// Reject editor-state payloads larger than ~800 KB BEFORE we send. The backend
// rejects > 1 MiB outright; this is the headroom for HTTP overhead + the
// signed multipart envelope plus a safety margin. When over, we strip
// watermark/bg `imageData` (the only field that can realistically blow up)
// and re-serialize without it — the user still sees the watermark visually
// because the BAKED bytes carry the image; only the UI panel restoration
// loses the source data URL until the user re-uploads.
const EDITOR_STATE_SOFT_LIMIT_BYTES = 800 * 1024;

type PristineSweepResult = {
  map: Map<number, string>;
  mutated: boolean;
  mutatedCount: number;
  strippedPageNumbers: number;
};

/**
 * Walks a `fabricJsonByPage` Map and, for every editModeText whose
 * `pristine !== true`, snaps `originalText/originalLeft/originalTop/...` to
 * the current values and flips `pristine` to true. Also strips any
 * `pageNumber` overlays — those have been baked into the source bytes by
 * the merge and the surviving overlay would double-paint on reload.
 *
 * Pure: returns a new Map; does NOT mutate the input or the store. The
 * identity-pageOrder save path writes the result back to the store
 * directly; the materialized-reorder path threads the result through
 * `remappedState` so the commit lands atomically in `applyPostSaveReset`
 * post-upload, leaving the store untouched on upload failure.
 *
 * Why: the merge pipeline just baked the user's modifications into the
 * saved bytes via whiteout + drawText. The user's NEXT save (or a reload
 * that reuses the snapshot) must treat those entries as "no modification
 * pending" — otherwise the whiteout-and-redraw runs again, stacking on
 * top of the already-baked text in the saved file (and producing a visual
 * mess in the editor where pdf.js's text-extraction sees both layers).
 */
function applyPristineSweep(
  fabricJsonByPage: Map<number, string>,
): PristineSweepResult {
  const next = new Map<number, string>();
  let mutatedCount = 0;
  // Retained on the return shape so existing callers' log fields stay typed,
  // but always 0 now — `pageNumber` overlays are never baked (the strip lives
  // in `buildEditedPdfBytes` pre-merge instead, see skill 2026-06-19 (d)) so
  // there's nothing to strip post-merge.
  const strippedPageNumbers = 0;

  fabricJsonByPage.forEach((json, page) => {
    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(json) as Record<string, unknown>;
    } catch {
      next.set(page, json);

      return;
    }

    const objs = parsed.objects;

    if (!Array.isArray(objs)) {
      next.set(page, json);

      return;
    }

    let changed = false;
    const objsArr = objs as Record<string, unknown>[];

    for (const obj of objsArr) {
      if (obj.editorType !== "editModeText") continue;
      if (obj.pristine === true) continue;
      obj.originalText = obj.text;
      obj.originalLeft = obj.left;
      obj.originalTop = obj.top;

      if (obj.width !== undefined) obj.originalWidth = obj.width;
      if (obj.height !== undefined) obj.originalHeight = obj.height;
      obj.pristine = true;
      changed = true;
      mutatedCount++;
    }

    if (changed) {
      parsed.objects = objsArr;
      next.set(page, JSON.stringify(parsed));
    } else {
      next.set(page, json);
    }
  });

  const mutated = mutatedCount > 0;

  return { map: next, mutated, mutatedCount, strippedPageNumbers };
}

export type PersistEditorResult =
  | {
      document: Document;
      ok: true;
      /**
       * Sidebar-reorder-aware editor state that the caller commits via
       * `applyPostSaveReset` once the upload succeeds. Present iff the user
       * had drag-dropped pages since the last save; absent for identity
       * pageOrder saves.
       */
      remappedState?: BuildEditedPdfRemappedState;
      savedFile: File;
    }
  | {
      ok: false;
      reason:
        | "error"
        | "no-changes"
        | "no-file"
        | "not-signed-in"
        | "not-loaded";
    };

type PersistEditorDocumentInput = {
  fabricCanvas?: FabricCanvas | null;
  /**
   * Bypasses the `hasUnsavedChanges` short-circuit. Set to `true` for code
   * paths that produce a NEW source file even when the Fabric overlay is empty
   * — e.g. Manage Pages reorder/import/rotate, which rebuilds the PDF bytes
   * outside the dirty-flag system.
   */
  force?: boolean;
};

/**
 * Builds the current editor PDF (with Fabric overlays) and uploads it to the cloud.
 * Used by Save, Manage Pages auto-save, and save-before-navigate flows.
 */
export async function persistEditorDocument({
  fabricCanvas = null,
  force = false,
}: PersistEditorDocumentInput = {}): Promise<PersistEditorResult> {
  const state = usePdfEditorStore.getState();
  const {
    currentDocumentId,
    currentPage,
    file,
    hasUnsavedChanges,
    isSignedIn,
    pdfDocument,
  } = state;

  if (!file) {
    return { ok: false, reason: "no-file" };
  }

  if (!isSignedIn) {
    return { ok: false, reason: "not-signed-in" };
  }

  if (!pdfDocument) {
    return { ok: false, reason: "not-loaded" };
  }

  // Skip the upload if nothing has changed since the last save AND a cloud
  // document already exists. Without this, every Save/back-navigate/page-hide
  // re-uploads byte-identical PDF bytes — wasteful and creates duplicate
  // history entries on the server. The first save (no `currentDocumentId`
  // yet) always proceeds so a fresh PDF gets uploaded once.
  if (!force && !hasUnsavedChanges && currentDocumentId) {
    return { ok: false, reason: "no-changes" };
  }

  try {
    // Save path uses the default `bakeOverlays: false` — the cloud-saved PDF
    // contains user edits (text, shapes, highlights, etc.) but NOT the
    // watermark or background image. Those live in `editorState` as
    // overlay metadata and are re-applied at view-time and at Export.
    // Keeping them out of the saved bytes prevents per-save stacking and the
    // text-position drift caused by re-rasterizing the page on every save.
    const sourceSize = file.size;
    const fabricKeys = Array.from(
      usePdfEditorStore.getState().fabricJsonByPage.keys(),
    );

    logger.info("[PDFedits] save: pre-merge", {
      sourceFileBytes: sourceSize,
      fabricJsonPages: fabricKeys,
      currentPage,
      fabricCanvasPresent: !!fabricCanvas,
    });

    const { bytes: savedBytes, remappedState } = await buildEditedPdfBytes({
      currentPage,
      fabricCanvas,
      file,
    });

    logger.info("[PDFedits] save: post-merge", {
      sourceFileBytes: sourceSize,
      mergedBytes: savedBytes.byteLength,
      bytesIdenticalToSource: savedBytes.byteLength === sourceSize,
      remapped: !!remappedState,
    });

    // Mark every editModeText that the merge just baked as `pristine: true`,
    // and snap its `originalText` / `originalLeft` / `originalTop` etc. to
    // the current values. Reason: the saved bytes now contain the modified
    // text drawn on top of a whiteout, so on the NEXT save we should NOT
    // re-whiteout + re-draw (that would double-bake). Also keeps the editor's
    // Fabric overlay in sync with the just-saved file so the user doesn't see
    // a double-text artefact from pdf.js re-extracting both the source word
    // (under the whiteout) and our redraw.
    //
    // `pageNumber` overlays are NOT touched here — they were stripped from the
    // merge input upstream in `buildEditedPdfBytes` (so they were never baked
    // into the bytes) and must survive in `fabricJsonByPage` so the editor
    // renders them via Fabric on reload. See skill log 2026-06-19 (d).
    //
    // Two paths:
    //   • Identity pageOrder: sweep the store map, commit back to the store
    //     so the editorState built below carries pristine flags.
    //   • Materialized reorder: sweep the remapped (display-slot-keyed) map
    //     in-memory and thread it through `remappedState` so the post-upload
    //     `applyPostSaveReset` lands the pristined version atomically. The
    //     store still holds the OLD source-keyed map until that commit so an
    //     upload failure leaves the editor in a recoverable state.
    let finalRemappedState: BuildEditedPdfRemappedState | undefined;
    let editorStateMap: Map<number, string>;

    if (remappedState) {
      const swept = applyPristineSweep(remappedState.fabricJsonByPage);

      if (swept.mutated) {
        logger.info(
          "[PDFedits] save: post-merge fabricJsonByPage cleanup (remapped)",
          {
            pristinedEditModeText: swept.mutatedCount,
          },
        );
      }
      finalRemappedState = {
        extractedPages: remappedState.extractedPages,
        fabricJsonByPage: swept.map,
        historyByPage: remappedState.historyByPage,
        historyIndexByPage: remappedState.historyIndexByPage,
      };
      editorStateMap = swept.map;
    } else {
      const storeMap = usePdfEditorStore.getState().fabricJsonByPage;
      const swept = applyPristineSweep(storeMap);

      if (swept.mutated) {
        logger.info("[PDFedits] save: post-merge fabricJsonByPage cleanup", {
          pristinedEditModeText: swept.mutatedCount,
        });
        usePdfEditorStore.setState({ fabricJsonByPage: swept.map });
      }
      editorStateMap = swept.map;
    }

    const savedFile = new File([savedBytes.buffer as ArrayBuffer], file.name, {
      type: "application/pdf",
    });

    // `buildEditedPdfBytes` flushes the *current* page into `fabricJsonByPage`
    // and the materialized-reorder path further remaps it, so the state
    // snapshot captured at the top of this function is stale. Re-read the
    // store for everything EXCEPT `fabricJsonByPage`, which we override with
    // the (possibly remapped) swept map above so the editorState matches
    // the saved bytes exactly (QA report 2026-06-17).
    const editorState = buildEditorStateJson(
      usePdfEditorStore.getState(),
      editorStateMap,
      finalRemappedState?.extractedPages,
    );

    // Belt-and-braces: fall back to `?id=<docId>` from the URL if the store's
    // `currentDocumentId` was cleared (StrictMode double-mount, loader race,
    // etc.). Sending no `documentId` makes the backend create a fresh
    // Document row and skip the version snapshot — reported 2026-07-23 as
    // "save happens but version history not created" on nav-save.
    const urlDocumentId =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("id") || undefined
        : undefined;
    const effectiveDocumentId = currentDocumentId ?? urlDocumentId;

    logger.info("[PDFedits] save: request", {
      documentId: effectiveDocumentId,
      documentIdSource:
        currentDocumentId !== null
          ? "store"
          : urlDocumentId
            ? "url-fallback"
            : "none",
      hasUnsavedChanges,
      force,
    });

    const document = await documentsService.uploadDocument({
      documentId: effectiveDocumentId,
      file: savedFile,
      editorState,
    });

    logger.info("[PDFedits] save: uploaded", {
      documentId: document.id,
      backendSizeBytes: document.sizeBytes,
      backendVersion: document.version,
    });

    usePdfEditorStore.setState({
      currentDocumentId: document.id,
      currentDocumentName: document.filename,
      hasUnsavedChanges: false,
    });

    return {
      document,
      ok: true,
      remappedState: finalRemappedState,
      savedFile,
    };
  } catch (err) {
    logger.error("Failed to persist editor document", err);

    return { ok: false, reason: "error" };
  }
}

/**
 * Build the JSON sent as `editorState` on the upload form. Envelope is
 * versioned so a future field shape change doesn't break the parser on docs
 * saved by older clients. Trims watermark/bg `imageData` when the payload
 * exceeds the soft cap.
 */
function buildEditorStateJson(
  state: ReturnType<typeof usePdfEditorStore.getState>,
  overrideFabricJsonByPage?: Map<number, string>,
  overrideExtractedPages?: Set<number>,
): string {
  // Overrides win when the caller has post-merge / post-materialize state
  // that the store doesn't reflect yet (sidebar-reorder save path).
  const fabricMap = overrideFabricJsonByPage ?? state.fabricJsonByPage;
  const extracted = overrideExtractedPages ?? state.extractedPages;
  const fabricJsonByPage = Object.fromEntries(fabricMap.entries());

  const full = {
    v: 1 as const,
    watermarkConfig: state.watermarkConfig,
    backgroundImageConfig: state.backgroundImageConfig,
    fabricJsonByPage,
    extractedPages: Array.from(extracted),
  };
  const serialized = JSON.stringify(full);

  if (serialized.length <= EDITOR_STATE_SOFT_LIMIT_BYTES) {
    return serialized;
  }

  // Over cap — strip the inline image data URLs (these are by far the largest
  // contributors). The user's actual watermark IS in the baked PDF; this only
  // affects whether the UI panel can re-display the source image on reload.
  const trimmed = {
    v: 1 as const,
    watermarkConfig: { ...state.watermarkConfig, imageData: null },
    backgroundImageConfig: {
      ...state.backgroundImageConfig,
      imageData: null,
    },
    fabricJsonByPage,
    extractedPages: Array.from(extracted),
  };

  logger.warn?.("editorState exceeded soft cap; dropped inline imageData URLs");

  return JSON.stringify(trimmed);
}
