"use client";

import type { FormField } from "@/lib/shared/types/forms.types";
import type { RenderedPageInfo } from "./FormCanvas";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { FormFieldOverlay } from "@/components/sections/forms/FormFieldOverlay";
import { NEC_1099_SCHEMA } from "@/lib/client/forms/1099-nec-schema";
import { usePdfEditorStore } from "@/lib/client/stores";

/**
 * Renders the 1099-NEC form-fill overlays (yellow highlighted text inputs,
 * checkboxes, numbers) as a portaled layer on top of the `<PdfViewerCanvas />`.
 *
 * This matches the W-9 architecture (`W9FormFieldsPortal`):
 *   - The user edits directly on the PDF document.
 *   - Yellow highlight indicates editable boxes.
 *   - Clicking any box focuses and types right into the document.
 *   - No separate input sidebar.
 *   - Works on Copy A (page 2), Copy 1 (page 3), Copy B (page 4), and Copy 2 (page 6).
 */
export function NecFormFieldsPortal() {
  const activeTool = usePdfEditorStore((s) => s.activeTool);
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const pdfDocument = usePdfEditorStore((s) => s.pdfDocument);
  const zoom = usePdfEditorStore((s) => s.zoom);

  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [pageInfo, setPageInfo] = useState<RenderedPageInfo | null>(null);

  // Look up the canvas wrapper in the DOM
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

  useEffect(() => {
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

        const ro = new ResizeObserver(measure);

        ro.observe(container);

        return () => ro.disconnect();
      } catch {
        // Page load errors handled by viewer
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [container, currentPage, pdfDocument, zoom]);

  if (!container || !pageInfo || !pdfDocument) return null;

  // Form 1099-NEC has Copy A on page 2, Copy 1 on page 3, Copy B on page 4, Copy 2 on page 6.
  // The layout geometry across all four copies is identical.
  const isFormPage = [2, 3, 4, 6].includes(currentPage);

  if (!isFormPage) return null;

  const fieldsForPage: FormField[] = NEC_1099_SCHEMA.sections
    .flatMap((s) => s.fields)
    .filter((f) => {
      // 2nd TIN notice checkbox only exists on Copy A (Page 2)
      if (f.id === "second_tin_notice" && currentPage !== 2) {
        return false;
      }
      // VOID checkbox does not exist on Copy B (Page 4)
      if (f.id === "is_void" && currentPage === 4) {
        return false;
      }

      return true;
    })
    .map((f) => {
      // On Copies 1, B, and 2 (Pages 3, 4, 6), account_number takes the full width of the cell
      if (f.id === "account_number" && currentPage !== 2) {
        return {
          ...f,
          rect: { ...f.rect, page: currentPage, w: 241.8 },
        };
      }

      return {
        ...f,
        rect: { ...f.rect, page: currentPage },
      };
    });

  if (fieldsForPage.length === 0) return null;

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
