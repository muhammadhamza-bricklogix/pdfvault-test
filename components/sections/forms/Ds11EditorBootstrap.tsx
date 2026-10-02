"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { EditorLoadingShell } from "@/components/sections/pdf-editor/EditorLoadingShell";
import {
  beginDs11Draft,
  readDs11Draft,
  resetDs11SessionFinalized,
} from "@/components/sections/forms/Ds11AutoPersist";
import { documentsService } from "@/lib/shared/api/services/documents.service";
import { formsService } from "@/lib/shared/api/services/forms.service";
import { useFormEditorStore, usePdfEditorStore } from "@/lib/client/stores";
import { ROUTES } from "@/lib/shared/constants/routes";
import { logger } from "@/lib/shared/utils/logger";

type Ds11EditorBootstrapProps = {
  children: React.ReactNode;
};

/** PDF pages 1-4 are instructions; the application itself starts on page 5. */
export const DS11_FIRST_FORM_PAGE = 5;

export const DS11_LIBRARY_FILENAME = "Form DS-11 Passport Application.pdf";

/**
 * One file per applicant, not one per user — a household often files several.
 * The name keeps them apart in My PDFs.
 */
export function ds11LibraryFilename(): string {
  return DS11_LIBRARY_FILENAME;
}

type Ds11ResumeEnvelope = {
  ds11?: { values?: Record<string, string> };
};

function parseDs11Values(editorState: string | null | undefined) {
  if (!editorState) return null;
  try {
    const parsed = JSON.parse(editorState) as Ds11ResumeEnvelope;

    if (!parsed?.ds11?.values || typeof parsed.ds11.values !== "object") {
      return null;
    }

    return parsed.ds11.values;
  } catch {
    return null;
  }
}

export function Ds11EditorBootstrap({ children }: Ds11EditorBootstrapProps) {
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

    resetDs11SessionFinalized();
    useFormEditorStore.getState().reset();

    const instanceId = beginDs11Draft({ resumeDocId, forceNew });

    // SYNC restore FIRST — restores any typed values immediately from
    // localStorage so the user never perceives data loss on reload or back.
    const earlyPending = readDs11Draft(instanceId);

    if (earlyPending && Object.keys(earlyPending).length > 0) {
      useFormEditorStore.getState().setValues(earlyPending);
    }

    usePdfEditorStore.getState().clearFile();
    usePdfEditorStore.getState().setAutoPersistDisabled(true);
    usePdfEditorStore.getState().setDisableAutoTextExtract(true);

    const templatePromise = (async () => {
      await Promise.resolve();
      if (!isActiveRun()) return;

      const res = await fetch(ROUTES.STATIC.DS11_BLANK_PDF, {
        cache: "force-cache",
      });

      if (!res.ok) {
        throw new Error(`Failed to load DS-11 template (HTTP ${res.status})`);
      }
      const blob = await res.blob();

      if (!isActiveRun()) return;
      const file = new File([blob], "ds-11.pdf", { type: "application/pdf" });

      setFile(file);
      usePdfEditorStore.getState().setCurrentPage(DS11_FIRST_FORM_PAGE);
    })().catch((err: unknown) => {
      if (!isActiveRun()) return;
      logger.captureError(err, "ds-11.template_load");
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't load the DS-11 template.",
      );
    });

    const sessionPromise = (async () => {
      await Promise.resolve();
      if (!isActiveRun()) return;

      const session = await formsService.startFormSession({ formId: "ds-11" });

      if (!isActiveRun()) return;
      useFormEditorStore.getState().hydrateFromSession(session);
    })().catch((err: unknown) => {
      if (!isActiveRun()) return;
      logger.captureError(err, "ds-11.session_bootstrap");
      setError(
        "We couldn't start a DS-11 session, so your application can't be saved or downloaded. This is usually temporary — try again in a moment.",
      );
    });

    const resumePromise = (async () => {
      await Promise.resolve();
      if (!isActiveRun() || !resumeDocId) return;

      try {
        const doc = await documentsService.getDocument(resumeDocId);

        if (!isActiveRun()) return;

        const restored = parseDs11Values(doc.editorState);

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
        logger.captureError(err, "ds-11.resume_from_library");
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
