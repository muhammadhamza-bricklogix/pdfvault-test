"use client";

import { useAuth } from "@clerk/nextjs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { usePdfEditorStore } from "@/lib/client/stores";
import { usePendingConversionsStore } from "@/lib/client/stores/pending-conversions-store";
import {
  clearPendingEditorFile,
  loadPendingEditorFile,
} from "@/lib/client/upload/pending-editor-file";
import { runPendingConversion } from "@/lib/client/upload/run-pending-conversion";
import { ROUTES } from "@/lib/shared/constants/routes";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

/**
 * Flow 1 (spec 2026-09-09) post-signup landing on the editor.
 *
 * Guest dropped a non-PDF on `/convert/*`, went through the email-first
 * modal + silent signup, and landed HERE with `?convert-pending=1`.
 * Their original file is waiting in IDB. This component:
 *
 *   1. Renders a full-viewport "Converting your document…" overlay
 *      so the user sees progress while the upload + backend
 *      conversion happens (typical range: a few seconds).
 *   2. Fires `runPendingConversion` against the IDB file. The backend
 *      handles the X→PDF conversion at `/documents/upload` time — the
 *      returned Document row's `originalContentType` marks it as
 *      converted so dashboard Download can enforce entitlement later.
 *   3. Once the doc is created, replaces the URL with `?id=<docId>`.
 *      `useEditorDocumentLoader` picks that up, fetches the doc meta,
 *      and opens composer without an open-time paywall.
 *   4. On conversion error, redirects to /dashboard with a toast so
 *      the user isn't stranded on a spinning loader.
 *
 * Gated on `user` so it only fires once Clerk resolves the session;
 * before that, `/documents/upload` would 401. Ref-latched against
 * React StrictMode double-invoke.
 *
 * The component renders nothing when `?convert-pending=1` is absent,
 * so it's a no-op on every other editor entry path.
 */
export function FlowOneConvertPendingOverlay() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isLoaded: authLoaded, isSignedIn, userId } = useAuth();
  const convertPending = searchParams.get("convert-pending");

  const [statusMessage, setStatusMessage] = useState(
    "Preparing your document…",
  );
  const [progress, setProgress] = useState(5);
  const [visible, setVisible] = useState(convertPending === "1");
  const consumedRef = useRef(false);

  // Smoothly march the progress bar towards its stage target while
  // the actual work runs. The backend doesn't stream progress on the
  // /documents/upload endpoint, so we simulate motion between stage
  // milestones set inside the effect below. Simulation clamps at 95%
  // so it never displays "100%" before the redirect actually fires.
  const stageTargetRef = useRef(20);

  useEffect(() => {
    if (!visible) return;
    const interval = window.setInterval(() => {
      setProgress((current) => {
        const target = stageTargetRef.current;

        if (current >= target) return current;

        // Slow down as we approach the target so it feels weighty
        // instead of hitting the wall.
        const gap = target - current;
        const step = Math.max(0.3, gap / 12);

        return Math.min(target, current + step);
      });
    }, 60);

    return () => window.clearInterval(interval);
  }, [visible]);

  // Shell latch: `PdfEditorShell` synchronously sets
  // `isRestoringSession=true` in a `useState` initializer when the URL
  // has no `?id=` (line ~485). `PendingEditorFileHydrator` short-
  // circuits Step 2 on `?convert-pending=1` so it never clears that
  // flag, and this overlay owns the release path — success navigates
  // to `?id=<docId>` (doc loader picks up), errors flip the flag off
  // + navigate to /dashboard. Together this keeps `shouldRedirectAway`
  // false the entire time the conversion is running.

  useEffect(() => {
    if (convertPending !== "1") return;
    if (!authLoaded) return;
    if (!isSignedIn || !userId) return;
    if (consumedRef.current) return;
    consumedRef.current = true;

    void (async () => {
      try {
        setStatusMessage("Preparing your document…");
        stageTargetRef.current = 25;
        const result = await loadPendingEditorFile();

        if (!result?.file) {
          logger.warn(
            "[FlowOneConvertPendingOverlay] convert-pending=1 with no IDB file",
          );
          // No file to convert — drop the shell latch so it can decide
          // its own fate (likely redirect to dashboard since !file).
          usePdfEditorStore.setState({ isRestoringSession: false });
          const next = new URLSearchParams(searchParams.toString());

          next.delete("convert-pending");
          const suffix = next.toString();

          router.replace(suffix ? `${pathname}?${suffix}` : pathname);
          setVisible(false);

          return;
        }

        // Clear IDB immediately so no other hydrator / mirror /
        // auto-resume can pick up the same file while we're uploading
        // it. We already hold the File in memory via `result.file`.
        await clearPendingEditorFile().catch(() => undefined);

        setStatusMessage("Uploading your file…");
        stageTargetRef.current = 55;

        const tempId =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const pdfName = /\.pdf$/i.test(result.file.name)
          ? result.file.name
          : result.file.name.replace(/\.[^.]+$/, "") + ".pdf";

        usePendingConversionsStore.getState().add({
          tempId,
          file: result.file,
          filename: pdfName,
          sizeBytes: result.file.size,
        });

        setStatusMessage("Converting to PDF…");
        stageTargetRef.current = 90;

        const created = await runPendingConversion(tempId, result.file);

        await clearPendingEditorFile();

        if (!created) {
          toast.error({
            title: "Conversion failed",
            description:
              "We couldn't convert your document. Please try again from the dashboard.",
          });
          // Release the shell latch so its redirect-to-dashboard useEffect
          // can fire (safety net if `router.replace` below no-ops).
          usePdfEditorStore.setState({ isRestoringSession: false });
          router.replace(ROUTES.APP.DASHBOARD);

          return;
        }

        setStatusMessage("Opening your document…");
        setProgress(100);
        stageTargetRef.current = 100;

        // Hide the overlay BEFORE navigating. `visible` is React state
        // and does not reset on soft navigation (the component stays
        // mounted across router.replace on the same route). Without this
        // the overlay stays fixed on screen even after the paywall opens
        // + the user pays, leaving them permanently stuck on
        // "Opening your document…" (QA 2026-09-10).
        setVisible(false);

        // Replace URL with `?id=<docId>`. `useEditorDocumentLoader`
        // fetches the doc metadata, sees `originalContentType != null`,
        // and fires the MANDATORY paywall via `gateEntitledAction`.
        router.replace(
          `${ROUTES.TOOLS.PDF_EDITOR}?id=${encodeURIComponent(created.id)}`,
        );
      } catch (err) {
        logger.captureError(err, "flow_one_convert_pending", {});
        toast.error({
          title: "Something went wrong",
          description:
            "We couldn't finish converting your document. Redirecting you to the dashboard.",
        });
        usePdfEditorStore.setState({ isRestoringSession: false });
        router.replace(ROUTES.APP.DASHBOARD);
      }
    })();
  }, [
    convertPending,
    authLoaded,
    isSignedIn,
    userId,
    pathname,
    router,
    searchParams,
  ]);

  if (!visible) return null;

  return (
    <div
      aria-live="polite"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-white/95 backdrop-blur-sm"
      role="status"
    >
      <div className="w-[min(420px,calc(100vw-48px))] rounded-2xl border border-default-200 bg-white p-6 shadow-[0_24px_60px_-30px_rgba(23,23,23,0.25)]">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f12c23]/10">
            <svg
              aria-hidden
              fill="none"
              height="24"
              stroke="#f12c23"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
              width="24"
            >
              <path d="M14 3v4a1 1 0 0 0 1 1h4" />
              <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
              <path d="M9 12h6" />
              <path d="M9 16h6" />
            </svg>
          </div>

          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-[16px] font-semibold text-[var(--color-foreground)]">
              {statusMessage}
            </p>
            <p className="text-[13px] text-default-500">
              This usually takes a few seconds. Please don&apos;t close this
              window.
            </p>
          </div>

          <div className="flex w-full flex-col gap-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-default-100">
              <div
                aria-label="Conversion progress"
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={Math.round(progress)}
                className="h-full rounded-full bg-[#f12c23] transition-[width] duration-200 ease-out"
                role="progressbar"
                style={{ width: `${Math.round(progress)}%` }}
              />
            </div>
            <p className="text-right text-[11px] font-medium text-default-500 tabular-nums">
              {Math.round(progress)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
