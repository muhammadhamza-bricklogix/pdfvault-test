"use client";

import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

import { dispatchEmailFirstModal } from "@/components/shared/email-first-modal";
import { invalidateLibraryIndex } from "@/lib/client/documents/library-filename-index";
import { resolveFilenameConflict } from "@/lib/client/documents/resolve-filename-conflict";
import { isDuplicatePromptOpen } from "@/lib/client/hooks/documents/duplicate-prompt-bus";
import {
  describeFieldErrors,
  extractApiFieldErrors,
  labelFieldErrors,
} from "@/lib/client/forms/api-field-errors";
import { NEC_1099_SCHEMA } from "@/lib/client/forms/1099-nec-schema";
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

/**
 * Real user input, ignoring `calendar_year` — the bootstrap seeds it on
 * every open, so counting it meant a completely blank form armed the
 * autosave and popped the filename dialog before the user typed anything.
 */
function hasUserInput(values: Record<string, string>): boolean {
  return Object.entries(values ?? {}).some(
    ([key, v]) =>
      key !== "calendar_year" && typeof v === "string" && v.trim() !== "",
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

      // A partially-filled 1099-NEC is downloadable, matching the W-9:
      // users explicitly asked to be able to take away whatever they have
      // so far. Client-side validation therefore no longer BLOCKS — the
      // server filler still validates, and `finalizeOrStampLocally` below
      // falls back to the local stamper when it refuses.
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

      // The server filler rejects an incomplete form (422). That is the
      // right guard for an official filing, but it must not stop the user
      // taking away a draft — so stamp it locally instead, exactly as the
      // W-9 does with `stampW9Client`. The local stamper fills all four
      // copies and flattens, so the file is the same shape either way.
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
        logger.captureError(finalizeErr, "1099-nec.finalize_fallback_local");

        const bytes = await stampNecDocument(values);
        const blobUrl = URL.createObjectURL(
          new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" }),
        );

        setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);

        return blobUrl;
      }

      markNecSessionFinalized();
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
      // The remembered row id is the stable identity that stops a reload
      // silently creating a second row. Read lazily: if another save is
      // mid-prompt, it may create the row while we wait, and we should then
      // update that row rather than ask again.
      const resolution = await resolveFilenameConflict({
        filename: necLibraryFilename(),
        getOwnedDocumentId: () =>
          usePdfEditorStore.getState().currentDocumentId ??
          getNecBoundDocumentId(),
      });

      if (resolution.kind === "cancel") return "cancelled";

      const filename = resolution.filename;
      const targetId =
        resolution.kind === "replace" ? resolution.documentId : undefined;

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
        logger.captureError(saveErr, "1099-nec.library_save");

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
            `Couldn't fetch the stamped 1099-NEC (HTTP ${res.status}).`,
          );
        }

        return uploadToLibrary(await res.blob(), values);
      } catch (saveErr) {
        logger.captureError(saveErr, "1099-nec.library_save_fetch");

        return "failed";
      }
    };

    const saveDraftToLibrary = async (
      values: Record<string, string>,
    ): Promise<SaveOutcome> => {
      try {
        const bytes = await stampNecDocument(values);
        const blob = new Blob([bytes.buffer as ArrayBuffer], {
          type: "application/pdf",
        });

        return uploadToLibrary(blob, values);
      } catch (stampErr) {
        logger.captureError(stampErr, "1099-nec.draft_stamp");

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

    // Reached from the F5 / Ctrl+R reload prompt ("Save & reload"). It used
    // to answer OK without saving, so that button silently reloaded and lost
    // the work it promised to keep. Saves for real now, surfacing the
    // Replace / Save-as-new prompt when the name is taken.
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
          logger.captureError(err, "1099-nec.save_before_action");
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
          description:
            saved === "saved"
              ? "Downloaded and saved to My PDFs."
              : saved === "cancelled"
                ? "Downloaded. Not added to My PDFs — you cancelled the name prompt."
                : "Downloaded. We couldn't add it to My PDFs — try Save to retry.",
        });
      } catch (err) {
        toast.close(loadingKey);
        logger.captureError(err, "1099-nec.finalize");

        const apiErrors = extractApiFieldErrors(err);

        if (apiErrors.length > 0) {
          const labelled = labelFieldErrors(apiErrors, NEC_1099_SCHEMA);

          useFormEditorStore.getState().setErrors(labelled);
          toast.error({
            title: "Check your 1099-NEC",
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

    // Autosave loop guards. `inFlight` keeps overlapping saves out;
    // `suppressed` latches when the user cancels the filename prompt, so
    // the next debounce does not re-open it every few seconds. An explicit
    // Save or Download clears it — that is the user asking deliberately.
    let autosaveInFlight = false;
    let autosaveSuppressed = false;

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
        title: "Saving your 1099-NEC",
        description: "Updating your form in My PDFs…",
      });

      try {
        const saved = await saveDraftToLibrary(values);

        toast.close(saveLoadingKey);

        if (saved === "saved") {
          toast.success({
            title: "Saved",
            description: "Your 1099-NEC in My PDFs is up to date.",
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
    // Autosave: write the form to My PDFs shortly after typing stops.
    //
    // Two guards stop this becoming a popup loop. `inFlight` keeps
    // overlapping saves out, and `suppressed` latches when the user
    // cancels the filename prompt — otherwise the next debounce would
    // re-open it every few seconds. An explicit Save or Download clears
    // the latch, because that is the user asking again deliberately.
    const onAutosave = (event: Event) => {
      event.stopImmediatePropagation();

      if (autosaveInFlight || autosaveSuppressed) return;
      if (!isLoadedRef.current || !isSignedInRef.current) return;
      // Never stack a second prompt on an open one.
      if (isDuplicatePromptOpen()) return;

      const values = useFormEditorStore.getState().values;

      if (!hasUserInput(values)) return;

      autosaveInFlight = true;
      void (async () => {
        try {
          const saved = await saveDraftToLibrary(values);

          // Only a deliberate cancel latches. A transient failure should
          // be retried on the next burst of typing.
          if (saved === "cancelled") autosaveSuppressed = true;
        } catch (err) {
          logger.captureError(err, "1099-nec.autosave");
        } finally {
          autosaveInFlight = false;
        }
      })();
    };

    // Back / logo persists the partial form before leaving. Uses the
    // client stamper (no finalize, no paywall) so simply navigating away
    // never asks anyone to pay, and surfaces the Replace / Save-as-new
    // prompt through uploadToLibrary when the name is already taken.
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
          logger.captureError(err, "1099-nec.save_and_continue");
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
      window.removeEventListener(AUTOSAVE_EVENT, onAutosave, true);
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
