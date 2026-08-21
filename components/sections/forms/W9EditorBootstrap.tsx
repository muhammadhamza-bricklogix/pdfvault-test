"use client";

import { useEffect, useState } from "react";

import { EditorLoadingShell } from "@/components/sections/pdf-editor/EditorLoadingShell";
import { usePdfEditorStore } from "@/lib/client/stores";
import { ROUTES } from "@/lib/shared/constants/routes";
import { logger } from "@/lib/shared/utils/logger";

type W9EditorBootstrapProps = {
  children: React.ReactNode;
};

/**
 * Preloads the blank IRS W-9 template into the shared pdf-composer
 * store so the standard `<PdfEditorShell />` can be reused for the
 * W-9 route. This lets the W-9 page inherit every tool + thumbnail
 * sidebar + top toolbar + save/download flow from pdf-composer, no
 * duplication of the editor UI.
 *
 * Order of operations:
 *
 *   1. Mount → `usePdfEditorStore.clearFile()` so no leftover PDF from
 *      a prior pdf-composer visit briefly flashes before the W-9
 *      loads.
 *   2. Fetch the blank W-9 template (public asset, no auth).
 *   3. Wrap the bytes in a `File` object and call `setFile()`. The
 *      shell's `usePdfLoader` picks it up and parses via pdf.js.
 *   4. Wait for `pdfDocument` to be non-null before rendering the
 *      children — otherwise the shell shows the drop-zone for a beat
 *      while pdf.js hydrates.
 *
 * On unmount we clear the store again so the next `/pdf-composer`
 * visit starts on the drop-zone, not on the W-9.
 */
export function W9EditorBootstrap({ children }: W9EditorBootstrapProps) {
  const setFile = usePdfEditorStore((s) => s.setFile);
  const clearFile = usePdfEditorStore((s) => s.clearFile);
  const currentFile = usePdfEditorStore((s) => s.file);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Wipe any leftover file first so the drop-zone / previous PDF
    // doesn't flash before ours loads.
    clearFile();

    void (async () => {
      try {
        const res = await fetch(ROUTES.STATIC.W9_BLANK_PDF, {
          cache: "force-cache",
        });

        if (!res.ok) {
          throw new Error(`Failed to load W-9 template (HTTP ${res.status})`);
        }
        const blob = await res.blob();

        if (cancelled) return;
        const file = new File([blob], "w-9.pdf", { type: "application/pdf" });

        setFile(file);
      } catch (err) {
        if (cancelled) return;
        logger.captureError(err, "w9.template_load");
        setError(
          err instanceof Error
            ? err.message
            : "Couldn't load the W-9 template.",
        );
      }
    })();

    return () => {
      cancelled = true;
      // Clear on unmount so `/pdf-composer` and other editor routes
      // don't inherit the W-9 as their initial file.
      clearFile();
    };
  }, [clearFile, setFile]);

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
  // `usePdfLoader` which lives inside `<PdfEditorShell />` — gating
  // this wrapper on `pdfDocument` would create a chicken-and-egg
  // deadlock (shell never mounts → loader never runs → pdfDocument
  // stays null → this gate never opens). Once `file` lands, the shell
  // renders its own internal loading state until pdf.js finishes
  // parsing, so the transition is still smooth.
  if (!currentFile) {
    return <EditorLoadingShell />;
  }

  return <>{children}</>;
}
