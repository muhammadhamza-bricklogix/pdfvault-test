"use client";

import { useLayoutEffect } from "react";

import { formsService } from "@/lib/shared/api/services/forms.service";
import { useFormEditorStore } from "@/lib/client/stores";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

const EXPORT_EVENT = "editor:export";
const SAVE_BEFORE_ACTION_EVENT = "editor:save-before-action";

type SaveBeforeActionDetail = {
  onComplete?: (result: { ok: boolean }) => void;
};

/**
 * Intercepts pdf-composer's `editor:export` event on the W-9 route so
 * Download routes through the form-session finalize backend
 * (`POST /form-sessions/:id/finalize`) instead of pdf-composer's own
 * Fabric-merge export pipeline.
 *
 * Why:
 *   - Yellow form-field overlays write to `useFormEditorStore.values`
 *     (form-fill store), not to the pdf-composer Fabric canvas. So
 *     pdf-composer's export would ship a blank W-9.
 *   - The earlier "mirror values into Fabric objects" attempt caused
 *     visible duplication (both the yellow overlay text AND the Fabric
 *     text painted at slightly-off coordinates).
 *   - The form-session backend already knows how to stamp values +
 *     signature onto the W-9 template — that's what it was built for.
 *     Server-stamped PDF is byte-perfect; no client-side coordinate
 *     math to get wrong.
 *
 * Listener registration:
 *   - `useLayoutEffect` (not `useEffect`) so the listener registers
 *     during the commit phase, BEFORE pdf-composer's `useExportEditor`
 *     runs its own `useEffect` on the same event.
 *   - `{ capture: true }` for belt-and-braces phase ordering.
 *   - `event.stopImmediatePropagation()` inside the handler prevents
 *     pdf-composer's downstream listener from firing (would otherwise
 *     race a client-side Fabric export against our server finalize).
 *
 * Trade-off — this is documented and intentional:
 *   - On `/w-9-form`, ANY Fabric edits the user makes with pdf-composer
 *     tools (Add Text, Draw, Highlight, Sign tool, etc.) are NOT
 *     included in the downloaded PDF. Only the yellow-overlay form-fill
 *     values + the signature drop-zone signature are baked in.
 *   - If you need Fabric edits in the download too, we'd need a hybrid:
 *     server finalize + client Fabric merge. Not in this iteration.
 */
export function W9FinalizeIntercept() {
  useLayoutEffect(() => {
    const handler = (event: Event) => {
      // Prevent pdf-composer's `useExportEditor` from also running on
      // this event — server finalize is our source of truth here.
      event.stopImmediatePropagation();

      const { sessionId, values, signatureKey } = useFormEditorStore.getState();

      if (!sessionId) {
        toast.error({
          title: "Session not ready",
          description:
            "Give it a moment while we start your W-9 session, then try Download again.",
        });

        return;
      }

      const loadingKey = toast.loading({
        title: "Preparing your W-9",
        description: "Stamping your values onto the template…",
      });

      void (async () => {
        try {
          const { downloadUrl } = await formsService.finalizeFormSession({
            sessionId,
            values,
            signatureKey,
          });

          // Trigger a browser download from the server-returned URL.
          // `download` attribute suggests a filename; some CORS setups
          // ignore it and rely on Content-Disposition — either way the
          // user gets the PDF.
          const link = document.createElement("a");

          link.href = downloadUrl;
          link.download = "w-9.pdf";
          link.rel = "noopener";
          link.target = "_blank";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          toast.success({
            title: "W-9 ready",
            description: "Your filled PDF has downloaded.",
          });
        } catch (err) {
          logger.captureError(err, "w9.finalize");
          toast.error({
            title: "Couldn't generate the W-9",
            description:
              err instanceof Error
                ? err.message
                : "Please try again in a moment.",
          });
        } finally {
          toast.close(loadingKey);
        }
      })();
    };

    // `ExportFormatModal.handleDownload` dispatches
    // `editor:save-before-action` first and awaits `onComplete` before
    // firing the export event. For the W-9 route we don't want
    // pdf-composer's cloud save (would upload the blank template to
    // the user's library, and would prompt signed-out users to sign
    // in for no useful reason since finalize is what actually needs
    // to run). Resolve the save as a no-op success so the modal
    // proceeds to dispatch the export event our other handler catches.
    const saveHandler = (event: Event) => {
      event.stopImmediatePropagation();
      const detail = (event as CustomEvent<SaveBeforeActionDetail>).detail;

      detail?.onComplete?.({ ok: true });
    };

    window.addEventListener(SAVE_BEFORE_ACTION_EVENT, saveHandler, {
      capture: true,
    });
    window.addEventListener(EXPORT_EVENT, handler, { capture: true });

    return () => {
      window.removeEventListener(SAVE_BEFORE_ACTION_EVENT, saveHandler, {
        capture: true,
      });
      window.removeEventListener(EXPORT_EVENT, handler, { capture: true });
    };
  }, []);

  return null;
}
