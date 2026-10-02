"use client";

import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

import { dispatchEmailFirstModal } from "@/components/shared/email-first-modal";
import {
  describeFieldErrors,
  extractApiFieldErrors,
  labelFieldErrors,
} from "@/lib/client/forms/api-field-errors";
import { DS_11_SCHEMA } from "@/lib/client/forms/ds-11-schema";
import { downloadStampedFormAsImages } from "@/lib/client/forms/download-form-images";
import {
  bindDs11DraftToDocument,
  getDs11BoundDocumentId,
  markDs11SessionFinalized,
} from "@/components/sections/forms/Ds11AutoPersist";
import { ds11LibraryFilename } from "@/components/sections/forms/Ds11EditorBootstrap";
import {
  stampDs11Document,
  stampDs11Preview,
} from "@/lib/client/forms/stamp-ds11-client";
import { validateDs11 } from "@/lib/client/forms/validate-ds-11";
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

async function triggerDownload(downloadUrl: string, filename = "ds-11.pdf") {
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

async function findDs11LibraryDocumentId(
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

async function buildDs11PaywallPreviewUrl(
  values: Record<string, string>,
): Promise<string | null> {
  try {
    const bytes = await stampDs11Preview(values);
    const blob = new Blob([bytes.buffer as ArrayBuffer], {
      type: "application/pdf",
    });

    return URL.createObjectURL(blob);
  } catch (err) {
    logger.captureError(err, "ds-11.paywall_preview_generate");

    return null;
  }
}

export function Ds11FinalizeIntercept() {
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
          redirectUrl: `${ROUTES.FORMS.DS11_EDIT}?export=${targetExt}&filename=${encodeURIComponent(targetFilename)}`,
          title: "Download your passport application",
          subtitle:
            "Create an account or sign in to download your completed Form DS-11.",
          submitLabel: "Download file",
        });

        return null;
      }

      const errors = validateDs11({ values });
      const errorIds = Object.keys(errors);

      const cacheKey = `${currentSessionId}::${JSON.stringify(values)}::${targetFilename}`;

      if (lastFinalizeRef.current?.key === cacheKey) {
        return lastFinalizeRef.current.downloadUrl;
      }

      const entitled = await ensureFreshEntitlement();

      if (!entitled) {
        const previewObjectUrl = await buildDs11PaywallPreviewUrl(values);

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

      if (errorIds.length > 0) {
        state.setErrors(errors);
        toast.error({
          title: "Check your application",
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

      const { downloadUrl } = await formsService.finalizeFormSession({
        sessionId: currentSessionId,
        values,
        signatureKey: null,
      });

      markDs11SessionFinalized();
      lastFinalizeRef.current = { key: cacheKey, downloadUrl };

      return downloadUrl;
    };

    const uploadToLibrary = async (
      blob: Blob,
      values: Record<string, string>,
    ): Promise<boolean> => {
      const { currentDocumentId } = usePdfEditorStore.getState();
      const filename = ds11LibraryFilename();
      let targetId = currentDocumentId ?? getDs11BoundDocumentId();

      if (!targetId) {
        try {
          targetId = await findDs11LibraryDocumentId(filename);
        } catch (lookupErr) {
          logger.captureError(lookupErr, "ds-11.library_lookup");

          return false;
        }
      }

      try {
        const stampedFile = new File([blob], filename, {
          type: "application/pdf",
        });
        const editorState = JSON.stringify({ v: 1, ds11: { values } });
        const upload = (documentId?: string) =>
          documentsService.uploadDocument({
            file: stampedFile,
            documentId,
            editorState,
          });
        const savedDoc = targetId
          ? await upload(targetId).catch(() => upload(undefined))
          : await upload(undefined);

        usePdfEditorStore.getState().setCurrentDocument({
          id: savedDoc.id,
          name: savedDoc.filename,
        });
        bindDs11DraftToDocument(savedDoc.id);

        try {
          queryClientRef.current.invalidateQueries({
            queryKey: documentKeys.lists(),
          });
        } catch {
          /* non-fatal */
        }

        return true;
      } catch (saveErr) {
        logger.captureError(saveErr, "ds-11.library_save");

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
            `Couldn't fetch the completed DS-11 (HTTP ${res.status}).`,
          );
        }

        return uploadToLibrary(await res.blob(), values);
      } catch (saveErr) {
        logger.captureError(saveErr, "ds-11.library_save_fetch");

        return false;
      }
    };

    const saveDraftToLibrary = async (
      values: Record<string, string>,
    ): Promise<boolean> => {
      try {
        const bytes = await stampDs11Document(values);
        const blob = new Blob([bytes.buffer as ArrayBuffer], {
          type: "application/pdf",
        });

        return uploadToLibrary(blob, values);
      } catch (stampErr) {
        logger.captureError(stampErr, "ds-11.draft_stamp");

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
          redirectUrl: ROUTES.FORMS.DS11_EDIT,
          title: "Save your passport application",
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
      const baseName = (detail?.filename ?? "Form-DS-11").replace(
        /\.[^./\\]+$/,
        "",
      );
      const targetFilename = `${baseName}.${requestedFormat}`;

      inFlightRef.current = true;

      const loadingKey = toast.loading({
        title: "Preparing your DS-11",
        description: "Stamping your answers onto the official form…",
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
            fallbackBaseName: "ds-11",
          });
        }

        const saved = await saveToLibrary(downloadUrl, values);

        toast.success({
          title: "DS-11 ready — do not sign it yet",
          description: saved
            ? "Downloaded and saved to My PDFs. Sign it only when the acceptance agent asks you to."
            : "Downloaded. We couldn't add it to My PDFs — try Save to retry.",
        });
      } catch (err) {
        toast.close(loadingKey);
        logger.captureError(err, "ds-11.finalize");

        const apiErrors = extractApiFieldErrors(err);

        if (apiErrors.length > 0) {
          const labelled = labelFieldErrors(apiErrors, DS_11_SCHEMA);

          useFormEditorStore.getState().setErrors(labelled);
          toast.error({
            title: "Check your application",
            description: describeFieldErrors(labelled),
          });

          const firstEl = document.getElementById(
            `field-input-${apiErrors[0]!.field}`,
          );

          firstEl?.scrollIntoView({ block: "center", behavior: "smooth" });
          (firstEl as HTMLInputElement | null)?.focus?.();
        } else {
          toast.error({
            title: "Finalization failed",
            description:
              err instanceof Error
                ? err.message
                : "Could not finalize the form. Please try again.",
          });
        }
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
        title: "Saving your application",
        description: "Adding your answers to My PDFs…",
      });

      try {
        const saved = await saveDraftToLibrary(values);

        toast.close(saveLoadingKey);

        if (saved) {
          toast.success({
            title: "Saved",
            description: "Your DS-11 is in My PDFs.",
          });
        } else {
          toast.error({
            title: "Save failed",
            description: "We couldn't add it to My PDFs. Please try again.",
          });
        }
      } catch (err) {
        toast.close(saveLoadingKey);
        logger.captureError(err, "ds-11.save");
        toast.error({
          title: "Save failed",
          description: "Could not save your progress.",
        });
      } finally {
        inFlightRef.current = false;
      }
    };

    // Navigating away never writes a library row, matching the W-9 and
    // the 1099-NEC. Answers the caller so navigation does not stall on its
    // 30s timeout.
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
