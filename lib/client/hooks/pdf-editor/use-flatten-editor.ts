"use client";

import type { Canvas as FabricCanvas } from "fabric";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useRef } from "react";

import { getEntitledSnapshot } from "@/lib/client/hooks/billing/entitlement-cache";
import {
  PAYWALL_CANCELLED_ERR_NAME,
  requestPaywall,
} from "@/lib/client/hooks/billing/paywall-bus";
import { buildEditedPdfBytes } from "@/lib/client/pdf-editor/save-utils";
import { useFlattenFileMutation } from "@/lib/client/query/mutations";
import { usePdfEditorStore } from "@/lib/client/stores";
import { snapshotPendingEditorFile } from "@/lib/client/upload/pending-editor-file";
import { dispatchEmailFirstModal } from "@/components/shared/email-first-modal";
import { ROUTES } from "@/lib/shared/constants/routes";
import { triggerBlobDownload } from "@/lib/shared/utils/download";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

/**
 * Shell-level hook that listens for `editor:flatten` (dispatched by
 * HamburgerMenu) and bakes Fabric overlays into the PDF bytes BEFORE
 * sending to the flatten backend.
 *
 * Why shell-level: `buildEditedPdfBytes` needs the live `fabricCanvas`
 * ref, which only PdfEditorShell holds. HamburgerMenu has no canvas
 * access — it must dispatch an event, not call the mutation directly.
 * Same architectural rule as `useExtractImagesEditor` (2026-06-10 f).
 */
export function useFlattenEditor(fabricCanvas: FabricCanvas | null) {
  const flatten = useFlattenFileMutation();
  const { isLoaded: authLoaded, isSignedIn: clerkIsSignedIn } = useAuth();

  const isRunningRef = useRef(false);
  const flattenRef = useRef(flatten);
  const authRef = useRef({ authLoaded, clerkIsSignedIn });
  const fabricCanvasRef = useRef(fabricCanvas);

  useEffect(() => {
    flattenRef.current = flatten;
  }, [flatten]);

  useEffect(() => {
    authRef.current = { authLoaded, clerkIsSignedIn };
  }, [authLoaded, clerkIsSignedIn]);

  useEffect(() => {
    fabricCanvasRef.current = fabricCanvas;
  }, [fabricCanvas]);

  const handleFlatten = useCallback(async () => {
    if (isRunningRef.current) return;

    const state = usePdfEditorStore.getState();

    if (!state.file) {
      toast.info({
        title: "No PDF open",
        description: "Open a PDF before flattening.",
      });

      return;
    }

    const { authLoaded: authReady, clerkIsSignedIn: signedIn } =
      authRef.current;

    if (!authReady) {
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("editor:flatten"));
      }, 250);

      return;
    }

    isRunningRef.current = true;

    try {
      if (!signedIn) {
        await snapshotPendingEditorFile().catch((err) =>
          logger.warn("pending editor file save failed", err),
        );

        const returnTo = `${ROUTES.TOOLS.PDF_EDITOR}?tool=flatten`;

        dispatchEmailFirstModal({
          redirectUrl: returnTo,
          title: "Flatten PDF",
          subtitle: "Create an account to flatten your PDF.",
          submitLabel: "Flatten PDF",
        });

        isRunningRef.current = false;

        return;
      }

      if (!getEntitledSnapshot()) {
        const outcome = await requestPaywall();

        if (outcome !== "success") return;
      }

      if (!state.pdfDocument) {
        toast.error({
          title: "PDF not loaded",
          description: "Wait for the PDF to finish loading and try again.",
        });

        return;
      }

      const { bytes } = await buildEditedPdfBytes({
        currentPage: state.currentPage,
        fabricCanvas: fabricCanvasRef.current,
        file: state.file,
        bakeOverlays: true,
      });

      const bakedFile = new File([bytes as BlobPart], state.file.name, {
        type: "application/pdf",
      });

      const result = await flattenRef.current.mutateAsync({ file: bakedFile });

      triggerBlobDownload(result.blob, result.fileName);
    } catch (err) {
      if ((err as { name?: string })?.name === PAYWALL_CANCELLED_ERR_NAME) {
        return;
      }

      logger.error("Failed to flatten PDF", err);
    } finally {
      isRunningRef.current = false;
    }
  }, []);

  useEffect(() => {
    const onFlatten = () => {
      void handleFlatten();
    };

    window.addEventListener("editor:flatten", onFlatten);

    return () => {
      window.removeEventListener("editor:flatten", onFlatten);
    };
  }, [handleFlatten]);
}
