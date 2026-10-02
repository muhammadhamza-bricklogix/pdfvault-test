"use client";

import type { FormField } from "@/lib/shared/types/forms.types";
import type { RenderedPageInfo } from "./FormCanvas";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { FormFieldOverlay } from "@/components/sections/forms/FormFieldOverlay";
import { DS_11_SCHEMA } from "@/lib/client/forms/ds-11-schema";
import { usePdfEditorStore } from "@/lib/client/stores";

/** Every DS-11 widget sits on PDF page 5 or 6; pages 1-4 are instructions. */
const FORM_PAGES = [5, 6];

/**
 * Renders the DS-11 fill overlays as a portaled layer on top of
 * `<PdfViewerCanvas />`, matching the W-9 and 1099-NEC architecture:
 * the user types directly onto the document, yellow marks what is editable.
 *
 * Simpler than the 1099-NEC portal, which had to remap one set of fields onto
 * four identical copies. DS-11 has one application, so each field already
 * carries the page it belongs to.
 */
export function Ds11FormFieldsPortal() {
  const activeTool = usePdfEditorStore((s) => s.activeTool);
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const pdfDocument = usePdfEditorStore((s) => s.pdfDocument);
  const zoom = usePdfEditorStore((s) => s.zoom);

  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [pageInfo, setPageInfo] = useState<RenderedPageInfo | null>(null);

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
  if (!FORM_PAGES.includes(currentPage)) return null;

  const fieldsForPage: FormField[] = DS_11_SCHEMA.sections
    .flatMap((s) => s.fields)
    .filter((f) => f.rect.page === currentPage);

  if (fieldsForPage.length === 0) return null;

  const canInteract = activeTool === "select";

  return createPortal(
    <div
      aria-hidden={!canInteract}
      className="absolute inset-0 z-10"
      style={{ pointerEvents: canInteract ? "auto" : "none" }}
    >
      <FormFieldOverlay fields={fieldsForPage} page={pageInfo} />
    </div>,
    container,
  );
}
