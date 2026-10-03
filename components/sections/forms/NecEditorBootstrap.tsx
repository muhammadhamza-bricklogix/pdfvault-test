"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { EditorLoadingShell } from "@/components/sections/pdf-editor/EditorLoadingShell";
import {
  beginNecDraft,
  readNecDraft,
  resetNecSessionFinalized,
} from "@/components/sections/forms/NecAutoPersist";
import { documentsService } from "@/lib/shared/api/services/documents.service";
import { formsService } from "@/lib/shared/api/services/forms.service";
import { useFormEditorStore, usePdfEditorStore } from "@/lib/client/stores";
import { ROUTES } from "@/lib/shared/constants/routes";
import { logger } from "@/lib/shared/utils/logger";

type NecEditorBootstrapProps = {
  children: React.ReactNode;
};

export const NEC_LIBRARY_FILENAME = "IRS Form 1099-NEC.pdf";

/**
 * The name a 1099-NEC save lands under — the editor's current filename,
 * which is user-editable again. Falls back to the constant before the
 * template has loaded.
 */
export function necLibraryFilename(): string {
  // Prefer the SAVED row name over the template file name. After the user
  // picks "Save as a new file", the row is called e.g. "... (2).pdf" while
  // store.file is still the template; without this the next autosave would
  // re-upload under the default name and the backend would rename the row
  // straight back.
  const { currentDocumentName, file } = usePdfEditorStore.getState();
  const current = (currentDocumentName ?? file?.name)?.trim();

  if (!current) return NEC_LIBRARY_FILENAME;

  return /\.pdf$/i.test(current)
    ? current
    : `${current.replace(/\.[^./\\]+$/, "")}.pdf`;
}

type NecResumeEnvelope = {
  nec?: { values?: Record<string, string> };
};

function parseNecValues(editorState: string | null | undefined) {
  if (!editorState) return null;
  try {
    const parsed = JSON.parse(editorState) as NecResumeEnvelope;

    if (!parsed?.nec?.values || typeof parsed.nec.values !== "object") {
      return null;
    }

    return parsed.nec.values;
  } catch {
    return null;
  }
}

export function NecEditorBootstrap({ children }: NecEditorBootstrapProps) {
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

    resetNecSessionFinalized();
    useFormEditorStore.getState().reset();

    const instanceId = beginNecDraft({ resumeDocId, forceNew });

    // One-shot: a reload re-sends the same query, so strip ?new=1 now or
    // every refresh would wipe the draft we just started. Uses
    // history.replaceState, not router.replace, because forceNew is in this
    // effect's deps and a re-render would re-run the whole bootstrap.
    if (forceNew && typeof window !== "undefined") {
      const url = new URL(window.location.href);

      url.searchParams.delete("new");
      window.history.replaceState(null, "", url.pathname + url.search);
    }

    // SYNC restore FIRST — restores any typed values immediately from
    // localStorage so the user never perceives data loss on reload or back.
    const earlyPending = readNecDraft(instanceId);

    if (earlyPending && Object.keys(earlyPending).length > 0) {
      useFormEditorStore.getState().setValues(earlyPending);
    }

    if (!useFormEditorStore.getState().values.calendar_year) {
      useFormEditorStore
        .getState()
        .setValue("calendar_year", String(new Date().getFullYear()));
    }

    // Wipe any leftover file first
    usePdfEditorStore.getState().clearFile();
    usePdfEditorStore.getState().setAutoPersistDisabled(true);
    usePdfEditorStore.getState().setDisableAutoTextExtract(true);

    // Parallel bootstrap: template fetch + form session
    const templatePromise = (async () => {
      await Promise.resolve();
      if (!isActiveRun()) return;

      const res = await fetch(ROUTES.STATIC.NEC_1099_BLANK_PDF, {
        cache: "force-cache",
      });

      if (!res.ok) {
        throw new Error(
          `Failed to load 1099-NEC template (HTTP ${res.status})`,
        );
      }
      const blob = await res.blob();

      if (!isActiveRun()) return;
      const file = new File([blob], NEC_LIBRARY_FILENAME, {
        type: "application/pdf",
      });

      setFile(file);
      // Form 1099-NEC page 1 is instructions; Copy A is page 2.
      // Set current page to 2 so user sees the form immediately.
      usePdfEditorStore.getState().setCurrentPage(2);
    })().catch((err: unknown) => {
      if (!isActiveRun()) return;
      logger.captureError(err, "1099-nec.template_load");
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't load the 1099-NEC template.",
      );
    });

    const sessionPromise = (async () => {
      await Promise.resolve();
      if (!isActiveRun()) return;

      const session = await formsService.startFormSession({
        formId: "1099-nec",
      });

      if (!isActiveRun()) return;
      useFormEditorStore.getState().hydrateFromSession(session);
    })().catch((err: unknown) => {
      if (!isActiveRun()) return;
      logger.captureError(err, "1099-nec.session_bootstrap");
      setError(
        "We couldn't start a 1099-NEC session, so your form can't be saved or downloaded. This is usually temporary — try again in a moment.",
      );
    });

    const resumePromise = (async () => {
      await Promise.resolve();
      if (!isActiveRun() || !resumeDocId) return;

      try {
        const doc = await documentsService.getDocument(resumeDocId);

        if (!isActiveRun()) return;

        const restored = parseNecValues(doc.editorState);

        usePdfEditorStore.getState().setCurrentDocument({
          id: doc.id,
          name: doc.filename,
        });

        const hasLocalDraft =
          earlyPending && Object.keys(earlyPending).length > 0;

        if (!hasLocalDraft && restored && Object.keys(restored).length > 0) {
          useFormEditorStore.getState().setValues(restored);
        }
      } catch (err) {
        logger.captureError(err, "1099-nec.resume_from_library");
      }
    })();

    void Promise.allSettled([templatePromise, sessionPromise, resumePromise]);

    return () => {
      cancelled = true;
      usePdfEditorStore.getState().clearFile();
      usePdfEditorStore.getState().setAutoPersistDisabled(false);
      usePdfEditorStore.getState().setDisableAutoTextExtract(false);
      useFormEditorStore.getState().reset();
    };
  }, [setFile, resumeDocId, forceNew]);

  // No implicit resume. Opening the form is always a fresh start; the only
  // way back into a saved 1099-NEC is the explicit ?resumeDocId link that
  // "My PDFs" produces (lib/client/utils/open-document-in-editor.ts). The
  // in-progress localStorage draft still survives a reload — see
  // `beginNecDraft` above, which only mints a new instance on ?new=1.

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[var(--pv-canvas,#f5f5f7)] px-4">
        <p className="text-sm font-medium text-danger">{error}</p>
        <button
          className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-xs font-semibold text-white shadow-sm"
          type="button"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    );
  }

  if (!currentFile) {
    return <EditorLoadingShell />;
  }

  return <>{children}</>;
}
