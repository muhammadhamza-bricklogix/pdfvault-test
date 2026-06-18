import type { Canvas as FabricCanvas } from "fabric";
import type { Document } from "@/lib/shared/types/documents.types";

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

/**
 * Walks the in-store `fabricJsonByPage` and, for every editModeText whose
 * `pristine !== true`, snaps `originalText/originalLeft/originalTop/...` to
 * the current values and flips `pristine` to true. Mutates each page's JSON
 * string in place (rebuilds the Map).
 *
 * Why: the merge pipeline just baked those modifications into the saved
 * bytes via whiteout + drawText. The user's NEXT save (or a reload that
 * reuses the snapshot) must treat those entries as "no modification
 * pending" — otherwise the whiteout-and-redraw runs again, stacking on
 * top of the already-baked text in the saved file (and producing a visual
 * mess in the editor where pdf.js's text-extraction sees both layers).
 */
function markBakedEditModeTextAsPristine(): void {
  const state = usePdfEditorStore.getState();
  const next = new Map<number, string>();
  let mutatedCount = 0;
  let strippedPageNumbers = 0;

  state.fabricJsonByPage.forEach((json, page) => {
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

    // Strip page-number overlays. Reason: the merge just baked them
    // into the source PDF as drawn text. Keeping the IText overlays
    // in `fabricJsonByPage` means the NEXT save (and the editor
    // viewer that re-mounts after `applyPostSaveReset`) will render
    // both the baked copy AND the overlay copy — producing the
    // duplicated / overlapping page-number labels QA reported
    // 2026-06-18. pageNumber objects have no whiteout semantics like
    // editModeText does (there's no "source word underneath" to
    // cover), so the only safe way to prevent double-baking is to
    // drop the overlay once it's in the source. If the user wants to
    // edit / renumber later they can re-run the Page Numbers tool,
    // which clears + re-stamps from scratch.
    const filteredObjs = objsArr.filter((obj) => {
      if (obj.editorType === "pageNumber") {
        strippedPageNumbers++;
        changed = true;

        return false;
      }

      return true;
    });

    for (const obj of filteredObjs) {
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
      parsed.objects = filteredObjs;
      next.set(page, JSON.stringify(parsed));
    } else {
      next.set(page, json);
    }
  });

  if (mutatedCount > 0 || strippedPageNumbers > 0) {
    logger.info("[PDFedits] save: post-merge fabricJsonByPage cleanup", {
      pristinedEditModeText: mutatedCount,
      strippedPageNumbers,
    });
    usePdfEditorStore.setState({ fabricJsonByPage: next });
  }
}

export type PersistEditorResult =
  | { document: Document; ok: true; savedFile: File }
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

    const savedBytes = await buildEditedPdfBytes({
      currentPage,
      fabricCanvas,
      file,
    });

    logger.info("[PDFedits] save: post-merge", {
      sourceFileBytes: sourceSize,
      mergedBytes: savedBytes.byteLength,
      bytesIdenticalToSource: savedBytes.byteLength === sourceSize,
    });

    // Mark every editModeText that the merge just baked as `pristine: true`,
    // and snap its `originalText` / `originalLeft` / `originalTop` etc. to
    // the current values. Reason: the saved bytes now contain the modified
    // text drawn on top of a whiteout, so on the NEXT save we should NOT
    // re-whiteout + re-draw (that would double-bake). Also lets
    // `applyPostSaveReset` preserve `fabricJsonByPage` without dragging
    // the "modified" flag forward into a second whiteout cycle, AND keeps
    // the editor's Fabric overlay in sync with the just-saved file so the
    // user doesn't see a double-text artefact from pdf.js re-extracting
    // both the source word (under the whiteout) and our redraw.
    markBakedEditModeTextAsPristine();

    const savedFile = new File([savedBytes.buffer as ArrayBuffer], file.name, {
      type: "application/pdf",
    });

    // `buildEditedPdfBytes` flushes the *current* page into
    // `fabricJsonByPage`, so the state snapshot captured at the top of this
    // function is stale. Re-read the store to make sure `editorState` carries
    // the edits we just merged (QA report 2026-06-17).
    const editorState = buildEditorStateJson(usePdfEditorStore.getState());

    const document = await documentsService.uploadDocument({
      documentId: currentDocumentId ?? undefined,
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

    return { document, ok: true, savedFile };
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
): string {
  const fabricJsonByPage = Object.fromEntries(state.fabricJsonByPage.entries());

  const full = {
    v: 1 as const,
    watermarkConfig: state.watermarkConfig,
    backgroundImageConfig: state.backgroundImageConfig,
    fabricJsonByPage,
    extractedPages: Array.from(state.extractedPages),
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
    extractedPages: Array.from(state.extractedPages),
  };

  logger.warn?.("editorState exceeded soft cap; dropped inline imageData URLs");

  return JSON.stringify(trimmed);
}
