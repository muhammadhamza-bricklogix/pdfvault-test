"use client";

import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

import { dispatchEmailFirstModal } from "@/components/shared/email-first-modal";
import { downloadStampedFormAsImages } from "@/lib/client/forms/download-form-images";
import {
  bindNecDraftToDocument,
  getNecBoundDocumentId,
  markNecSessionFinalized,
} from "@/components/sections/forms/NecAutoPersist";
import { necLibraryFilename } from "@/components/sections/forms/NecEditorBootstrap";
import {
  stampNecDocument,
  stampNecPreview,
} from "@/lib/client/forms/stamp-nec-client";
import { validate1099Nec } from "@/lib/client/forms/validate-1099-nec";
import { ensureFreshEntitlement } from "@/lib/client/hooks/billing/ensure-entitlement";
import { requestPaywall } from "@/lib/client/hooks/billing/paywall-bus";
import { documentsService } from "@/lib/shared/api/services/documents.service";
import { formsService } from "@/lib/shared/api/services/forms.service";
import { useFormEditorStore, usePdfEditorStore } from "@/lib/client/stores";
import { documentKeys } from "@/lib/shared/constants/query-keys";
import { ROUTES } from "@/lib/shared/constants/routes";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

const EXPORT_EVENT = "editor:export";
const SAVE_EVENT = "editor:save";
const SAVE_BEFORE_ACTION_EVENT = "editor:save-before-action";
const SAVE_AND_CONTINUE_EVENT = "editor:w9-save-and-continue";

type SaveBeforeActionDetail = {
  onComplete?: (result: { ok: boolean }) => void;
};

type SaveAndContinueDetail = {
  onComplete: (result: {
    ok: boolean;
    reason?: "error" | "not-signed-in" | "cancelled" | "not-ready";
  }) => void;
};

type ExportDetail = {
  filename?: string;
  format?: string;
};

async function triggerDownload(downloadUrl: string, filename = "1099-nec.pdf") {
  try {
    const res = await fetch(downloadUrl);

    if (!res.ok) throw new Error("Fetch failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

const LIBRARY_PAGE_SIZE = 100;
const LIBRARY_MAX_PAGES = 100;

/**
 * Finds the one 1099-NEC row by name. Walks the real page count rather than a
 * fixed number of pages, so a large library cannot hide the row and cause a
 * duplicate. Throws on a failed request so the caller can refuse to save
 * rather than guess that no row exists.
 */
async function findNecLibraryDocumentId(
  filename: string,
): Promise<string | null> {
  const needle = filename.toLowerCase();
  let lastPage = 1;

  for (let page = 1; page <= Math.min(lastPage, LIBRARY_MAX_PAGES); page += 1) {
    const response = await documentsService.listDocuments({
      page,
      pageSize: LIBRARY_PAGE_SIZE,
    });
    const match = response.items.find(
      (doc) => doc.filename.toLowerCase() === needle,
    );

    if (match) return match.id;
    lastPage = response.pagination.totalPages;
  }

  return null;
}

function hasAnyValue(values: Record<string, string>): boolean {
  return Object.values(values ?? {}).some(
    (v) => typeof v === "string" && v.trim() !== "",
  );
}

async function buildNecPaywallPreviewUrl(
  values: Record<string, string>,
): Promise<string | null> {
  try {
    const bytes = await stampNecPreview(values);
    const blob = new Blob([bytes.buffer as ArrayBuffer], {
      type: "application/pdf",
    });

    return URL.createObjectURL(blob);
  } catch (err) {
    logger.captureError(err, "1099-nec.paywall_preview_generate");

    return null;
  }
}

export function NecFinalizeIntercept() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const inFlightRef = useRef(false);
  const autoLaunchedRef = useRef(false);
  const lastFinalizeRef = useRef<{ key: string; downloadUrl: string } | null>(
    null,
  );
  const sessionId = useFormEditorStore((s) => s.sessionId);

  // Refs keep the listener registration stable; see W9FinalizeIntercept.
  const isLoadedRef = useRef(isLoaded);
  const isSignedInRef = useRef(isSignedIn);
  const queryClientRef = useRef(queryClient);

  useEffect(() => {
    isLoadedRef.current = isLoaded;
    isSignedInRef.current = isSignedIn;
    queryClientRef.current = queryClient;
  }, [isLoaded, isSignedIn, queryClient]);

  useEffect(() => {
    if (autoLaunchedRef.current) return;
    if (!isLoaded || !isSignedIn) return;
    if (!sessionId) return;
    const format = searchParams.get("export");

    if (!format) return;

    autoLaunchedRef.current = true;
    const filenameParam = searchParams.get("filename");

    const timeoutId = window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent(EXPORT_EVENT, {
          detail: {
            format,
            ...(filenameParam ? { filename: filenameParam } : {}),
          },
        }),
      );

      const cleaned = new URLSearchParams(searchParams.toString());

      cleaned.delete("export");
      cleaned.delete("filename");
      const nextQuery = cleaned.toString();

      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [isLoaded, isSignedIn, sessionId, searchParams, pathname, router]);

  useLayoutEffect(() => {
    const finalizeGated = async (
      targetFilename: string,
      targetExt: "pdf" | "png" | "jpg" = "pdf",
    ): Promise<string | null> => {
      const state = useFormEditorStore.getState();
      const currentSessionId = state.sessionId;
      const values = state.values;

      if (!currentSessionId) {
        toast.error({
          title: "Session not started",
          description:
            "We couldn't reach the form service. Check your connection and reload the page.",
        });

        return null;
      }

      if (!isLoadedRef.current) {
        toast.error({
          title: "Just a sec",
          description: "Signing you in — try Download again in a moment.",
        });

        return null;
      }

      if (!isSignedInRef.current) {
        dispatchEmailFirstModal({
          redirectUrl: `${ROUTES.FORMS.NEC_1099_EDIT}?export=${targetExt}&filename=${encodeURIComponent(targetFilename)}`,
          title: "Download your 1099-NEC",
          subtitle:
            "Create an account or sign in to download your official Form 1099-NEC.",
          submitLabel: "Download file",
        });

        return null;
      }

      const cacheKey = `${currentSessionId}::${JSON.stringify(values)}::${targetFilename}`;

      if (lastFinalizeRef.current?.key === cacheKey) {
        return lastFinalizeRef.current.downloadUrl;
      }

      // Validation runs BEFORE the entitlement gate. The W-9 has no
      // client-side validation on this path, so leaving it after the
      // paywall made the 1099-NEC fail where the W-9 downloaded — and it
      // asked a user to pay before telling them the form was unusable.
      const errors = validate1099Nec({ values });
      const errorIds = Object.keys(errors);

      if (errorIds.length > 0) {
        state.setErrors(errors);
        toast.error({
          title: "Check your 1099-NEC",
          description:
            errorIds.length === 1
              ? errors[errorIds[0]!]
              : `${errorIds.length} fields need attention — the first is: ${errors[errorIds[0]!]}`,
        });

        const firstEl = document.getElementById(`field-input-${errorIds[0]}`);

        firstEl?.scrollIntoView({ block: "center", behavior: "smooth" });
        (firstEl as HTMLInputElement | null)?.focus?.();

        return null;
      }

      state.setErrors({});

      const entitled = await ensureFreshEntitlement();

      if (!entitled) {
        const previewObjectUrl = await buildNecPaywallPreviewUrl(values);

        try {
          const outcome = await requestPaywall({
            filename: targetFilename,
            sourceExt: "pdf",
            targetExt,
            ...(previewObjectUrl ? { previewObjectUrl } : {}),
          });

          if (outcome !== "success") return null;
        } finally {
          if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
        }
      }

      const { downloadUrl } = await formsService.finalizeFormSession({
        sessionId: currentSessionId,
        values,
        signatureKey: null,
      });

      markNecSessionFinalized();
      lastFinalizeRef.current = { key: cacheKey, downloadUrl };

      return downloadUrl;
    };

    const uploadToLibrary = async (
      blob: Blob,
      values: Record<string, string>,
    ): Promise<boolean> => {
      const { currentDocumentId } = usePdfEditorStore.getState();
      const filename = necLibraryFilename();
      let targetId = currentDocumentId ?? getNecBoundDocumentId();

      if (!targetId) {
        try {
          targetId = await findNecLibraryDocumentId(filename);
        } catch (lookupErr) {
          // Refuse to save rather than risk a second row: a failed lookup
          // is not evidence that no row exists.
          logger.captureError(lookupErr, "1099-nec.library_lookup");

          return false;
        }
      }

      try {
        const stampedFile = new File([blob], filename, {
          type: "application/pdf",
        });
        const editorState = JSON.stringify({ v: 1, nec: { values } });
        const upload = (documentId?: string) =>
          documentsService.uploadDocument({
            file: stampedFile,
            documentId,
            editorState,
          });
        // The remembered row can have been deleted from My PDFs, which the
        // backend answers with a 404. Retry once as a fresh row so the user
        // is not stuck unable to save.
        const savedDoc = targetId
          ? await upload(targetId).catch(() => upload(undefined))
          : await upload(undefined);

        usePdfEditorStore.getState().setCurrentDocument({
          id: savedDoc.id,
          name: savedDoc.filename,
        });
        bindNecDraftToDocument(savedDoc.id);

        try {
          queryClientRef.current.invalidateQueries({
            queryKey: documentKeys.lists(),
          });
        } catch {
          /* non-fatal */
        }

        return true;
      } catch (saveErr) {
        logger.captureError(saveErr, "1099-nec.library_save");

        return false;
      }
    };

    const saveToLibrary = async (
      downloadUrl: string,
      values: Record<string, string>,
    ): Promise<boolean> => {
      try {
        const res = await fetch(downloadUrl);

        if (!res.ok) {
          throw new Error(
            `Couldn't fetch the stamped 1099-NEC (HTTP ${res.status}).`,
          );
        }

        return uploadToLibrary(await res.blob(), values);
      } catch (saveErr) {
        logger.captureError(saveErr, "1099-nec.library_save_fetch");

        return false;
      }
    };

    const saveDraftToLibrary = async (
      values: Record<string, string>,
    ): Promise<boolean> => {
      try {
        const bytes = await stampNecDocument(values);
        const blob = new Blob([bytes.buffer as ArrayBuffer], {
          type: "application/pdf",
        });

        return uploadToLibrary(blob, values);
      } catch (stampErr) {
        logger.captureError(stampErr, "1099-nec.draft_stamp");

        return false;
      }
    };

    const requireSignIn = (): boolean => {
      if (!isLoadedRef.current) {
        toast.error({
          title: "Just a sec",
          description: "Signing you in — try again in a moment.",
        });

        return false;
      }
      if (!isSignedInRef.current) {
        dispatchEmailFirstModal({
          redirectUrl: ROUTES.FORMS.NEC_1099_EDIT,
          title: "Save your 1099-NEC",
          subtitle:
            "Create an account or sign in to keep this form in My PDFs.",
          submitLabel: "Save form",
        });

        return false;
      }

      return true;
    };

    const saveBeforeActionHandler = (event: Event) => {
      event.stopImmediatePropagation();
      const detail = (event as CustomEvent<SaveBeforeActionDetail>).detail;

      detail?.onComplete?.({ ok: true });
    };

    const onExport = async (e: Event) => {
      e.stopImmediatePropagation();
      e.preventDefault();

      if (inFlightRef.current) return;

      const detail = (e as CustomEvent<ExportDetail>).detail;
      const requestedFormat =
        detail?.format === "png" || detail?.format === "jpg"
          ? detail.format
          : "pdf";
      const baseName = (detail?.filename ?? "Form-1099-NEC").replace(
        /\.[^./\\]+$/,
        "",
      );
      const targetFilename = `${baseName}.${requestedFormat}`;

      inFlightRef.current = true;

      const loadingKey = toast.loading({
        title: "Preparing your 1099-NEC",
        description: "Stamping your values onto the template…",
      });

      try {
        const values = useFormEditorStore.getState().values;
        const downloadUrl = await finalizeGated(
          targetFilename,
          requestedFormat,
        );

        if (!downloadUrl) {
          toast.close(loadingKey);

          return;
        }

        toast.close(loadingKey);

        if (requestedFormat === "pdf") {
          await triggerDownload(downloadUrl, targetFilename);
        } else {
          await downloadStampedFormAsImages({
            stampedPdfUrl: downloadUrl,
            format: requestedFormat,
            userFilename: targetFilename,
            fallbackBaseName: "1099-nec",
          });
        }

        const saved = await saveToLibrary(downloadUrl, values);

        toast.success({
          title: "1099-NEC ready",
          description: saved
            ? "Downloaded and saved to My PDFs."
            : "Downloaded. We couldn't add it to My PDFs — try Save to retry.",
        });
      } catch (err) {
        toast.close(loadingKey);
        logger.captureError(err, "1099-nec.finalize");
        toast.error({
          title: "Finalization failed",
          description:
            err instanceof Error
              ? err.message
              : "Could not finalize the form. Please try again.",
        });
      } finally {
        inFlightRef.current = false;
      }
    };

    const onSave = async (e: Event) => {
      e.stopImmediatePropagation();
      e.preventDefault();

      if (inFlightRef.current) return;

      const values = useFormEditorStore.getState().values;

      if (!hasAnyValue(values)) {
        toast.error({
          title: "Nothing to save yet",
          description: "Fill in at least one field first.",
        });

        return;
      }

      if (!requireSignIn()) return;

      inFlightRef.current = true;
      const saveLoadingKey = toast.loading({
        title: "Saving your 1099-NEC",
        description: "Updating your form in My PDFs…",
      });

      try {
        const saved = await saveDraftToLibrary(values);

        toast.close(saveLoadingKey);

        if (saved) {
          toast.success({
            title: "Saved",
            description: "Your 1099-NEC in My PDFs is up to date.",
          });
        } else {
          toast.error({
            title: "Save failed",
            description: "We couldn't add it to My PDFs. Please try again.",
          });
        }
      } catch (err) {
        toast.close(saveLoadingKey);
        logger.captureError(err, "1099-nec.save");
        toast.error({
          title: "Save failed",
          description: "Could not save your progress.",
        });
      } finally {
        inFlightRef.current = false;
      }
    };

    // Navigating away never writes a library row, matching the W-9. The
    // entries live in the local draft and are restored on the next visit;
    // only an explicit Save or Download touches My PDFs. Answering here
    // rather than ignoring the event keeps navigation from stalling on the
    // caller's 30s timeout.
    const onSaveAndContinue = (event: Event) => {
      event.stopImmediatePropagation();
      const detail = (event as CustomEvent<SaveAndContinueDetail>).detail;

      detail?.onComplete?.({ ok: true, reason: "not-ready" });
    };

    window.addEventListener(
      SAVE_BEFORE_ACTION_EVENT,
      saveBeforeActionHandler,
      true,
    );
    window.addEventListener(EXPORT_EVENT, onExport, true);
    window.addEventListener(SAVE_EVENT, onSave, true);
    window.addEventListener(SAVE_AND_CONTINUE_EVENT, onSaveAndContinue, true);

    return () => {
      window.removeEventListener(
        SAVE_BEFORE_ACTION_EVENT,
        saveBeforeActionHandler,
        true,
      );
      window.removeEventListener(EXPORT_EVENT, onExport, true);
      window.removeEventListener(SAVE_EVENT, onSave, true);
      window.removeEventListener(
        SAVE_AND_CONTINUE_EVENT,
        onSaveAndContinue,
        true,
      );
    };
  }, []);

  return null;
}
