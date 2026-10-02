"use client";

import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { dispatchEmailFirstModal } from "@/components/shared/email-first-modal";
import { markNecSessionFinalized } from "@/components/sections/forms/NecAutoPersist";
import { NEC_LIBRARY_FILENAME } from "@/components/sections/forms/NecEditorBootstrap";
import { stampNecPreview } from "@/lib/client/forms/stamp-nec-client";
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
    }, 400);

    const cleaned = new URLSearchParams(searchParams.toString());

    cleaned.delete("export");
    cleaned.delete("filename");
    const nextQuery = cleaned.toString();

    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);

    return () => window.clearTimeout(timeoutId);
  }, [isLoaded, isSignedIn, sessionId, searchParams, pathname, router]);

  useEffect(() => {
    const finalizeGated = async (
      targetFilename: string,
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

      if (!isLoaded) {
        toast.error({
          title: "Just a sec",
          description: "Signing you in — try Download again in a moment.",
        });

        return null;
      }

      if (!isSignedIn) {
        dispatchEmailFirstModal({
          redirectUrl: `${ROUTES.FORMS.NEC_1099_EDIT}?export=pdf&filename=${encodeURIComponent(targetFilename)}`,
          title: "Download your 1099-NEC",
          subtitle:
            "Create an account or sign in to download your official Form 1099-NEC.",
          submitLabel: "Download file",
        });

        return null;
      }

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

      const cacheKey = `${currentSessionId}::${JSON.stringify(values)}::${targetFilename}`;

      if (lastFinalizeRef.current?.key === cacheKey) {
        return lastFinalizeRef.current.downloadUrl;
      }

      const entitled = await ensureFreshEntitlement();

      if (!entitled) {
        const previewObjectUrl = await buildNecPaywallPreviewUrl(values);

        try {
          const outcome = await requestPaywall({
            filename: targetFilename,
            sourceExt: "pdf",
            targetExt: "pdf",
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

    const saveToLibrary = async (
      downloadUrl: string,
      values: Record<string, string>,
    ): Promise<boolean> => {
      const { currentDocumentId } = usePdfEditorStore.getState();

      try {
        const res = await fetch(downloadUrl);

        if (!res.ok) {
          throw new Error(
            `Couldn't fetch the stamped 1099-NEC (HTTP ${res.status}).`,
          );
        }
        const blob = await res.blob();
        const stampedFile = new File([blob], NEC_LIBRARY_FILENAME, {
          type: "application/pdf",
        });
        const editorState = JSON.stringify({ v: 1, nec: { values } });
        const savedDoc = await documentsService.uploadDocument({
          file: stampedFile,
          documentId: currentDocumentId ?? undefined,
          editorState,
        });

        usePdfEditorStore.getState().setCurrentDocument({
          id: savedDoc.id,
          name: savedDoc.filename,
        });

        try {
          queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
        } catch {
          /* non-fatal */
        }

        return true;
      } catch (saveErr) {
        logger.captureError(saveErr, "1099-nec.library_save");

        return false;
      }
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
      const targetFilename = detail?.filename
        ? detail.filename.endsWith(".pdf")
          ? detail.filename
          : `${detail.filename}.pdf`
        : "Form-1099-NEC.pdf";

      inFlightRef.current = true;

      const loadingKey = toast.loading({
        title: "Preparing your 1099-NEC",
        description: "Stamping your values onto the template…",
      });

      try {
        const values = useFormEditorStore.getState().values;
        const downloadUrl = await finalizeGated(targetFilename);

        if (!downloadUrl) {
          toast.close(loadingKey);

          return;
        }

        toast.close(loadingKey);
        await triggerDownload(downloadUrl, targetFilename);
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

      inFlightRef.current = true;
      const saveLoadingKey = toast.loading({
        title: "Saving your 1099-NEC",
        description: "Adding your entries to My PDFs…",
      });

      try {
        const downloadUrl = await finalizeGated(NEC_LIBRARY_FILENAME);

        if (!downloadUrl) {
          toast.close(saveLoadingKey);

          return;
        }

        const saved = await saveToLibrary(downloadUrl, values);

        toast.close(saveLoadingKey);

        if (saved) {
          toast.success({
            title: "Saved",
            description: "Your 1099-NEC is in My PDFs.",
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

    const onSaveAndContinue = (event: Event) => {
      event.stopImmediatePropagation();
      const detail = (event as CustomEvent<SaveAndContinueDetail>).detail;

      if (!detail?.onComplete) return;

      const { sessionId: currentSessionId, values } =
        useFormEditorStore.getState();

      if (!currentSessionId) {
        detail.onComplete({ ok: true, reason: "not-ready" });

        return;
      }

      if (!isLoaded || !isSignedIn) {
        detail.onComplete({ ok: true, reason: "not-signed-in" });

        return;
      }

      if (!hasAnyValue(values)) {
        detail.onComplete({ ok: true, reason: "not-ready" });

        return;
      }

      void (async () => {
        try {
          const downloadUrl = await finalizeGated(NEC_LIBRARY_FILENAME);

          if (!downloadUrl) {
            detail.onComplete({ ok: false, reason: "cancelled" });

            return;
          }

          await saveToLibrary(downloadUrl, values);
          detail.onComplete({ ok: true });
        } catch (err) {
          logger.captureError(err, "1099-nec.save_and_continue");
          detail.onComplete({ ok: false, reason: "error" });
        }
      })();
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
  }, [isLoaded, isSignedIn, queryClient]);

  return null;
}
