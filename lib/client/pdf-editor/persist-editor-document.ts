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
    const savedBytes = await buildEditedPdfBytes({
      currentPage,
      fabricCanvas,
      file,
    });

    const savedFile = new File([savedBytes.buffer as ArrayBuffer], file.name, {
      type: "application/pdf",
    });

    const editorState = buildEditorStateJson(state);

    const document = await documentsService.uploadDocument({
      documentId: currentDocumentId ?? undefined,
      file: savedFile,
      editorState,
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
  };

  logger.warn?.("editorState exceeded soft cap; dropped inline imageData URLs");

  return JSON.stringify(trimmed);
}
