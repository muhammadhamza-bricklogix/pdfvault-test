"use client";

import type { Canvas as FabricCanvas } from "fabric";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import { useTrackedUpload } from "@/lib/client/hooks/upload/use-tracked-upload";
import { buildEditedPdfBytes } from "@/lib/client/pdf-editor/save-utils";
import { usePdfEditorStore } from "@/lib/client/stores";
import { ROUTES } from "@/lib/shared/constants/routes";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

/**
 * Listens for `editor:save` (dispatched by the Save button) and runs the
 * flatten-and-upload pipeline:
 *   flush live page  →  merge overlays into PDF (pdf-lib)  →  upload via
 *   tracked-upload (upserts when documentId is known)  →  sync URL `?id=`.
 */
export function useSaveEditor(fabricCanvas: FabricCanvas | null) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { start } = useTrackedUpload();

  const currentDocumentId = usePdfEditorStore((s) => s.currentDocumentId);
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const file = usePdfEditorStore((s) => s.file);
  const isSignedIn = usePdfEditorStore((s) => s.isSignedIn);

  // Mirror props/state into a ref so the callback always reads fresh values
  // without re-binding the window listener on every render.
  const isSavingRef = useRef(false);
  const stateRef = useRef({
    currentDocumentId,
    currentPage,
    fabricCanvas,
    file,
    isSignedIn,
  });

  useEffect(() => {
    stateRef.current = {
      currentDocumentId,
      currentPage,
      fabricCanvas,
      file,
      isSignedIn,
    };
  }, [currentDocumentId, currentPage, fabricCanvas, file, isSignedIn]);

  const handleSave = useCallback(async () => {
    if (isSavingRef.current) return;

    const {
      currentDocumentId: docId,
      currentPage: page,
      fabricCanvas: liveCanvas,
      file: sourceFile,
      isSignedIn: signedIn,
    } = stateRef.current;

    if (!sourceFile) {
      toast.error({
        title: "Nothing to save",
        description: "Open a PDF before saving.",
      });

      return;
    }

    if (!signedIn) {
      toast.error({
        title: "Sign in required",
        description: "Sign in to save your edits to the cloud.",
      });

      return;
    }

    isSavingRef.current = true;

    try {
      const savedBytes = await buildEditedPdfBytes({
        currentPage: page,
        fabricCanvas: liveCanvas,
        file: sourceFile,
      });

      const savedFile = new File(
        [savedBytes.buffer as ArrayBuffer],
        sourceFile.name,
        { type: "application/pdf" },
      );

      start({
        documentId: docId ?? undefined,
        file: savedFile,
        onOpen: (id) => {
          if (searchParams.get("id") !== id) {
            const params = new URLSearchParams(searchParams.toString());

            params.set("id", id);
            router.replace(`${ROUTES.TOOLS.PDF_EDITOR}?${params.toString()}`);
          }
        },
      });
    } catch (err) {
      logger.error("Failed to save PDF", err);
      toast.error({
        title: "Save failed",
        description: "We couldn't save your edits. Please try again.",
      });
    } finally {
      isSavingRef.current = false;
    }
  }, [router, searchParams, start]);

  useEffect(() => {
    const onSave = () => {
      void handleSave();
    };

    window.addEventListener("editor:save", onSave);

    return () => {
      window.removeEventListener("editor:save", onSave);
    };
  }, [handleSave]);
}
