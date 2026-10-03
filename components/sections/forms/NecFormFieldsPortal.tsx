"use client";

import type { FormField } from "@/lib/shared/types/forms.types";
import type { RenderedPageInfo } from "./FormCanvas";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { FormFieldOverlay } from "@/components/sections/forms/FormFieldOverlay";
import { NecCopyMirror } from "@/components/sections/forms/NecCopyMirror";
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
 *   - Only Copy A (page 2) is editable. Copies 1, B and 2 (pages 3, 4 and
 *     6) mirror its values as plain read-only text via `NecCopyMirror`, so
 *     the user can see every copy is populated without being offered four
 *     places to edit one underlying value (QA 2026-10-04). The stamper
 *     writes the values onto all four copies on save/download.
 */
const COPY_A_PAGE = 2;
/** Copy A, Copy 1, Copy B, Copy 2. Pages 1 and 5 are IRS instructions. */
const COPY_PAGES = [COPY_A_PAGE, 3, 4, 6];

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

  if (!COPY_PAGES.includes(currentPage)) return null;

  const isCopyA = currentPage === COPY_A_PAGE;
  // The schema is authored against Copy A; the other copies share its
  // geometry bar two exceptions the IRS prints differently.
  const fieldsForPage: FormField[] = NEC_1099_SCHEMA.sections
    .flatMap((s) => s.fields)
    .filter((f) => {
      // The 2nd TIN notice exists only on Copy A.
      if (f.id === "second_tin_notice" && !isCopyA) return false;
      // Copy B (page 4) has no VOID box.
      if (f.id === "is_void" && currentPage === 4) return false;

      return true;
    })
    .map((f) => ({
      ...f,
      rect: {
        ...f.rect,
        page: currentPage,
        // On Copies 1, B and 2 the account-number cell runs full width.
        ...(f.id === "account_number" && !isCopyA ? { w: 241.8 } : {}),
      },
    }));

  if (fieldsForPage.length === 0) return null;

  // Copies 1, B and 2 are never interactive, whatever tool is selected.
  const canInteract = isCopyA && activeTool === "select";

  return createPortal(
    <div
      aria-hidden={!canInteract}
      className="absolute inset-0 z-10"
      style={{
        pointerEvents: canInteract ? "auto" : "none",
      }}
    >
      {isCopyA ? (
        <FormFieldOverlay fields={fieldsForPage} page={pageInfo} />
      ) : (
        <NecCopyMirror fields={fieldsForPage} page={pageInfo} />
      )}
    </div>,
    container,
  );
}
