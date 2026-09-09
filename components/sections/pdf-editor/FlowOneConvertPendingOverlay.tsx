"use client";

import { useAuth } from "@clerk/nextjs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
 *      converted so `gateEntitledAction` will fire the paywall.
 *   3. Once the doc is created, replaces the URL with `?id=<docId>`.
 *      `useEditorDocumentLoader` picks that up, fetches the doc meta,
 *      calls `gateEntitledAction(doc)` → paywall opens for the
 *      non-entitled just-signed-up user.
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
  const [visible, setVisible] = useState(convertPending === "1");
  const consumedRef = useRef(false);

  useEffect(() => {
    if (convertPending !== "1") return;
    if (!authLoaded) return;
    if (!isSignedIn || !userId) return;
    if (consumedRef.current) return;
    consumedRef.current = true;

    void (async () => {
      try {
        setStatusMessage("Preparing your document…");
        const result = await loadPendingEditorFile();

        if (!result?.file) {
          // No file to convert — strip the marker and let the
          // regular editor path take over.
          logger.warn(
            "[FlowOneConvertPendingOverlay] convert-pending=1 with no IDB file",
          );
          const next = new URLSearchParams(searchParams.toString());

          next.delete("convert-pending");
          const suffix = next.toString();

          router.replace(suffix ? `${pathname}?${suffix}` : pathname);
          setVisible(false);

          return;
        }

        setStatusMessage("Converting to PDF…");

        const tempId =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const pdfName = /\.pdf$/i.test(result.file.name)
          ? result.file.name
          : result.file.name.replace(/\.[^.]+$/, "") + ".pdf";

        // Register the pending row in the store so the dashboard (if
        // the user navigates back mid-conversion) shows the placeholder
        // too. Backend does the conversion, we just upload the source.
        usePendingConversionsStore.getState().add({
          tempId,
          file: result.file,
          filename: pdfName,
          sizeBytes: result.file.size,
        });

        const created = await runPendingConversion(tempId, result.file);

        await clearPendingEditorFile();

        if (!created) {
          toast.error({
            title: "Conversion failed",
            description:
              "We couldn't convert your document. Please try again from the dashboard.",
          });
          router.replace(ROUTES.APP.DASHBOARD);

          return;
        }

        setStatusMessage("Opening your document…");

        // Replace URL with `?id=<docId>`. `useEditorDocumentLoader`
        // fetches the doc metadata, sees `originalContentType != null`,
        // and fires `gateEntitledAction` → paywall.
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
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-white/90 backdrop-blur-sm"
      role="status"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 rounded-full border-4 border-default-200" />
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[#f12c23]" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-[15px] font-semibold text-[var(--color-foreground)]">
            {statusMessage}
          </p>
          <p className="text-[13px] text-default-500">
            This usually takes a few seconds.
          </p>
        </div>
      </div>
    </div>
  );
}
