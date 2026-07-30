"use client";

import type { Canvas as FabricCanvas } from "fabric";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useRef } from "react";

import { ensureFreshEntitlement } from "@/lib/client/hooks/billing/ensure-entitlement";
import {
  PAYWALL_CANCELLED_ERR_NAME,
  requestPaywall,
} from "@/lib/client/hooks/billing/paywall-bus";
import { useConvertFileMutation } from "@/lib/client/query/mutations/conversion.mutation";
import {
  buildEditedPdfBytes,
  flushLiveFabricPage,
} from "@/lib/client/pdf-editor/save-utils";
import { usePdfEditorStore } from "@/lib/client/stores";
import { savePendingEditorFile } from "@/lib/client/upload/pending-editor-file";
import { dispatchSignInPrompt } from "@/components/shared/sign-in-prompt-modal";
import { ROUTES } from "@/lib/shared/constants/routes";
import { triggerBlobDownload } from "@/lib/shared/utils/download";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

export type ExportFormat =
  | "pdf"
  | "docx"
  | "xlsx"
  | "pptx"
  | "jpg"
  | "png"
  | "html"
  | "txt";

export type EditorExportEventDetail = {
  format: ExportFormat;
};

const FORMAT_TO_CONVERSION_TYPE: Record<
  Exclude<ExportFormat, "pdf">,
  | "pdf_to_docx"
  | "pdf_to_xlsx"
  | "pdf_to_pptx"
  | "pdf_to_jpg"
  | "pdf_to_png"
  | "pdf_to_html"
  | "pdf_to_txt"
> = {
  docx: "pdf_to_docx",
  html: "pdf_to_html",
  jpg: "pdf_to_jpg",
  png: "pdf_to_png",
  pptx: "pdf_to_pptx",
  txt: "pdf_to_txt",
  xlsx: "pdf_to_xlsx",
};

function buildPdfExportFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;

  return `${base} (edited).pdf`;
}

function downloadBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: "application/pdf",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Listens for `editor:export` (dispatched by the Export menu) and either:
 * - Runs the flatten-and-download PDF pipeline locally (format === "pdf"), or
 * - Flattens to a PDF blob first, then routes it through the /conversion
 *   backend to produce the requested non-PDF format.
 */
export function useExportEditor(fabricCanvas: FabricCanvas | null) {
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const file = usePdfEditorStore((s) => s.file);
  // Read auth from Clerk directly rather than from the store's cached
  // `isSignedIn` — the store copy is updated in a separate useEffect
  // downstream (PdfEditorShell → setIsSignedIn), and there is a window
  // during the auth-return flow where that sync hasn't run yet. Reading
  // Clerk's hook keeps the export gate honest at the exact moment the
  // event fires.
  const { isLoaded: authLoaded, isSignedIn: clerkIsSignedIn } = useAuth();
  const convert = useConvertFileMutation();

  const isExportingRef = useRef(false);
  const stateRef = useRef({
    currentPage,
    fabricCanvas,
    file,
    authLoaded,
    clerkIsSignedIn,
  });

  useEffect(() => {
    stateRef.current = {
      currentPage,
      fabricCanvas,
      file,
      authLoaded,
      clerkIsSignedIn,
    };
  }, [currentPage, fabricCanvas, file, authLoaded, clerkIsSignedIn]);

  const convertRef = useRef(convert);

  useEffect(() => {
    convertRef.current = convert;
  }, [convert]);

  const handleExport = useCallback(async (format: ExportFormat) => {
    if (isExportingRef.current) return;

    const {
      currentPage: page,
      fabricCanvas: liveCanvas,
      file: sourceFile,
      authLoaded: authReady,
      clerkIsSignedIn: signedIn,
    } = stateRef.current;

    if (!sourceFile) {
      toast.error({
        title: "Nothing to export",
        description: "Open a PDF before exporting.",
      });

      return;
    }

    // If Clerk hasn't finished hydrating yet, defer for a short beat and
    // re-dispatch the export event. Otherwise a fresh-return-from-sign-in
    // load can fire editor:export before authLoaded flips to true — we'd
    // read isSignedIn=false and pointlessly redirect the user back into
    // the sign-in flow they just completed. Re-dispatching (rather than
    // recursing into handleExport) keeps the closure lint rule happy and
    // still routes through the listener once auth is ready.
    if (!authReady) {
      isExportingRef.current = false;
      window.setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("editor:export", { detail: { format } }),
        );
      }, 250);

      return;
    }

    isExportingRef.current = true;

    try {
      // ALL downloads (including plain PDF) require sign-in + subscription.
      // Guests can open a PDF and edit it locally, but downloading —
      // in any format — is a paid feature. Gate the auth check FIRST so
      // a signed-out user is routed through sign-in before we even open
      // the paywall — otherwise the paywall opens on an anon client and
      // hits "Couldn't start checkout". After sign-in the user returns
      // to the same editor with `?export=<fmt>` set, so the export
      // re-fires automatically.
      if (!signedIn) {
        try {
          // Flush the live canvas for the current page into the store so
          // the serialized fabric state includes the user's latest edits
          // (the store may lag the live canvas by one page-navigation).
          if (liveCanvas) {
            flushLiveFabricPage(page, liveCanvas);
          }
          // Persist the file AND any per-page Fabric edits across the
          // full-page sign-in redirect so the editor can rehydrate both
          // on return — otherwise the user loses all unsaved changes.
          const { fabricJsonByPage, extractedPages } =
            usePdfEditorStore.getState();

          await savePendingEditorFile(sourceFile, fabricJsonByPage, extractedPages);
        } catch (err) {
          logger.warn("pending editor file save failed", err);
        }

        const returnTo = `${ROUTES.TOOLS.PDF_EDITOR}?export=${encodeURIComponent(format)}`;

        // Prompt with a real confirm modal (not a fire-and-forget
        // toast + redirect). The user always knows what's about to
        // happen and can cancel to keep editing locally.
        dispatchSignInPrompt({
          title: "Sign in to download",
          description:
            "Downloading is a paid feature. Sign in and we'll bring you back to finish the download right where you left off.",
          confirmLabel: "Sign in & continue",
          redirectUrl: returnTo,
        });

        isExportingRef.current = false;

        return;
      }

      // Paywall gate for signed-in but unentitled users. Runs BEFORE the
      // CPU-heavy bake so the modal doesn't pop while the export
      // busy-spinner is grinding — and so cancelling the paywall doesn't
      // leave a "failed" toast on a build that never needed to run.
      // `ensureFreshEntitlement()` forces a network read when the
      // snapshot is `false` (may be stale immediately post-signin
      // before `useSubscriptionQuery` resolves) so we don't fire the
      // paywall for an already-subscribed user.
      const entitled = await ensureFreshEntitlement();

      if (!entitled) {
        const outcome = await requestPaywall();

        if (outcome !== "success") {
          // User dismissed the paywall — silent bail-out. Not an error;
          // the user simply chose not to buy.
          return;
        }
      }

      // Export bakes the watermark + bg image into the downloaded copy. The
      // cloud-saved PDF intentionally does NOT have them baked (that's why
      // Save passes `bakeOverlays: false` / default) — keeping the source
      // file clean prevents per-save stacking and text-position drift. The
      // user's downloaded copy is the only place we bake on demand.
      // Export discards `remappedState`. The download is a one-shot file —
      // there's no in-app editor state to keep in sync with the rebuilt
      // page order, just bytes the browser will save to disk. The store
      // stays on the original `file` until the user explicitly hits Save.
      const { bytes } = await buildEditedPdfBytes({
        currentPage: page,
        fabricCanvas: liveCanvas,
        file: sourceFile,
        bakeOverlays: true,
      });

      if (format === "pdf") {
        downloadBytes(bytes, buildPdfExportFilename(sourceFile.name));
        toast.success({
          title: "Exported",
          description: "Your edited PDF has been downloaded.",
        });

        return;
      }

      const conversionType = FORMAT_TO_CONVERSION_TYPE[format];
      const baseName = sourceFile.name.replace(/\.[^.]+$/, "") || "document";
      const pdfFile = new File(
        [bytes.buffer as ArrayBuffer],
        `${baseName}.pdf`,
        {
          type: "application/pdf",
        },
      );

      // The mutation owns its own loading/success/error toasts; we await the
      // result here so we can trigger the browser download from the returned
      // blob (otherwise the file is converted but never offered to the user).
      let result: Awaited<ReturnType<typeof convertRef.current.mutateAsync>>;

      try {
        result = await convertRef.current.mutateAsync({
          file: pdfFile,
          type: conversionType,
        });
      } catch (err) {
        // The axios interceptor throws a well-known PaywallCancelledError
        // when the user dismisses the payment modal on a 402/403 retry.
        // Treat that as a normal user action — no error toast.
        if ((err as { name?: string })?.name === PAYWALL_CANCELLED_ERR_NAME) {
          return;
        }
        logger.error("Failed to export PDF", err);
        toast.error({
          title: "Export failed",
          description: "We couldn't export your edits. Please try again.",
        });

        return;
      }

      // Conversion mutation already fired its own success toast in
      // onSuccess — DO NOT re-toast an error if the blob download itself
      // fails (QA feedback 2026-07-29 item 81: "failed export message
      // even though the file downloaded fine"). Log only.
      try {
        triggerBlobDownload(result.blob, result.fileName);
      } catch (err) {
        logger.error("blob download failed after successful conversion", err);
      }
    } catch (err) {
      // Any pre-mutation exception (buildEditedPdfBytes, file
      // preparation) still surfaces to the user.
      if ((err as { name?: string })?.name === PAYWALL_CANCELLED_ERR_NAME) {
        return;
      }
      logger.error("Failed to export PDF", err);
      toast.error({
        title: "Export failed",
        description: "We couldn't export your edits. Please try again.",
      });
    } finally {
      isExportingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const onExport = (event: Event) => {
      const detail = (event as CustomEvent<EditorExportEventDetail>).detail;
      const format = detail?.format ?? "pdf";

      void handleExport(format);
    };

    window.addEventListener("editor:export", onExport);

    return () => {
      window.removeEventListener("editor:export", onExport);
    };
  }, [handleExport]);
}
