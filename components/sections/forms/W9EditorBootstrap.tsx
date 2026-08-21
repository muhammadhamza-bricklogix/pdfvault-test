"use client";

import { useEffect, useRef, useState } from "react";

import { EditorLoadingShell } from "@/components/sections/pdf-editor/EditorLoadingShell";
import { useStartFormSessionMutation } from "@/lib/client/query/mutations/forms.mutation";
import { useFormEditorStore, usePdfEditorStore } from "@/lib/client/stores";
import { ROUTES } from "@/lib/shared/constants/routes";
import { logger } from "@/lib/shared/utils/logger";

type W9EditorBootstrapProps = {
  children: React.ReactNode;
};

/**
 * Preloads the blank IRS W-9 template into the shared pdf-composer
 * store so the standard `<PdfEditorShell />` can be reused for the
 * W-9 route. This lets the W-9 page inherit every tool + thumbnail
 * sidebar + top toolbar + save/download flow from pdf-composer, no
 * duplication of the editor UI.
 *
 * ALSO bootstraps a form-editor session (`POST /form-templates/w-9/start`)
 * so the form-fill overlays (SignatureField, FinalizeModal) that need a
 * `sessionId` in `useFormEditorStore` can operate — otherwise clicking
 * the signature field hits "No session yet — try again in a second".
 * Session bootstrap runs in parallel with the template fetch; it's not
 * gated on the PDF being loaded because the two are independent.
 *
 * Order of operations:
 *
 *   1. Mount → `usePdfEditorStore.clearFile()` so no leftover PDF from
 *      a prior pdf-composer visit briefly flashes before the W-9
 *      loads.
 *   2. In parallel: fetch the W-9 template blob + POST the
 *      form-editor session bootstrap.
 *   3. Wrap the template bytes in a `File` object and call
 *      `setFile()`. The shell's `usePdfLoader` picks it up and parses
 *      via pdf.js.
 *   4. `hydrateFromSession(session)` writes the session id + schema
 *      into `useFormEditorStore` so `SignatureModal.handleApply()` can
 *      upload the signature blob to the backend.
 *
 * On unmount we clear both stores so the next `/pdf-composer` visit
 * starts on the drop-zone (not on the W-9) and the next `/w-9-form`
 * visit fetches a fresh session.
 */
export function W9EditorBootstrap({ children }: W9EditorBootstrapProps) {
  const setFile = usePdfEditorStore((s) => s.setFile);
  const clearFile = usePdfEditorStore((s) => s.clearFile);
  const currentFile = usePdfEditorStore((s) => s.file);

  const hydrateFormSession = useFormEditorStore((s) => s.hydrateFromSession);
  const resetFormSession = useFormEditorStore((s) => s.reset);

  const startFormSession = useStartFormSessionMutation();

  // StrictMode double-invokes effects in dev; the guard refs stop us
  // from firing the fetch + session POST twice. `hasBootstrappedRef`
  // stays `true` for the whole mount lifecycle; we only reset it in
  // the cleanup so a genuine unmount → remount cycle refetches.
  const hasBootstrappedRef = useRef(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasBootstrappedRef.current) return;
    hasBootstrappedRef.current = true;

    let cancelled = false;

    // Wipe any leftover file first so the drop-zone / previous PDF
    // doesn't flash before ours loads.
    clearFile();

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
      const session = await startFormSession.mutateAsync({ formId: "w-9" });

      if (cancelled) return;
      hydrateFormSession(session);
    })().catch((err: unknown) => {
      // Session failure is non-fatal — the pdf-composer editor still
      // works; only the SignatureField overlay + finalize flow degrade.
      // Log for observability so we can spot backend cold-starts.
      logger.captureError(err, "w9.session_bootstrap");
    });

    void Promise.all([templatePromise, sessionPromise]);

    return () => {
      cancelled = true;
      hasBootstrappedRef.current = false;
      // Clear both stores on unmount so `/pdf-composer` doesn't inherit
      // the W-9 file and a subsequent `/w-9-form` visit gets a fresh
      // session (avoids replaying a stale sessionId on a new mount).
      clearFile();
      resetFormSession();
    };
  }, [
    clearFile,
    hydrateFormSession,
    resetFormSession,
    setFile,
    startFormSession,
  ]);

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
  // `usePdfLoader` which lives inside `<PdfEditorShell />` — gating
  // this wrapper on `pdfDocument` would create a chicken-and-egg
  // deadlock (shell never mounts → loader never runs → pdfDocument
  // stays null → this gate never opens). Once `file` lands, the shell
  // renders its own internal loading state until pdf.js finishes
  // parsing, so the transition is still smooth.
  if (!currentFile) {
    return <EditorLoadingShell />;
  }

  return <>{children}</>;
}
