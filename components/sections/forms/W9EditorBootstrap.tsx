"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { EditorLoadingShell } from "@/components/sections/pdf-editor/EditorLoadingShell";
import {
  clearPendingW9Values,
  readPendingW9Values,
} from "@/lib/client/forms/pending-w9-values";
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
 *   - Empty deps `[]` — the effect must run exactly once per mount.
 *     Never include `useMutation` result objects here; TanStack Query
 *     returns a fresh object identity on every render, which would
 *     re-fire the effect and POST /start in an infinite loop until the
 *     backend rate-limiter kicks in with 429s (the exact bug reported
 *     2026-08-21). Same reason we call `formsService.startFormSession`
 *     directly instead of going through `useStartFormSessionMutation`.
 *   - `hasBootstrappedRef` — module-level dedupe for the StrictMode
 *     dev double-invoke. We do NOT reset it in cleanup; a genuine
 *     unmount + remount still creates a new component instance with a
 *     fresh ref, so refetch behaviour is unchanged.
 *   - `cancelled` — swallows results from a still-in-flight fetch
 *     when the component has unmounted before the network completed.
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

  const hasBootstrappedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasBootstrappedRef.current) return;
    hasBootstrappedRef.current = true;

    let cancelled = false;

    // Wipe any leftover file first so the drop-zone / previous PDF
    // doesn't flash before ours loads.
    usePdfEditorStore.getState().clearFile();

    // Parallel bootstrap: template fetch + form session. Neither
    // depends on the other so we don't want them serialized.
    const templatePromise = (async () => {
      const res = await fetch(ROUTES.STATIC.W9_BLANK_PDF, {
        cache: "force-cache",
      });

      if (!res.ok) {
        throw new Error(`Failed to load W-9 template (HTTP ${res.status})`);
      }
      const blob = await res.blob();

      if (cancelled) return;
      const file = new File([blob], "w-9.pdf", { type: "application/pdf" });

      setFile(file);
    })().catch((err: unknown) => {
      if (cancelled) return;
      logger.captureError(err, "w9.template_load");
      setError(
        err instanceof Error ? err.message : "Couldn't load the W-9 template.",
      );
    });

    const sessionPromise = (async () => {
      // Direct service call — bypasses `useStartFormSessionMutation`
      // because that hook's return object changes identity on every
      // render and would destabilize the effect deps if referenced.
      const session = await formsService.startFormSession({ formId: "w-9" });

      if (cancelled) return;
      useFormEditorStore.getState().hydrateFromSession(session);

      // Restore any values the user typed BEFORE a sign-in redirect
      // (W9FinalizeIntercept persists them to sessionStorage when it
      // dispatches the sign-in prompt so a paywalled download doesn't
      // lose the whole form). Signature is intentionally not restored
      // — the fresh session's S3 namespace rejects the previous key.
      const pending = readPendingW9Values();

      if (pending) {
        useFormEditorStore.getState().setValues(pending);
        clearPendingW9Values();
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
    const resumePromise = resumeDocId
      ? (async () => {
          try {
            const doc = await documentsService.getDocument(resumeDocId);

            if (cancelled) return;
            usePdfEditorStore.getState().setCurrentDocument({
              id: doc.id,
              name: doc.filename,
            });

            if (!doc.editorState) return;
            const parsed = JSON.parse(doc.editorState) as {
              w9?: { values?: Record<string, string> };
            };
            const values = parsed?.w9?.values;

            if (values && typeof values === "object") {
              // `sessionPromise` may still be in flight — the store
              // action merges into `values` so the order is safe
              // (each `setValues` spreads into the previous map).
              useFormEditorStore.getState().setValues(values);
            }
          } catch (err) {
            logger.captureError(err, "w9.resume_from_dashboard");
          }
        })()
      : Promise.resolve();

    void Promise.all([templatePromise, sessionPromise, resumePromise]);

    return () => {
      cancelled = true;
      // Clear both stores on unmount so `/pdf-composer` doesn't inherit
      // the W-9 file and a subsequent `/w-9-form` visit gets a fresh
      // session (avoids replaying a stale sessionId on a new mount).
      usePdfEditorStore.getState().clearFile();
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
