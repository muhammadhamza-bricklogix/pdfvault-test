import type { Canvas as FabricCanvas } from "fabric";
import type { Document } from "@/lib/shared/types/documents.types";

import { documentsService } from "@/lib/shared/api/services/documents.service";
import { buildEditedPdfBytes } from "@/lib/client/pdf-editor/save-utils";
import { usePdfEditorStore } from "@/lib/client/stores";
import { logger } from "@/lib/shared/utils/logger";

export type PersistEditorResult =
  | { document: Document; ok: true }
  | { ok: false; reason: "error" | "no-file" | "not-signed-in" | "not-loaded" };

type PersistEditorDocumentInput = {
  fabricCanvas?: FabricCanvas | null;
};

/**
 * Builds the current editor PDF (with Fabric overlays) and uploads it to the cloud.
 * Used by Save, Manage Pages auto-save, and save-before-navigate flows.
 */
export async function persistEditorDocument({
  fabricCanvas = null,
}: PersistEditorDocumentInput = {}): Promise<PersistEditorResult> {
  const state = usePdfEditorStore.getState();
  const { currentDocumentId, currentPage, file, isSignedIn, pdfDocument } =
    state;

  if (!file) {
    return { ok: false, reason: "no-file" };
  }

  if (!isSignedIn) {
    return { ok: false, reason: "not-signed-in" };
  }

  if (!pdfDocument) {
    return { ok: false, reason: "not-loaded" };
  }

  try {
    const savedBytes = await buildEditedPdfBytes({
      currentPage,
      fabricCanvas,
      file,
    });

    const savedFile = new File([savedBytes.buffer as ArrayBuffer], file.name, {
      type: "application/pdf",
    });

    const document = await documentsService.uploadDocument({
      documentId: currentDocumentId ?? undefined,
      file: savedFile,
    });

    usePdfEditorStore.setState({
      currentDocumentId: document.id,
      currentDocumentName: document.filename,
      hasUnsavedChanges: false,
    });

    return { ok: true, document };
  } catch (err) {
    logger.error("Failed to persist editor document", err);

    return { ok: false, reason: "error" };
  }
}
