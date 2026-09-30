"use client";

import { useAuth } from "@clerk/nextjs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { dispatchEmailFirstModal } from "@/components/shared/email-first-modal";
import { ensureFreshEntitlement } from "@/lib/client/hooks/billing/ensure-entitlement";
import { requestPaywall } from "@/lib/client/hooks/billing/paywall-bus";
import { formsService } from "@/lib/shared/api/services/forms.service";
import { useFormEditorStore } from "@/lib/client/stores";
import { ROUTES } from "@/lib/shared/constants/routes";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

const EXPORT_EVENT = "editor:export";
const SAVE_EVENT = "editor:save";
const SAVE_BEFORE_ACTION_EVENT = "editor:save-before-action";

type SaveBeforeActionDetail = {
  onComplete?: (result: { ok: boolean }) => void;
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

export function NecFinalizeIntercept() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const inFlightRef = useRef(false);
  const autoLaunchedRef = useRef(false);
  const sessionId = useFormEditorStore((s) => s.sessionId);

  // Auto-launch export if returning from auth redirect with ?export=
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
    const saveBeforeActionHandler = (event: Event) => {
      event.stopImmediatePropagation();
      const detail = (event as CustomEvent<SaveBeforeActionDetail>).detail;

      detail?.onComplete?.({ ok: true });
    };

    const onExport = async (e: Event) => {
      // Hijack the generic export flow so 1099-NEC routes through server finalize
      e.stopImmediatePropagation();
      e.preventDefault();

      if (inFlightRef.current) return;

      const detail = (e as CustomEvent<ExportDetail>).detail;
      const targetFilename = detail?.filename
        ? (detail.filename.endsWith(".pdf") ? detail.filename : `${detail.filename}.pdf`)
        : "Form-1099-NEC.pdf";

      const state = useFormEditorStore.getState();
      const currentSessionId = state.sessionId;
      const values = state.values;

      if (!currentSessionId) {
        toast.error({
          title: "Session not started",
          description: "Please reload the page to start a new form session.",
        });
        return;
      }

      if (!isLoaded) {
        toast.error({
          title: "Just a sec",
          description: "Signing you in — try Download again in a moment.",
        });
        return;
      }

      if (!isSignedIn) {
        dispatchEmailFirstModal({
          redirectUrl: `${ROUTES.FORMS.NEC_1099_EDIT}?export=pdf&filename=${encodeURIComponent(targetFilename)}`,
          title: "Download your 1099-NEC",
          subtitle: "Create an account or sign in to download your official Form 1099-NEC.",
          submitLabel: "Download file",
        });
        return;
      }

      state.setErrors({});
      inFlightRef.current = true;

      const loadingKey = toast.loading({
        title: "Preparing your 1099-NEC",
        description: "Stamping your values onto the template…",
      });

      try {
        const entitled = await ensureFreshEntitlement();

        if (!entitled) {
          const outcome = await requestPaywall({
            filename: targetFilename,
            sourceExt: "pdf",
            targetExt: "pdf",
          });

          if (outcome !== "success") {
            toast.close(loadingKey);
            return;
          }
        }

        const { downloadUrl } = await formsService.finalizeFormSession({
          sessionId: currentSessionId,
          values,
          signatureKey: null,
        });

        toast.close(loadingKey);
        await triggerDownload(downloadUrl, targetFilename);

        toast.success({
          title: "1099-NEC ready",
          description: "Your filled form has been generated and downloaded.",
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
      const { sessionId: currentSessionId, values } = useFormEditorStore.getState();
      if (!currentSessionId) return;

      inFlightRef.current = true;
      const saveLoadingKey = toast.loading({
        title: "Saving changes",
        description: "Updating your form progress…",
      });

      try {
        await formsService.patchFormSession(currentSessionId, values);
        toast.close(saveLoadingKey);
        toast.success({
          title: "Saved",
          description: "Your form progress has been saved.",
        });
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

    window.addEventListener(SAVE_BEFORE_ACTION_EVENT, saveBeforeActionHandler, true);
    window.addEventListener(EXPORT_EVENT, onExport, true);
    window.addEventListener(SAVE_EVENT, onSave, true);

    return () => {
      window.removeEventListener(SAVE_BEFORE_ACTION_EVENT, saveBeforeActionHandler, true);
      window.removeEventListener(EXPORT_EVENT, onExport, true);
      window.removeEventListener(SAVE_EVENT, onSave, true);
    };
  }, [isLoaded, isSignedIn]);

  return null;
}
