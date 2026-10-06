"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { EditorLoadingShell } from "@/components/sections/pdf-editor/EditorLoadingShell";
import { W9_LIBRARY_FILENAME } from "@/components/sections/forms/W9FinalizeIntercept";
import {
  clearPendingW9Values,
  readPendingW9State,
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
  const forceNew = searchParams.get("new") === "1";

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
    // ?new=1 means the user deliberately asked for a blank form, so drop
    // the carried-over draft before restoring it. Without the param (a
    // reload, back/forward) the draft is kept, so an F5 never loses typing.
    // This is also the only thing that clears a draft holding a TIN short
    // of signing out.
    if (forceNew) clearPendingW9Values();

    // One-shot: a reload re-sends the same query, so strip ?new=1 now or
    // every refresh would wipe the draft we just started. Uses
    // history.replaceState, not router.replace, because forceNew is in this
    // effect's deps and a re-render would re-run the whole bootstrap.
    if (forceNew && typeof window !== "undefined") {
      const url = new URL(window.location.href);

      url.searchParams.delete("new");
      window.history.replaceState(null, "", url.pathname + url.search);
    }

    const earlyPending = forceNew ? null : readPendingW9State();

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
    // Opt out of the Select-tool auto-extract restored on 2026-09-16
    // (commit 9284eb9). W-9 users interact via `W9FormFieldsPortal`, not
    // by tapping source text, so the Fabric IText overlay adds no value
    // here — and any pixel-level mismatch between Fabric IText and
    // pdf.js's native paint of the pre-printed W-9 template reads as
    // visible glyph doubling (QA 2026-09-26: "the w9 form is regressed
    // and I am seeing the duplicated and overlapped text"). This flag
    // restores the pre-9284eb9 behaviour for W-9 only — pdf.js paints
    // the template natively, no Fabric IText overlay on load. The
    // Edit Text toolbar tool still triggers extraction on demand.
    // `/pdf-composer` and other routes are unaffected — the flag
    // defaults to false + resets on unmount.
    usePdfEditorStore.getState().setDisableAutoTextExtract(true);

    // Fetched ONCE and shared: the template needs this row's filename
    // so `file.name` is truthful from the first paint, and the restore
    // below needs its values. Only claim the row if it really is a saved
    // W-9 (has a `w9` marker in `editorState`) — without that check a
    // stray `?resumeDocId=<non-w9-id>` could cause the next Save to
    // upsert a stamped W-9 on top of an unrelated user document.
    type ResumeEnvelope = {
      w9?: {
        values?: Record<string, string>;
        signaturePreview?: string | null;
      };
    };

    const resumedPromise = resumeDocId
      ? (async () => {
          try {
            const doc = await documentsService.getDocument(resumeDocId);
            let parsed: ResumeEnvelope | null = null;

            if (doc.editorState) {
              try {
                parsed = JSON.parse(doc.editorState) as ResumeEnvelope;
              } catch {
                parsed = null;
              }
            }

            return parsed?.w9 ? { doc, w9: parsed.w9 } : null;
          } catch (err) {
            logger.captureError(err, "w9.resume_from_dashboard");

            return null;
          }
        })()
      : Promise.resolve(null);

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

      // Name it after the row being resumed, not the generic library
      // constant. `file.name` is what the export modal offers as the
      // download name and duplicate-checks against My PDFs, so a stale
      // name there downloads "IRS Form W-9.pdf" for a row actually called
      // "IRS Form W-9 (5).pdf" and flags a false clash against the
      // ORIGINAL row (QA 2026-10-04). Resolved before the only setFile so
      // the name is right from the first paint — no second File swap to
      // race the overlays.
      // Bounded: a slow document fetch must not hold the template — and
      // with it the whole editor — off-screen. On timeout we paint under
      // the default name; the resume below still claims the row and the
      // save paths read `currentDocumentName`, so only the export modal's
      // pre-filled name would be stale in that rare case.
      let nameTimer = 0;
      const resumedName = await Promise.race([
        resumedPromise.then((r) => r?.doc.filename ?? null),
        new Promise<null>((resolve) => {
          nameTimer = window.setTimeout(() => resolve(null), 4_000);
        }),
      ]);

      window.clearTimeout(nameTimer);

      if (!isActiveRun()) return;
      const file = new File([blob], resumedName ?? W9_LIBRARY_FILENAME, {
        type: "application/pdf",
      });

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

    // No implicit resume. Opening the W-9 is always a fresh start; the only
    // way back into a saved form is the explicit ?resumeDocId link that
    // "My PDFs" produces. The in-progress draft still survives a reload —
    // it is cleared only when arriving with ?new=1.
    const autoResumePromise = Promise.resolve();

    const resumePromise = resumeDocId
      ? (async () => {
          const resumed = await resumedPromise;

          if (!isActiveRun() || !resumed) return;

          usePdfEditorStore.getState().setCurrentDocument({
            id: resumed.doc.id,
            name: resumed.doc.filename,
          });

          const values = resumed.w9.values;

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
          const signaturePreview = resumed.w9.signaturePreview;

          if (typeof signaturePreview === "string" && signaturePreview) {
            useFormEditorStore.getState().setSignaturePreview(signaturePreview);
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
      // Reset the W-9-only auto-extract opt-out so `/pdf-composer` (which
      // shares the same store) keeps auto-extracting text on Select per
      // QA 2026-09-16.
      usePdfEditorStore.getState().setDisableAutoTextExtract(false);
      useFormEditorStore.getState().reset();
    };
  }, [setFile, resumeDocId, forceNew]);

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
