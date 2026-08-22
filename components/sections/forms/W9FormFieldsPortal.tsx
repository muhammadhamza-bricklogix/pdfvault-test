"use client";

import type { FormField } from "@/lib/shared/types/forms.types";
import type { RenderedPageInfo } from "./FormCanvas";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { FormFieldOverlay } from "@/components/sections/forms/FormFieldOverlay";
import { W9_SCHEMA } from "@/lib/client/forms/w9-schema";
import { usePdfEditorStore } from "@/lib/client/stores";

/**
 * Renders the W-9 form-fill overlays (yellow tick fields, text inputs,
 * SSN/EIN cells, signature area) as a portaled layer on top of the
 * shared `<PdfViewerCanvas />`.
 *
 * We do NOT modify `PdfViewerCanvas` (it's in the locked pdf-editor
 * area). Instead we find its per-page container in the DOM by looking
 * for the canvas that carries the `PDF page N of M` aria-label — the
 * only stable public marker of the render root. Its parent div (the
 * `relative bg-white` container in the viewer) is the coordinate space
 * every existing pdf-editor overlay (SearchHighlightLayer, floating
 * toolbars) already positions against, so portaling here keeps the
 * fields aligned with the rendered page regardless of the pdf-editor's
 * scroll / pan / zoom state.
 *
 * Pointer-events are enabled only when `activeTool === 'select'`, so
 * pdf-composer tools (Add Text, Draw, Highlight, etc.) can still hit
 * the underlying Fabric canvas without the form overlays swallowing
 * their taps.
 */
export function W9FormFieldsPortal() {
  const activeTool = usePdfEditorStore((s) => s.activeTool);
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const pdfDocument = usePdfEditorStore((s) => s.pdfDocument);
  const zoom = usePdfEditorStore((s) => s.zoom);

  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [pageInfo, setPageInfo] = useState<RenderedPageInfo | null>(null);

  // Look up the pdf-composer's per-page container. The `relative bg-white`
  // wrapper isn't uniquely queryable, but its child pdf.js canvas carries
  // the `PDF page N of M` aria-label — walking to its parent lands us on
  // the exact node that hosts SearchHighlightLayer + floating toolbars.
  // We re-check whenever the current page changes because pdf-composer
  // remounts the canvas per page.
  useEffect(() => {
    if (!pdfDocument) return;
    let cancelled = false;

    const findContainer = () => {
      if (cancelled) return;
      const canvas = document.querySelector<HTMLCanvasElement>(
        'canvas[aria-label^="PDF page"]',
      );
      const next = canvas?.parentElement ?? null;

      setContainer((prev) => (prev === next ? prev : next));

      return next;
    };

    // Try immediately, then poll a few times in case pdf.js is mid-mount.
    if (findContainer()) return;
    const ids: number[] = [];

    [16, 60, 200, 500].forEach((delay) => {
      ids.push(window.setTimeout(findContainer, delay));
    });

    return () => {
      cancelled = true;
      ids.forEach((id) => window.clearTimeout(id));
    };
  }, [currentPage, pdfDocument]);

  // Recompute pdf-space → CSS-space dimensions whenever the container,
  // zoom, or current page change. `container.clientWidth/Height` reflects
  // the actual rendered canvas size (pdf-editor sets canvas dimensions
  // via `setDimensions` on zoom change), so measuring the DOM keeps us
  // in lockstep with pdf-editor's zoom without duplicating its math.
  useEffect(() => {
    // When the container or pdfDocument disappears we simply don't
    // schedule a measurement — the render guard below (`!container ||
    // !pageInfo`) short-circuits so any stale pageInfo never paints.
    // Avoids calling setState synchronously in an effect body
    // (react-hooks/set-state-in-effect).
    if (!container || !pdfDocument) return;
    let cancelled = false;

    void (async () => {
      try {
        const page = await pdfDocument.getPage(currentPage);
        const viewport = page.getViewport({ scale: 1 });

        if (cancelled) return;
        const measure = () => {
          if (cancelled || !container.isConnected) return;
          setPageInfo({
            pdfWidth: viewport.width,
            pdfHeight: viewport.height,
            displayWidth: container.clientWidth,
            displayHeight: container.clientHeight,
          });
        };

        measure();

        // Container resizes when pdf-editor changes zoom or the page
        // remounts at a different size. ResizeObserver keeps our overlay
        // rects in lockstep without a polling loop.
        const ro = new ResizeObserver(measure);

        ro.observe(container);

        return () => ro.disconnect();
      } catch {
        // Page load errors are already surfaced by pdf-editor; skip
        // overlay for this page.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [container, currentPage, pdfDocument, zoom]);

  if (!container || !pageInfo || !pdfDocument) return null;

  // Filter W-9 schema fields to just the ones on the current page.
  const fieldsForPage: FormField[] = W9_SCHEMA.sections
    .flatMap((s) => s.fields)
    .filter((f) => f.rect.page === currentPage);

  if (fieldsForPage.length === 0) return null;

  // Overlay wrapper is absolute-positioned to cover the container. Its
  // pointer-events default to `none` when a pdf-composer tool is active
  // so tools like Draw / Highlight / Add Text can hit the underlying
  // Fabric canvas. Individual field elements re-enable pointer-events
  // on themselves via `pointer-events-auto` in the existing FormFieldOverlay
  // classes, but only when the wrapper allows it.
  const canInteract = activeTool === "select";

  return createPortal(
    <div
      aria-hidden={!canInteract}
      className="absolute inset-0 z-10"
      style={{
        pointerEvents: canInteract ? "auto" : "none",
      }}
    >
      <FormFieldOverlay fields={fieldsForPage} page={pageInfo} />
    </div>,
    container,
  );
}
