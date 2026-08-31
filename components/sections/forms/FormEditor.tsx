"use client";

import type { FormField, FormSchema } from "@/lib/shared/types/forms.types";
import type { RenderedPageInfo } from "./FormCanvas";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Modal } from "@heroui/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  SearchAddIcon,
  SearchMinusIcon,
  SignatureIcon,
} from "@hugeicons/core-free-icons";
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

const ZOOM_MIN = 0.75;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;

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
  // Sidebar collapse toggle. Default open on desktop so accessibility /
  // section grouping stays discoverable; user collapses it when they want
  // the whole form full-width for inline editing (form-first flow, but
  // preserves the sidebar as an opt-in helper).
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [zoom, setZoom] = useState(1.5);
  const canZoomOut = zoom > ZOOM_MIN + 0.001;
  const canZoomIn = zoom < ZOOM_MAX - 0.001;
  const zoomPercent = useMemo(() => `${Math.round(zoom * 100)}%`, [zoom]);
  const handleZoomOut = useCallback(
    () => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2))),
    [],
  );
  const handleZoomIn = useCallback(
    () => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2))),
    [],
  );

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

  // Bootstrap the session. Ref only flips true AFTER a successful hydrate
  // so a failed bootstrap (backend 401 on the public /w-9 URL, cold-start
  // network flake, worker not yet deployed, etc.) can be retried. Without
  // the post-success gate, the ref latched at the top of the effect and
  // the app got stuck at "Starting session…" forever — every downstream
  // action (Signature, Done) then failed with "No session yet".
  const bootstrappedRef = useRef(false);
  const inFlightRef = useRef(false);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);

  useEffect(() => {
    if (bootstrappedRef.current) return;
    if (inFlightRef.current) return;

    inFlightRef.current = true;

    async function bootstrap() {
      try {
        const session = await start.mutateAsync({ formId });

        hydrate(session);
        bootstrappedRef.current = true;
      } catch (err) {
        toast.error({
          title: "Couldn't start the form",
          description:
            err instanceof Error
              ? err.message
              : "Please try again in a moment.",
        });
      } finally {
        inFlightRef.current = false;
      }
    }

    bootstrap();
    // `bootstrapAttempt` is incremented by the Retry button to re-run this
    // effect after a failure; the guards above dedupe the StrictMode
    // double-fire so retries can't stack concurrent /start requests.
  }, [formId, bootstrapAttempt]);

  const retryBootstrap = useCallback(() => {
    if (inFlightRef.current) return;
    bootstrappedRef.current = false;
    setBootstrapAttempt((n) => n + 1);
  }, []);

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
          {/* Session status. Error state exposes a Retry button so a
              failed bootstrap (backend down, cold-start 401, network flake)
              isn't a dead end — otherwise every downstream action fails
              silently with "session not started yet". */}
          {sessionId ? (
            <p className="hidden text-xs text-default-500 md:block">
              Session {sessionId.slice(0, 8)}…
            </p>
          ) : start.isError ? (
            <div className="hidden items-center gap-2 md:flex">
              <p className="text-xs text-red-600">
                Couldn&apos;t start session.
              </p>
              <Button
                isDisabled={start.isPending}
                size="sm"
                variant="tertiary"
                onPress={retryBootstrap}
              >
                Retry
              </Button>
            </div>
          ) : (
            <p className="hidden text-xs text-default-500 md:block">
              Starting session…
            </p>
          )}
          <div
            aria-label="Zoom"
            className="hidden items-center gap-1 rounded-md border border-default-200 bg-default-50 px-1 py-0.5 dark:border-default-700 dark:bg-default-100 md:inline-flex"
            role="group"
          >
            <Button
              isIconOnly
              aria-label="Zoom out"
              isDisabled={!canZoomOut}
              size="sm"
              variant="tertiary"
              onPress={handleZoomOut}
            >
              <HugeiconsIcon icon={SearchMinusIcon} size={16} />
            </Button>
            <span
              aria-live="polite"
              className="min-w-10 text-center text-xs tabular-nums text-default-600"
            >
              {zoomPercent}
            </span>
            <Button
              isIconOnly
              aria-label="Zoom in"
              isDisabled={!canZoomIn}
              size="sm"
              variant="tertiary"
              onPress={handleZoomIn}
            >
              <HugeiconsIcon icon={SearchAddIcon} size={16} />
            </Button>
          </div>
          <Button
            aria-expanded={sidebarOpen}
            aria-label={sidebarOpen ? "Hide field list" : "Show field list"}
            className="hidden md:inline-flex"
            size="sm"
            variant="tertiary"
            onPress={() => setSidebarOpen((v) => !v)}
          >
            <HugeiconsIcon
              icon={sidebarOpen ? ArrowRight01Icon : ArrowLeft01Icon}
              size={16}
            />
            <span className="hidden lg:inline">
              {sidebarOpen ? "Hide fields" : "Show fields"}
            </span>
          </Button>
          <Button
            aria-label="Add signature"
            // Disable while there's no session — otherwise the modal opens,
            // the user draws / types / uploads, then Apply throws "No
            // session yet". Better to prevent the dead-end up front.
            isDisabled={!sessionId}
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
        <div
          className={`hidden min-h-0 flex-1 items-start justify-center overflow-auto bg-default-100 p-6 md:flex ${
            sidebarOpen ? "md:basis-3/5" : "md:basis-full"
          }`}
        >
          <FormCanvas
            pdfUrl={pdfUrl}
            renderOverlay={renderOverlay}
            scale={zoom}
            onPageReady={handlePageReady}
          />
        </div>

        {sidebarOpen ? (
          <div className="flex min-h-0 flex-1 md:basis-2/5">
            <FormSidebar sections={schema.sections} />
          </div>
        ) : null}
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
                scale={zoom}
                onPageReady={handlePageReady}
              />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
