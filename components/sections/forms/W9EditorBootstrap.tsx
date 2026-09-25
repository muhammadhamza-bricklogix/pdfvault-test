"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { EditorLoadingShell } from "@/components/sections/pdf-editor/EditorLoadingShell";
import { W9_LIBRARY_FILENAME } from "@/components/sections/forms/W9FinalizeIntercept";
import { readPendingW9State } from "@/lib/client/forms/pending-w9-values";
import { findDuplicateByFilename } from "@/lib/client/hooks/upload/use-upload-with-duplicate-check";
import { documentsService } from "@/lib/shared/api/services/documents.service";
import { formsService } from "@/lib/shared/api/services/forms.service";
import { useFormEditorStore, usePdfEditorStore } from "@/lib/client/stores";
import { ROUTES } from "@/lib/shared/constants/routes";
import { logger } from "@/lib/shared/utils/logger";

type W9EditorBootstrapProps = {
  children: React.ReactNode;
};

/**
 * Preloads the blank IRS W-9 template into the shared pdf-composer
 * store so `<PdfEditorShell />` can be reused for the W-9 route, and
 * bootstraps the form-editor session (`POST /form-templates/w-9/start`)
 * so form-fill overlays needing `sessionId` (SignatureField, FinalizeModal)
 * can operate.
 *
 * Effect guards:
 *   - Do not include `useMutation` result objects here; TanStack Query
 *     returns a fresh object identity on every render, which would
 *     re-fire the effect and POST /start in an infinite loop until the
 *     backend rate-limiter kicks in with 429s (the exact bug reported
 *     2026-08-21). Same reason we call `formsService.startFormSession`
 *     directly instead of going through `useStartFormSessionMutation`.
 *   - `bootstrapRunIdRef` + `cancelled` — swallows results from stale
 *     in-flight work while still allowing React StrictMode's development
 *     setup → cleanup → setup cycle to run the second, active bootstrap.
 *     A previous one-shot "already bootstrapped" guard latched during
 *     the first StrictMode setup, then cleanup cancelled the template
 *     fetch; the second setup was skipped and first visits stayed stuck
 *     on "Loading your PDF…" until a reload served the PDF from cache.
 *
 * On unmount both stores are cleared so `/pdf-composer` doesn't
 * inherit the W-9 file and a subsequent `/w-9-form` visit fetches a
 * fresh session.
 */
export function W9EditorBootstrap({ children }: W9EditorBootstrapProps) {
  const setFile = usePdfEditorStore((s) => s.setFile);
  const currentFile = usePdfEditorStore((s) => s.file);
  const searchParams = useSearchParams();
  const resumeDocId = searchParams.get("resumeDocId");

  const bootstrapRunIdRef = useRef(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const runId = bootstrapRunIdRef.current + 1;

    bootstrapRunIdRef.current = runId;
    let cancelled = false;
    const isActiveRun = () => !cancelled && bootstrapRunIdRef.current === runId;

    // SYNC restore FIRST — before any async network work. Reads local
    // state (values + signature preview) and pushes it into the store
    // right away so the form paints with the user's previous entries
    // instead of an empty template for the ~1s of session/template
    // network round-trips. Without this, users perceive their data as
    // "wiped" every time they return to the route (QA 2026-08-29).
    // `hydrateFromSession` below preserves store values via its merge
    // (existing wins over session), so this early restore isn't
    // clobbered when the network call resolves.
    const earlyPending = readPendingW9State();

    if (earlyPending) {
      if (Object.keys(earlyPending.values).length > 0) {
        useFormEditorStore.getState().setValues(earlyPending.values);
      }
      if (earlyPending.signaturePreview) {
        useFormEditorStore
          .getState()
          .setSignaturePreview(earlyPending.signaturePreview);
      }
    }

    // Wipe any leftover file first so the drop-zone / previous PDF
    // doesn't flash before ours loads.
    usePdfEditorStore.getState().clearFile();
    // Take ownership of the save pipeline for this route. The pdf-composer
    // shell's generic Fabric-merge save (`useEditorNavigationSave`,
    // `useEditorAutoPersist`) would otherwise upload the blank W-9
    // template on navigation / pagehide → duplicate rows in My PDFs
    // (QA 2026-08-27). `W9FinalizeIntercept` handles Save via finalize.
    usePdfEditorStore.getState().setAutoPersistDisabled(true);

    // Parallel bootstrap: template fetch + form session. Neither
    // depends on the other so we don't want them serialized.
    const templatePromise = (async () => {
      await Promise.resolve();
      if (!isActiveRun()) return;

      const res = await fetch(ROUTES.STATIC.W9_BLANK_PDF, {
        cache: "force-cache",
      });

      if (!res.ok) {
        throw new Error(`Failed to load W-9 template (HTTP ${res.status})`);
      }
      const blob = await res.blob();

      if (!isActiveRun()) return;
      const file = new File([blob], "w-9.pdf", { type: "application/pdf" });

      setFile(file);
    })().catch((err: unknown) => {
      if (!isActiveRun()) return;
      logger.captureError(err, "w9.template_load");
      setError(
        err instanceof Error ? err.message : "Couldn't load the W-9 template.",
      );
    });

    const sessionPromise = (async () => {
      await Promise.resolve();
      if (!isActiveRun()) return;

      // Direct service call — bypasses `useStartFormSessionMutation`
      // because that hook's return object changes identity on every
      // render and would destabilize the effect deps if referenced.
      const session = await formsService.startFormSession({ formId: "w-9" });

      if (!isActiveRun()) return;
      useFormEditorStore.getState().hydrateFromSession(session);

      // Values + signature preview already restored synchronously at
      // the top of this effect (see `earlyPending` above). Still
      // PATCH the freshly-created backend session with the restored
      // values so the DB row for THIS user reflects the local state
      // even before the user types anything new. `hydrateFromSession`
      // already merged the store values (existing wins), so read from
      // the store rather than re-reading storage — captures anything
      // the user typed between mount and session resolution too.
      const restoredValues = useFormEditorStore.getState().values;

      if (Object.keys(restoredValues).length > 0) {
        formsService
          .patchFormSession(session.id, restoredValues)
          .catch(() => undefined);
      }
    })().catch((err: unknown) => {
      // Session failure is non-fatal — the pdf-composer editor still
      // works; only the SignatureField overlay + finalize flow degrade.
      logger.captureError(err, "w9.session_bootstrap");
    });

    // Resume flow — `?resumeDocId=<id>` is set by
    // `openDocumentInEditor` when the user clicks a saved W-9 in
    // Dashboard → My PDFs. Fetch the document metadata, parse the
    // `w9` marker from `editorState`, and restore the raw form
    // values so the yellow overlays paint with the user's previous
    // entries. Signature key is intentionally NOT restored: it
    // belongs to the old form session and the new session's S3
    // namespace rejects it. User re-signs on the resume flow.
    // Also seed `currentDocumentId` on the pdf-editor store so the
    // next Save upserts the same row (via `documentsService.uploadDocument`
    // in `W9FinalizeIntercept`) instead of creating a duplicate.
    // 2026-09-01 (QA): the W-9 must save into a SINGLE canonical row —
    // "IRS Form W-9.pdf" — regardless of how many times the user
    // opens/edits/saves. When the caller doesn't hand us an explicit
    // `?resumeDocId`, look for an existing IRS Form W-9.pdf in the
    // library. If one exists, adopt its id via `setCurrentDocument`
    // and rehydrate the last-saved values + signature preview from
    // its `editorState.w9` marker — same restore as the explicit
    // resume path, just triggered implicitly.
    const autoResumePromise = resumeDocId
      ? Promise.resolve()
      : (async () => {
          await Promise.resolve();
          if (!isActiveRun()) return;

          try {
            const existing = await findDuplicateByFilename(W9_LIBRARY_FILENAME);

            if (!isActiveRun() || !existing) return;

            const doc = await documentsService.getDocument(existing.id);

            if (!isActiveRun()) return;

            type ResumeEnvelope = {
              w9?: {
                values?: Record<string, string>;
                signaturePreview?: string | null;
              };
            };
            let parsed: ResumeEnvelope | null = null;

            if (doc.editorState) {
              try {
                parsed = JSON.parse(doc.editorState) as ResumeEnvelope;
              } catch {
                parsed = null;
              }
            }

            // Only adopt the row when the `editorState.w9` marker
            // is present — that's the signal it was written by the
            // W-9 flow, not an unrelated PDF a user happened to
            // name "IRS Form W-9.pdf". Without the marker, leave
            // the row alone; first save creates a fresh W-9 row
            // through the normal path.
            if (!parsed?.w9) return;

            usePdfEditorStore.getState().setCurrentDocument({
              id: doc.id,
              name: doc.filename,
            });

            if (parsed.w9.values && typeof parsed.w9.values === "object") {
              useFormEditorStore.getState().setValues(parsed.w9.values);
            }
            if (
              parsed.w9.signaturePreview &&
              typeof parsed.w9.signaturePreview === "string"
            ) {
              useFormEditorStore
                .getState()
                .setSignaturePreview(parsed.w9.signaturePreview);
            }
          } catch (err) {
            // Non-fatal — a flaky list call shouldn't block the
            // template opening. Fresh session still works; worst
            // case the first save creates a new row (which the
            // NEXT open will then find + adopt).
            logger.captureError(err, "w9.auto_resume_from_library");
          }
        })();

    const resumePromise = resumeDocId
      ? (async () => {
          await Promise.resolve();
          if (!isActiveRun()) return;

          try {
            const doc = await documentsService.getDocument(resumeDocId);

            if (!isActiveRun()) return;

            // Only claim ownership of this document row if it's really
            // a saved W-9 (has a `w9` marker in `editorState`). Without
            // this check a stray `?resumeDocId=<non-w9-id>` link could
            // cause the next Save to upsert a stamped W-9 on top of an
            // unrelated user document → silent data loss.
            type ResumeEnvelope = {
              w9?: {
                values?: Record<string, string>;
                signaturePreview?: string | null;
              };
            };
            let parsed: ResumeEnvelope | null = null;

            if (doc.editorState) {
              try {
                parsed = JSON.parse(doc.editorState) as ResumeEnvelope;
              } catch {
                parsed = null;
              }
            }

            if (!parsed?.w9) return;

            usePdfEditorStore.getState().setCurrentDocument({
              id: doc.id,
              name: doc.filename,
            });

            const values = parsed.w9.values;

            if (values && typeof values === "object") {
              // `sessionPromise` may still be in flight — the store
              // action merges into `values` so the order is safe
              // (each `setValues` spreads into the previous map).
              useFormEditorStore.getState().setValues(values);
            }

            // Restore the signature IMAGE (data URL) so the yellow
            // "Sign here" placeholder is replaced by the previously
            // drawn ink on reopen. Signature KEY is intentionally
            // still null — the fresh session's S3 namespace won't
            // accept the old key. If the user hits Done → Download
            // without re-signing, `W9FinalizeIntercept` re-uploads
            // this preview to the new session before finalizing.
            const signaturePreview = parsed.w9.signaturePreview;

            if (typeof signaturePreview === "string" && signaturePreview) {
              useFormEditorStore
                .getState()
                .setSignaturePreview(signaturePreview);
            }
          } catch (err) {
            logger.captureError(err, "w9.resume_from_dashboard");
          }
        })()
      : Promise.resolve();

    void Promise.all([
      templatePromise,
      sessionPromise,
      resumePromise,
      autoResumePromise,
    ]);

    return () => {
      cancelled = true;
      // Clear both stores on unmount so `/pdf-composer` doesn't inherit
      // the W-9 file and a subsequent `/w-9-form` visit gets a fresh
      // session (avoids replaying a stale sessionId on a new mount).
      usePdfEditorStore.getState().clearFile();
      usePdfEditorStore.getState().setAutoPersistDisabled(false);
      useFormEditorStore.getState().reset();
    };
  }, [setFile, resumeDocId]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-default-100 p-8">
        <div className="max-w-md rounded-2xl border border-danger-200 bg-white px-6 py-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-danger-700">
            Couldn&apos;t load the W-9
          </p>
          <p className="mt-2 text-sm text-default-600">{error}</p>
          <p className="mt-4 text-xs text-default-500">
            Refresh the page to try again.
          </p>
        </div>
      </div>
    );
  }

  // Only gate on the FILE being loaded. `pdfDocument` is produced by
  // `usePdfLoader` inside `<PdfEditorShell />` — gating this wrapper
  // on `pdfDocument` would create a chicken-and-egg deadlock (shell
  // never mounts → loader never runs → pdfDocument stays null → this
  // gate never opens). Once `file` lands, the shell renders its own
  // internal loading state until pdf.js finishes parsing, so the
  // transition is still smooth.
  if (!currentFile) {
    return <EditorLoadingShell />;
  }

  return <>{children}</>;
}
