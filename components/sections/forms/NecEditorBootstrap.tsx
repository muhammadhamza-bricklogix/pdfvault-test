"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { EditorLoadingShell } from "@/components/sections/pdf-editor/EditorLoadingShell";
import {
  readPendingNecState,
  resetNecSessionFinalized,
} from "@/components/sections/forms/NecAutoPersist";
import { findDuplicateByFilename } from "@/lib/client/hooks/upload/use-upload-with-duplicate-check";
import { documentsService } from "@/lib/shared/api/services/documents.service";
import { formsService } from "@/lib/shared/api/services/forms.service";
import { useFormEditorStore, usePdfEditorStore } from "@/lib/client/stores";
import { ROUTES } from "@/lib/shared/constants/routes";
import { logger } from "@/lib/shared/utils/logger";

type NecEditorBootstrapProps = {
  children: React.ReactNode;
};

export const NEC_LIBRARY_FILENAME = "IRS Form 1099-NEC.pdf";

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

  const bootstrapRunIdRef = useRef(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const runId = bootstrapRunIdRef.current + 1;

    bootstrapRunIdRef.current = runId;
    let cancelled = false;
    const isActiveRun = () => !cancelled && bootstrapRunIdRef.current === runId;

    resetNecSessionFinalized();

    // SYNC restore FIRST — restores any typed values immediately from localStorage
    // so user never perceives data loss when accidentally closing/reopening tab or navigating back
    const earlyPending = readPendingNecState();

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
      const file = new File([blob], "1099-nec.pdf", {
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
      if (!isActiveRun()) return;

      try {
        const docId =
          resumeDocId ??
          (await findDuplicateByFilename(NEC_LIBRARY_FILENAME))?.id;

        if (!isActiveRun() || !docId) return;

        const doc = await documentsService.getDocument(docId);

        if (!isActiveRun()) return;

        const restored = parseNecValues(doc.editorState);

        if (!restored && !resumeDocId) return;

        usePdfEditorStore.getState().setCurrentDocument({
          id: doc.id,
          name: doc.filename,
        });

        if (restored && Object.keys(restored).length > 0) {
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
  }, [setFile, resumeDocId]);

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
