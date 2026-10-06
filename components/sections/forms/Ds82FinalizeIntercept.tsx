"use client";

import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

import { dispatchEmailFirstModal } from "@/components/shared/email-first-modal";
import { invalidateLibraryIndex } from "@/lib/client/documents/library-filename-index";
import { resolveFilenameConflict } from "@/lib/client/documents/resolve-filename-conflict";
import { isDuplicatePromptOpen } from "@/lib/client/hooks/documents/duplicate-prompt-bus";
import { downloadStampedFormAsImages } from "@/lib/client/forms/download-form-images";
import {
  bindDs82DraftToDocument,
  getDs82BoundDocumentId,
  markDs82SessionFinalized,
} from "@/components/sections/forms/Ds82AutoPersist";
import { ds82LibraryFilename } from "@/components/sections/forms/Ds82EditorBootstrap";
import {
  stampDs82Document,
  stampDs82Preview,
} from "@/lib/client/forms/stamp-ds82-client";
import { ensureFreshEntitlement } from "@/lib/client/hooks/billing/ensure-entitlement";
import { AUTH_RETURN_PARAM } from "@/lib/client/auth/auto-signup";
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
const AUTOSAVE_EVENT = "editor:form-autosave";

type SaveOutcome = "saved" | "cancelled" | "failed";

type SaveBeforeActionDetail = {
  onComplete?: (result: { ok: boolean }) => void;
};

type SaveAndContinueDetail = {
  onComplete: (result: {
    ok: boolean;
    reason?:
      | "error"
      | "not-signed-in"
      | "cancelled"
      | "cancelled-duplicate"
      | "not-ready";
  }) => void;
};

type ExportDetail = {
  filename?: string;
  format?: string;
};

async function triggerDownload(downloadUrl: string, filename = "ds-82.pdf") {
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

/**
 * Anything typed is real user input: unlike the 1099-NEC, whose bootstrap
 * seeds `calendar_year` on every open, the DS-82 bootstrap seeds nothing. So
 * this doubles as the autosave's "is the form still blank?" guard and no
 * NEC-style `hasUserInput` variant is needed.
 */
function hasAnyValue(values: Record<string, string>): boolean {
  return Object.values(values ?? {}).some(
    (v) => typeof v === "string" && v.trim() !== "",
  );
}

async function buildDs82PaywallPreviewUrl(
  values: Record<string, string>,
): Promise<string | null> {
  try {
    const bytes = await stampDs82Preview(values);
    const blob = new Blob([bytes.buffer as ArrayBuffer], {
      type: "application/pdf",
    });

    return URL.createObjectURL(blob);
  } catch (err) {
    logger.captureError(err, "ds-82.paywall_preview_generate");

    return null;
  }
}

export function Ds82FinalizeIntercept() {
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

    let fired = false;
    const timeoutId = window.setTimeout(() => {
      fired = true;
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
      cleaned.delete(AUTH_RETURN_PARAM);
      const nextQuery = cleaned.toString();

      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
    }, 400);

    // Re-arm if a dependency change cancels the launch before it fires.
    return () => {
      window.clearTimeout(timeoutId);
      if (!fired) autoLaunchedRef.current = false;
    };
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
          redirectUrl: `${ROUTES.FORMS.DS82_EDIT}?export=${targetExt}&filename=${encodeURIComponent(targetFilename)}`,
          title: "Download your passport application",
          subtitle:
            "Create an account or sign in to download your completed Form DS-82.",
          submitLabel: "Download file",
        });

        return null;
      }

      const cacheKey = `${currentSessionId}::${JSON.stringify(values)}::${targetFilename}`;

      if (lastFinalizeRef.current?.key === cacheKey) {
        return lastFinalizeRef.current.downloadUrl;
      }

      // A partially-filled DS-82 is downloadable, matching the W-9 and the
      // 1099-NEC: an application is gathered over several sittings, and users
      // explicitly asked to be able to take away whatever they have so far.
      // `validateDs82` therefore no longer BLOCKS here — the server filler
      // still validates, and the local-stamp fallback below covers the form
      // it refuses.
      state.setErrors({});

      const entitled = await ensureFreshEntitlement();

      if (!entitled) {
        const previewObjectUrl = await buildDs82PaywallPreviewUrl(values);

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

      // The server filler rejects an incomplete application (422). That is
      // the right guard for a document an acceptance agent will read, but it
      // must not stop the user taking away a draft — so stamp it locally
      // instead, exactly as the 1099-NEC does. `stampDs82Document` already
      // flattens, so the partial file is just as non-editable as a finalized
      // one.
      // Blob URLs are not cached: re-stamping is local and cheap, and a
      // cached URL would outlive its revoke.
      let downloadUrl: string;

      try {
        ({ downloadUrl } = await formsService.finalizeFormSession({
          sessionId: currentSessionId,
          values,
          signatureKey: null,
        }));
      } catch (finalizeErr) {
        logger.captureError(finalizeErr, "ds-82.finalize_fallback_local");

        const bytes = await stampDs82Document(values);
        const blobUrl = URL.createObjectURL(
          new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" }),
        );

        setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);

        return blobUrl;
      }

      markDs82SessionFinalized();
      lastFinalizeRef.current = { key: cacheKey, downloadUrl };

      return downloadUrl;
    };

    /**
     * Saves run one at a time.
     *
     * Without this, clicking the logo while an autosave is still uploading
     * starts a second save that cannot yet see the row the first one is
     * creating — so it asks about the filename all over again. Queueing
     * means the second save observes `currentDocumentId` and simply
     * updates that row.
     */
    let saveQueue: Promise<unknown> = Promise.resolve();

    /**
     * "cancelled" is the user declining the filename prompt, which must not
     * be reported as a failure — nothing is wrong and nothing was lost.
     */
    const uploadToLibrary = (
      blob: Blob,
      values: Record<string, string>,
    ): Promise<SaveOutcome> => {
      const run = saveQueue
        .catch(() => undefined)
        .then(() => uploadToLibraryNow(blob, values));

      saveQueue = run.catch(() => undefined);

      return run;
    };

    const uploadToLibraryNow = async (
      blob: Blob,
      values: Record<string, string>,
    ): Promise<SaveOutcome> => {
      // The filename is resolved HERE, inside the queued work, never in the
      // caller. A save queued behind an open prompt would otherwise carry
      // the name it read before the prompt, and the backend would rename the
      // row the first save had just created straight back — the bug we hit
      // on the W-9.
      //
      // The remembered row id is the stable identity that stops a reload
      // silently creating a second row. Read lazily: if another save is
      // mid-prompt, it may create the row while we wait, and we should then
      // update that row rather than ask again.
      const resolution = await resolveFilenameConflict({
        filename: ds82LibraryFilename(),
        getOwnedDocumentId: () =>
          usePdfEditorStore.getState().currentDocumentId ??
          getDs82BoundDocumentId(),
      });

      if (resolution.kind === "cancel") return "cancelled";

      const filename = resolution.filename;
      const targetId =
        resolution.kind === "replace" ? resolution.documentId : undefined;

      try {
        const stampedFile = new File([blob], filename, {
          type: "application/pdf",
        });
        const editorState = JSON.stringify({ v: 1, ds82: { values } });
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
        bindDs82DraftToDocument(savedDoc.id);
        invalidateLibraryIndex();

        try {
          queryClientRef.current.invalidateQueries({
            queryKey: documentKeys.lists(),
          });
        } catch {
          /* non-fatal */
        }

        return "saved";
      } catch (saveErr) {
        logger.captureError(saveErr, "ds-82.library_save");

        return "failed";
      }
    };

    const saveToLibrary = async (
      downloadUrl: string,
      values: Record<string, string>,
    ): Promise<SaveOutcome> => {
      try {
        const res = await fetch(downloadUrl);

        if (!res.ok) {
          throw new Error(
            `Couldn't fetch the completed DS-82 (HTTP ${res.status}).`,
          );
        }

        return uploadToLibrary(await res.blob(), values);
      } catch (saveErr) {
        logger.captureError(saveErr, "ds-82.library_save_fetch");

        return "failed";
      }
    };

    const saveDraftToLibrary = async (
      values: Record<string, string>,
    ): Promise<SaveOutcome> => {
      try {
        const bytes = await stampDs82Document(values);
        const blob = new Blob([bytes.buffer as ArrayBuffer], {
          type: "application/pdf",
        });

        return uploadToLibrary(blob, values);
      } catch (stampErr) {
        logger.captureError(stampErr, "ds-82.draft_stamp");

        return "failed";
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
          redirectUrl: ROUTES.FORMS.DS82_EDIT,
          title: "Save your passport application",
          subtitle:
            "Create an account or sign in to keep this form in My PDFs.",
          submitLabel: "Save form",
        });

        return false;
      }

      return true;
    };

    // Autosave loop guards. `inFlight` keeps overlapping saves out;
    // `suppressed` latches when the user cancels the filename prompt, so
    // the next debounce does not re-open it every few seconds. An explicit
    // Save or Download clears it — that is the user asking deliberately.
    let autosaveInFlight = false;
    let autosaveSuppressed = false;

    // Reached from the F5 / Ctrl+R reload prompt ("Save & reload"). It used
    // to answer OK without saving, so that button silently reloaded and lost
    // the work it promised to keep — on a DS-82 that is an evening of
    // transcribing names, dates and parents' details. Saves for real now,
    // surfacing the Replace / Save-as-new prompt when the name is taken.
    const saveBeforeActionHandler = (event: Event) => {
      event.stopImmediatePropagation();
      const detail = (event as CustomEvent<SaveBeforeActionDetail>).detail;

      void (async () => {
        const values = useFormEditorStore.getState().values;

        if (
          !hasAnyValue(values) ||
          !isLoadedRef.current ||
          !isSignedInRef.current
        ) {
          detail?.onComplete?.({ ok: true });

          return;
        }

        try {
          const saved = await saveDraftToLibrary(values);

          // A cancel must not block the action the user asked for — their
          // work stays in the local draft either way.
          detail?.onComplete?.({ ok: saved !== "failed" });
        } catch (err) {
          logger.captureError(err, "ds-82.save_before_action");
          detail?.onComplete?.({ ok: false });
        }
      })();
    };

    const onExport = async (e: Event) => {
      autosaveSuppressed = false;
      e.stopImmediatePropagation();
      e.preventDefault();

      if (inFlightRef.current) return;

      const detail = (e as CustomEvent<ExportDetail>).detail;
      const requestedFormat =
        detail?.format === "png" || detail?.format === "jpg"
          ? detail.format
          : "pdf";
      const baseName = (detail?.filename ?? "Form-DS-82").replace(
        /\.[^./\\]+$/,
        "",
      );
      const targetFilename = `${baseName}.${requestedFormat}`;

      inFlightRef.current = true;

      const loadingKey = toast.loading({
        title: "Preparing your DS-82",
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
            fallbackBaseName: "ds-82",
          });
        }

        const saved = await saveToLibrary(downloadUrl, values);

        toast.success({
          title: "DS-82 ready — do not sign it yet",
          description:
            saved === "saved"
              ? "Downloaded and saved to My PDFs. Sign it only when the acceptance agent asks you to."
              : saved === "cancelled"
                ? "Downloaded. Not added to My PDFs — you cancelled the name prompt. Sign it only when the acceptance agent asks you to."
                : "Downloaded. We couldn't add it to My PDFs — try Save to retry.",
        });
      } catch (err) {
        toast.close(loadingKey);
        logger.captureError(err, "ds-82.finalize");
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
      autosaveSuppressed = false;
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

        if (saved === "saved") {
          toast.success({
            title: "Saved",
            description: "Your DS-82 in My PDFs is up to date.",
          });
        } else if (saved === "cancelled") {
          // Not an error — the user declined the name prompt. Their work is
          // still here and still in the local draft.
          toast.info({
            title: "Not saved",
            description: "Choose Replace or a new name to save it to My PDFs.",
          });
        } else {
          toast.error({
            title: "Save failed",
            description: "We couldn't add it to My PDFs. Please try again.",
          });
        }
      } catch (err) {
        toast.close(saveLoadingKey);
        logger.captureError(err, "ds-82.save");
        toast.error({
          title: "Save failed",
          description: "Could not save your progress.",
        });
      } finally {
        inFlightRef.current = false;
      }
    };

    // Autosave: write the application to My PDFs shortly after typing stops.
    // No paywall gate and no finalize — this is the user's own draft, stamped
    // locally, so keeping it safe never costs them anything.
    const onAutosave = (event: Event) => {
      event.stopImmediatePropagation();

      if (autosaveInFlight || autosaveSuppressed) return;
      if (!isLoadedRef.current || !isSignedInRef.current) return;
      // Never stack a second prompt on an open one.
      if (isDuplicatePromptOpen()) return;

      const values = useFormEditorStore.getState().values;

      if (!hasAnyValue(values)) return;

      autosaveInFlight = true;
      void (async () => {
        try {
          const saved = await saveDraftToLibrary(values);

          // Only a deliberate cancel latches. A transient failure should
          // be retried on the next burst of typing.
          if (saved === "cancelled") autosaveSuppressed = true;
        } catch (err) {
          logger.captureError(err, "ds-82.autosave");
        } finally {
          autosaveInFlight = false;
        }
      })();
    };

    // Back / logo persists the partial application before leaving. Uses the
    // client stamper (no finalize, no paywall) so simply navigating away
    // never asks anyone to pay, and surfaces the Replace / Save-as-new
    // prompt through uploadToLibrary when the name is already taken.
    // `cancelled-duplicate` is what keeps the user on the page: the
    // navigation hook reads it as "declined, stay put" rather than an error.
    const onSaveAndContinue = (event: Event) => {
      event.stopImmediatePropagation();
      const detail = (event as CustomEvent<SaveAndContinueDetail>).detail;

      void (async () => {
        const values = useFormEditorStore.getState().values;

        if (!hasAnyValue(values)) {
          detail?.onComplete?.({ ok: true, reason: "not-ready" });

          return;
        }
        if (!isLoadedRef.current || !isSignedInRef.current) {
          // Never open the sign-in modal from a navigation — the user is
          // on their way out, and the local draft already survives.
          detail?.onComplete?.({ ok: true, reason: "not-signed-in" });

          return;
        }

        try {
          const saved = await saveDraftToLibrary(values);

          detail?.onComplete?.(
            saved === "saved"
              ? { ok: true }
              : saved === "cancelled"
                ? { ok: false, reason: "cancelled-duplicate" }
                : { ok: false, reason: "error" },
          );
        } catch (err) {
          logger.captureError(err, "ds-82.save_and_continue");
          detail?.onComplete?.({ ok: false, reason: "error" });
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
    window.addEventListener(AUTOSAVE_EVENT, onAutosave, true);

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
      window.removeEventListener(AUTOSAVE_EVENT, onAutosave, true);
    };
  }, []);

  return null;
}
