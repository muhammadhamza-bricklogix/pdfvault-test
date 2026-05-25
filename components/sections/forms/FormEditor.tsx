"use client";

import type { FormField, FormSchema } from "@/lib/shared/types/forms.types";
import type { RenderedPageInfo } from "./FormCanvas";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Modal } from "@heroui/react";
import { SignatureIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { validateW9 } from "@/lib/client/forms/validate-w9";
import { useUnsavedChangesWarning } from "@/lib/client/hooks/forms/use-unsaved-changes-warning";
import { useStartFormSessionMutation } from "@/lib/client/query/mutations/forms.mutation";
import { useFormEditorStore } from "@/lib/client/stores";
import { toast } from "@/lib/shared/utils/toast";

import { FinalizeModal } from "./FinalizeModal";
import { SignatureModal } from "./SignatureModal";
import { FormCanvas } from "./FormCanvas";
import { FormFieldOverlay } from "./FormFieldOverlay";
import { FormSidebar } from "./FormSidebar";

type FormEditorProps = {
  formId: string;
  schema: FormSchema;
};

export function FormEditor({ formId, schema }: FormEditorProps) {
  const sessionId = useFormEditorStore((s) => s.sessionId);
  const pdfUrl = useFormEditorStore((s) => s.pdfUrl) ?? schema.pdfUrl;
  const values = useFormEditorStore((s) => s.values);
  const signatureKey = useFormEditorStore((s) => s.signatureKey);
  const finalizedUrl = useFormEditorStore((s) => s.finalizedUrl);

  const hydrate = useFormEditorStore((s) => s.hydrateFromSession);
  const reset = useFormEditorStore((s) => s.reset);

  const start = useStartFormSessionMutation();

  // Warn the user before refresh/close if they've typed or signed but
  // haven't finalized yet. We don't auto-save, so navigating away drops
  // everything — the native prompt is what protects them.
  const hasUnsavedWork =
    !finalizedUrl &&
    (Object.values(values).some((v) => v && v.trim().length > 0) ||
      Boolean(signatureKey));

  useUnsavedChangesWarning(hasUnsavedWork);

  // Per-page render info, populated as each canvas finishes painting.
  const [pages, setPages] = useState<Map<number, RenderedPageInfo>>(new Map());
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  // Top-bar signature tool — always visible regardless of scroll position.
  const [signatureOpen, setSignatureOpen] = useState(false);
  // Done → FinalizeModal (previously lived in FormFooter).
  const [finalizeOpen, setFinalizeOpen] = useState(false);

  const handleDone = useCallback(() => {
    const state = useFormEditorStore.getState();
    const errors = validateW9({
      values: state.values,
      signatureKey: state.signatureKey,
    });

    if (Object.keys(errors).length > 0) {
      state.setErrors(errors);

      const firstFieldId = Object.keys(errors)[0]!;
      const firstError = errors[firstFieldId];

      toast.error({
        title: "Fix a few things before finalizing",
        description: firstError ?? "Some fields need attention.",
      });

      const element = document.getElementById(`sidebar-${firstFieldId}`);

      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.focus({ preventScroll: true });
      }

      return;
    }

    state.setErrors({});
    setFinalizeOpen(true);
  }, []);

  const handlePageReady = useCallback(
    (pageNumber: number, info: RenderedPageInfo) => {
      setPages((prev) => {
        const next = new Map(prev);

        next.set(pageNumber, info);

        return next;
      });
    },
    [],
  );

  // Bootstrap once. We never re-fetch a session by id and we don't persist
  // intermediate values — values exist only in the browser until finalize.
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    let cancelled = false;

    async function bootstrap() {
      try {
        const session = await start.mutateAsync({ formId });

        if (cancelled) return;
        hydrate(session);
      } catch (err) {
        toast.error({
          title: "Couldn't start the form",
          description:
            err instanceof Error
              ? err.message
              : "Please try again in a moment.",
        });
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [formId]);

  useEffect(() => () => reset(), [reset]);

  // Group fields by page once so per-page overlay render is O(1) per page.
  const fieldsByPage = new Map<number, FormField[]>();

  schema.sections
    .flatMap((s) => s.fields)
    .forEach((f) => {
      const arr = fieldsByPage.get(f.rect.page) ?? [];

      arr.push(f);
      fieldsByPage.set(f.rect.page, arr);
    });

  const renderOverlay = useCallback(
    (pageNumber: number) => {
      const page = pages.get(pageNumber);
      const fields = fieldsByPage.get(pageNumber);

      if (!page || !fields || fields.length === 0) return null;

      return <FormFieldOverlay fields={fields} page={page} />;
    },

    [pages],
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-default-200 bg-[var(--color-background)] px-4 py-3 dark:border-default-700">
        <div>
          <h1 className="text-base font-semibold text-[var(--color-foreground)]">
            {schema.label}
          </h1>
          <p className="text-xs text-default-500">
            Fill out, sign, and export as a PDF.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <p className="hidden text-xs text-default-500 md:block">
            {sessionId
              ? `Session ${sessionId.slice(0, 8)}…`
              : "Starting session…"}
          </p>
          <Button
            aria-label="Add signature"
            size="sm"
            variant={signatureKey ? "secondary" : "tertiary"}
            onPress={() => setSignatureOpen(true)}
          >
            <HugeiconsIcon icon={SignatureIcon} size={16} />
            <span className="hidden sm:inline">
              {signatureKey ? "Edit signature" : "Signature"}
            </span>
          </Button>
          <Button
            isDisabled={!sessionId}
            size="sm"
            variant="primary"
            onPress={handleDone}
          >
            Done
          </Button>
        </div>
      </header>

      <SignatureModal isOpen={signatureOpen} onOpenChange={setSignatureOpen} />
      <FinalizeModal isOpen={finalizeOpen} onOpenChange={setFinalizeOpen} />

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="hidden min-h-0 flex-1 items-start justify-center overflow-auto bg-default-100 p-6 md:flex md:basis-3/5">
          <FormCanvas
            pdfUrl={pdfUrl}
            renderOverlay={renderOverlay}
            scale={1.5}
            onPageReady={handlePageReady}
          />
        </div>

        <div className="flex min-h-0 flex-1 md:basis-2/5">
          <FormSidebar sections={schema.sections} />
        </div>
      </div>

      <div className="sticky bottom-2 z-10 flex justify-center px-4 pb-2 md:hidden">
        <Button
          size="sm"
          variant="secondary"
          onPress={() => setMobilePreviewOpen(true)}
        >
          Preview PDF
        </Button>
      </div>

      <Modal.Backdrop
        isOpen={mobilePreviewOpen}
        onOpenChange={setMobilePreviewOpen}
      >
        <Modal.Container>
          <Modal.Dialog className="h-[100dvh] w-[100vw] max-w-none rounded-none p-0">
            <Modal.CloseTrigger />
            <Modal.Body className="flex h-full items-start justify-center overflow-auto bg-default-100 p-3">
              <FormCanvas
                pdfUrl={pdfUrl}
                renderOverlay={() => null}
                scale={1.5}
                onPageReady={handlePageReady}
              />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
