"use client";

import type { Canvas as FabricCanvas } from "fabric";

import { useEffect, useRef } from "react";

import { buildEditedPdfBytes } from "@/lib/client/pdf-editor/save-utils";
import { usePdfEditorStore } from "@/lib/client/stores";
import { logger } from "@/lib/shared/utils/logger";

/**
 * Bakes watermark + background-image overlays into the PDF bytes that
 * `ShareModal` uploads to `/api/share/create`.
 *
 * Why we need this hook: `ShareModal` runs at shell level with no direct
 * access to the live Fabric canvas ref, so it can't call
 * `buildEditedPdfBytes({ bakeOverlays: true })` itself. The store's `file`
 * carries the cloud-Save output, which uses `bakeOverlays: false` — that
 * intentionally omits watermark + bg-image (both stack on every save
 * otherwise). Result: pre-fix, recipients of a share link opened the PDF
 * with edited text and shapes present but the watermark / background
 * image missing (QA 2026-09-09).
 *
 * Mirrors `useExportEditor` / `useExtractImagesEditor` / `useSaveEditor`
 * — mounted in `PdfEditorShell` so the live `fabricCanvas` ref is
 * available. `ShareModal.onGenerate` dispatches
 * `editor:share-bake` with an `onComplete` callback, this hook runs the
 * merge with `bakeOverlays: true`, then resolves the callback with the
 * baked bytes (or an error). Nothing else in the app touches this event.
 */
export type ShareBakeResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: "no-file" | "not-loaded" | "error"; message?: string };

export type ShareBakeEventDetail = {
  onComplete: (result: ShareBakeResult) => void;
};

export function useShareBaker(fabricCanvas: FabricCanvas | null): void {
  const fabricRef = useRef(fabricCanvas);

  useEffect(() => {
    fabricRef.current = fabricCanvas;
  }, [fabricCanvas]);

  useEffect(() => {
    const onBake = async (event: Event) => {
      const detail = (event as CustomEvent<ShareBakeEventDetail>).detail;
      const onComplete = detail?.onComplete;

      if (typeof onComplete !== "function") return;

      const state = usePdfEditorStore.getState();
      const { file, currentPage, pdfDocument } = state;

      if (!file) {
        onComplete({ ok: false, reason: "no-file" });

        return;
      }

      if (!pdfDocument) {
        onComplete({ ok: false, reason: "not-loaded" });

        return;
      }

      try {
        const { bytes } = await buildEditedPdfBytes({
          currentPage,
          fabricCanvas: fabricRef.current,
          file,
          bakeOverlays: true,
        });

        onComplete({ ok: true, bytes });
      } catch (err) {
        logger.captureError(err, "share.bake_failed", {
          hasFabric: !!fabricRef.current,
        });
        onComplete({
          ok: false,
          reason: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    };

    window.addEventListener("editor:share-bake", onBake as EventListener);

    return () => {
      window.removeEventListener("editor:share-bake", onBake as EventListener);
    };
  }, []);
}
