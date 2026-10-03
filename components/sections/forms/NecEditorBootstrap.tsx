"use client";

import { useAuth } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { EditorLoadingShell } from "@/components/sections/pdf-editor/EditorLoadingShell";
import {
  beginNecDraft,
  readNecDraft,
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

export function necLibraryFilename(): string {
  return NEC_LIBRARY_FILENAME;
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
  const { isLoaded: authLoaded, isSignedIn } = useAuth();

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

  // Implicit resume from the saved 1099-NEC row belonging to the signed-in
  // user. The W-9 has always done this; the 1099-NEC only honoured an
  // explicit ?resumeDocId, so a form saved on a phone opened blank on web.
  //
  // Pure read (listDocuments + getDocument), so no row is created and
  // nothing new appears in My PDFs. A row still arrives only on an explicit
  // Save or Download, exactly as before.
  //
  // Deliberately its own effect keyed on auth. Adding isSignedIn to the
  // bootstrap effect above would re-fetch the template and POST a second
  // form session; keeping it separate also lets the restore fire after a
  // logged-out user signs in and comes back.
  useEffect(() => {
    if (!authLoaded || !isSignedIn) return;
    // An explicit resume target already covers this, and ?new=1 means the
    // user deliberately asked for a blank form.
    if (resumeDocId || forceNew) return;

    let cancelled = false;

    void (async () => {
      try {
        const existing = await findDuplicateByFilename(NEC_LIBRARY_FILENAME);

        if (cancelled || !existing) return;

        const doc = await documentsService.getDocument(existing.id);

        if (cancelled) return;

        // Only adopt the row when the editorState marker is present — that
        // is the signal it came from the 1099-NEC flow, not an unrelated
        // PDF the user happened to give the same name.
        const restored = parseNecValues(doc.editorState);

        if (!restored || Object.keys(restored).length === 0) return;

        usePdfEditorStore.getState().setCurrentDocument({
          id: doc.id,
          name: doc.filename,
        });

        // Anything already typed wins. calendar_year is seeded by the
        // bootstrap above, so it does not count as real input.
        const current = useFormEditorStore.getState().values;
        const hasLocalInput = Object.entries(current).some(
          ([key, value]) => key !== "calendar_year" && Boolean(value),
        );

        if (hasLocalInput) return;

        useFormEditorStore.getState().setValues(restored);
      } catch (err) {
        // Non-fatal: a flaky list call must not block the template opening.
        logger.captureError(err, "1099-nec.auto_resume_from_library");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoaded, isSignedIn, resumeDocId, forceNew]);

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
