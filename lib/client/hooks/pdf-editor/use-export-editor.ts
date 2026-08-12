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
  /**
   * Optional user-chosen base name (no extension). Emitted by the top-bar
   * format modal so the download honours the "File name" field. When absent
   * the source file's own basename is used, preserving the pre-modal default.
   */
  filename?: string;
  /** When true, open the browser print dialog instead of downloading. */
  print?: boolean;
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

function sanitizeBaseName(input: string): string {
  const stripped = input.replace(/\.[^./\\]+$/, "").trim();

  return stripped.length > 0 ? stripped : "document";
}

function ensureExtension(base: string, ext: string): string {
  return base.toLowerCase().endsWith(`.${ext}`) ? base : `${base}.${ext}`;
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
 * - For PDF: checks entitlement, downloads/prints (paywall if not entitled).
 * - For non-PDF: attempts conversion first (bypassing client gate so the
 *   server decides); if 402 (not entitled) opens paywall with PDF preview,
 *   then retries conversion after payment.
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

  const handleExport = useCallback(
    async (
      format: ExportFormat,
      customFilename?: string,
      shouldPrint?: boolean,
    ) => {
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
            new CustomEvent("editor:export", {
              detail: { filename: customFilename, format },
            }),
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

            await savePendingEditorFile(
              sourceFile,
              fabricJsonByPage,
              extractedPages,
            );
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
              "Sign in and we'll bring you back to finish the download right where you left off.",
            confirmLabel: "Sign in & continue",
            redirectUrl: returnTo,
          });

          isExportingRef.current = false;

          return;
        }

        // Build PDF bytes client-side first — no network call, always fast.
        const { bytes } = await buildEditedPdfBytes({
          currentPage: page,
          fabricCanvas: liveCanvas,
          file: sourceFile,
          bakeOverlays: true,
        });

        const userBase = customFilename
          ? sanitizeBaseName(customFilename)
          : null;

        // ── PDF export (download or print) ────────────────────────────────
        if (format === "pdf") {
          const entitled = await ensureFreshEntitlement();

          if (!entitled) {
            const pdfBlob = new Blob([bytes.buffer as ArrayBuffer], {
              type: "application/pdf",
            });
            const objectUrl = URL.createObjectURL(pdfBlob);

            try {
              const outcome = await requestPaywall({
                filename: sourceFile.name,
                previewObjectUrl: objectUrl,
                sourceExt: "pdf",
                targetExt: "pdf",
              });

              if (outcome !== "success") return;
            } finally {
              URL.revokeObjectURL(objectUrl);
            }
          }

          if (shouldPrint) {
            const blob = new Blob([bytes.buffer as ArrayBuffer], {
              type: "application/pdf",
            });
            const url = URL.createObjectURL(blob);
            const iframe = document.createElement("iframe");

            iframe.style.cssText =
              "position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none";
            iframe.src = url;
            document.body.appendChild(iframe);
            iframe.onload = () => {
              iframe.contentWindow?.print();
              setTimeout(() => {
                URL.revokeObjectURL(url);
                document.body.removeChild(iframe);
              }, 60_000);
            };

            return;
          }

          const outName = userBase
            ? ensureExtension(userBase, "pdf")
            : buildPdfExportFilename(sourceFile.name);

          downloadBytes(bytes, outName);
          toast.success({
            title: "Exported",
            description: "Your edited PDF has been downloaded.",
          });

          return;
        }

        // ── Non-PDF export ────────────────────────────────────────────────
        // Check entitlement first. Non-entitled users see the paywall with a
        // PDF preview of their document; conversion only runs after payment so
        // there is never a wasted server-side conversion for non-premium users.
        const entitled = await ensureFreshEntitlement();

        const conversionType = FORMAT_TO_CONVERSION_TYPE[format];
        const baseName =
          userBase ?? (sourceFile.name.replace(/\.[^.]+$/, "") || "document");
        const pdfFile = new File(
          [bytes.buffer as ArrayBuffer],
          `${baseName}.pdf`,
          { type: "application/pdf" },
        );

        if (!entitled) {
          const pdfBlob = new Blob([bytes.buffer as ArrayBuffer], {
            type: "application/pdf",
          });
          const objectUrl = URL.createObjectURL(pdfBlob);

          try {
            const outcome = await requestPaywall({
              filename: sourceFile.name,
              previewObjectUrl: objectUrl,
              sourceExt: "pdf",
              targetExt: format,
            });

            if (outcome !== "success") return;
          } finally {
            URL.revokeObjectURL(objectUrl);
          }
        }

        // Entitled (or just paid) — convert and download.
        let result: Awaited<ReturnType<typeof convertRef.current.mutateAsync>>;

        try {
          result = await convertRef.current.mutateAsync({
            file: pdfFile,
            type: conversionType,
          });
        } catch (err) {
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

        try {
          const serverExt = result.fileName.match(/\.[^.]+$/)?.[0]?.slice(1);
          const outName =
            userBase && serverExt
              ? ensureExtension(userBase, serverExt)
              : result.fileName;

          triggerBlobDownload(result.blob, outName);
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
    },
    [],
  );

  useEffect(() => {
    const onExport = (event: Event) => {
      const detail = (event as CustomEvent<EditorExportEventDetail>).detail;
      const format = detail?.format ?? "pdf";

      void handleExport(format, detail?.filename, detail?.print);
    };

    window.addEventListener("editor:export", onExport);

    return () => {
      window.removeEventListener("editor:export", onExport);
    };
  }, [handleExport]);
}
