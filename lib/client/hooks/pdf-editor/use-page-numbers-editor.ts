"use client";

import type { Canvas as FabricCanvas, IText } from "fabric";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type {
  AddPageNumbersOptions,
  PageNumberFormat,
  PageNumberPosition,
} from "@/lib/client/pdf-editor/add-page-numbers";

import { useCallback, useEffect, useRef } from "react";

import { usePdfEditorStore } from "@/lib/client/stores";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

export type PageNumbersEventDetail = {
  options: AddPageNumbersOptions;
};

/**
 * Listens for `editor:add-page-numbers` (dispatched by `PageNumbersModal`).
 *
 * Behaviour change (2026-06-16): page numbers are now added as LIVE
 * editor overlays — one Fabric IText per page in the selected range —
 * instead of being stamped via pdf-lib and downloaded as a separate
 * file. The user sees the numbers immediately in the editor, can
 * move/edit/delete them like any other text object, and saves them
 * through the normal Save flow.
 *
 * Why: the previous "stamp + download" path forced the user out of
 * the editor and produced a parallel file they then had to re-upload
 * to keep working. Bundling page numbers into the editor's overlay
 * model removes that round-trip and means the watermark + page
 * numbers + user edits all save together as one document.
 *
 * Coordinate mapping: Fabric uses TOP-LEFT origin (Y grows downward),
 * PDF uses BOTTOM-LEFT origin (Y grows upward). We compute Fabric
 * positions from the PDF page dimensions directly — the existing
 * merge pipeline (`merge-pdf.ts`) handles the Y inversion on save.
 */
export function usePageNumbersEditor(fabricCanvas: FabricCanvas | null) {
  const currentPage = usePdfEditorStore((s) => s.currentPage);

  const isRunningRef = useRef(false);
  const stateRef = useRef({ currentPage, fabricCanvas });

  useEffect(() => {
    stateRef.current = { currentPage, fabricCanvas };
  }, [currentPage, fabricCanvas]);

  const handleAdd = useCallback(async (options: AddPageNumbersOptions) => {
    if (isRunningRef.current) return;

    const { currentPage: page, fabricCanvas: liveCanvas } = stateRef.current;
    const store = usePdfEditorStore.getState();
    const pdfDocument = store.pdfDocument;
    const pageCount = store.pageCount;

    if (!pdfDocument || pageCount === 0) {
      toast.error({
        title: "No PDF open",
        description: "Open a PDF before adding page numbers.",
      });

      return;
    }

    isRunningRef.current = true;
    const loadingKey = toast.loading({
      title: "Adding page numbers",
      description: "Placing numbers on each page.",
    });

    try {
      const first = Math.max(1, options.startPage ?? 1);
      const last = Math.min(pageCount, options.endPage ?? pageCount);

      if (first > last) {
        toast.close(loadingKey);
        toast.error({
          title: "Invalid range",
          description: "End page is before start page.",
        });

        return;
      }

      // Compute labels first so the totalN in "X of N" matches the
      // number of pages in the selected range (not the whole doc).
      const labelTotal = last - first + 1 + (options.startNumber - 1);

      // For text-width measurement we share one offscreen 2D context.
      const measureCtx = createMeasureContext(options.fontSize);

      const { IText: FabricIText } = await import("fabric");
      let added = 0;

      for (let p = first; p <= last; p++) {
        const n = options.startNumber + (p - first);
        const label = formatLabel(options.format, n, labelTotal);

        const { width: pageWidth, height: pageHeight } =
          await getPageBaseDimensions(pdfDocument, p);

        const textWidth = measureCtx
          ? measureCtx.measureText(label).width
          : label.length * options.fontSize * 0.55;

        const { left, top } = computeFabricPosition(
          options.position,
          pageWidth,
          pageHeight,
          textWidth,
          options.fontSize,
          options.margin,
        );

        const fillHex = rgbToHex(options.color);

        const props: Record<string, unknown> = {
          editorType: "pageNumber",
          fill: fillHex,
          fontFamily: "Helvetica",
          fontSize: options.fontSize,
          fontStyle: "normal",
          fontWeight: "normal",
          left,
          originX: "left",
          originY: "top",
          // Lock scaling so users don't accidentally distort the
          // number by dragging a corner handle.
          lockScalingX: true,
          lockScalingY: true,
          top,
        };

        // For the page currently mounted on the live canvas, add the
        // IText directly so the user sees it without navigating away
        // and back. For other pages we only write to `fabricJsonByPage`
        // — the IText materialises when the user navigates there.
        if (liveCanvas && p === page) {
          const textObj = new FabricIText(label, props as any) as IText;

          liveCanvas.add(textObj);
        }

        appendOverlayToStoredJson(p, label, props);
        added += 1;
      }

      // Force the live canvas to repaint + serialize the new state so
      // navigation away keeps the additions.
      if (liveCanvas) {
        liveCanvas.renderAll();
        const json = serializeForPage(liveCanvas);

        usePdfEditorStore.getState().saveFabricJson(page, json);
      }

      usePdfEditorStore.getState().markDocumentDirty();

      toast.close(loadingKey);
      toast.success({
        title: `Page numbers added to ${added} ${added === 1 ? "page" : "pages"}`,
        description:
          "Edit, move, or delete them like any other text. Save to persist.",
      });
    } catch (err) {
      logger.error("Failed to add page numbers", err);
      toast.close(loadingKey);
      toast.error({
        title: "Couldn't add page numbers",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      isRunningRef.current = false;
    }
  }, []);

  useEffect(() => {
    const onAdd = (event: Event) => {
      const detail = (event as CustomEvent<PageNumbersEventDetail>).detail;

      if (!detail?.options) return;

      void handleAdd(detail.options);
    };

    window.addEventListener("editor:add-page-numbers", onAdd);

    return () => {
      window.removeEventListener("editor:add-page-numbers", onAdd);
    };
  }, [handleAdd]);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function createMeasureContext(
  fontSize: number,
): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) return null;
  ctx.font = `${fontSize}px Helvetica, Arial, sans-serif`;

  return ctx;
}

async function getPageBaseDimensions(
  pdfDocument: PDFDocumentProxy,
  pageNum: number,
): Promise<{ width: number; height: number }> {
  const page = await pdfDocument.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });

  return { width: viewport.width, height: viewport.height };
}

function formatLabel(
  format: PageNumberFormat,
  n: number,
  total: number,
): string {
  switch (format) {
    case "n":
      return String(n);
    case "page-n":
      return `Page ${n}`;
    case "n-of-N":
      return `${n} of ${total}`;
    case "page-n-of-N":
      return `Page ${n} of ${total}`;
    case "n-slash-N":
      return `${n}/${total}`;
  }
}

function computeFabricPosition(
  position: PageNumberPosition,
  pageWidth: number,
  pageHeight: number,
  textWidth: number,
  fontSize: number,
  margin: number,
): { left: number; top: number } {
  // Fabric: Y grows downward (top-left origin). Top edge = margin.
  // Bottom edge = pageHeight - margin - fontSize so the text sits
  // entirely above the margin line.
  const top = position.startsWith("top")
    ? margin
    : pageHeight - margin - fontSize;

  if (position.endsWith("left")) return { left: margin, top };
  if (position.endsWith("right")) {
    return { left: Math.max(margin, pageWidth - margin - textWidth), top };
  }

  return { left: Math.max(margin, (pageWidth - textWidth) / 2), top };
}

function rgbToHex(c: { r: number; g: number; b: number }): string {
  const to = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * 255)))
      .toString(16)
      .padStart(2, "0");

  return `#${to(c.r)}${to(c.g)}${to(c.b)}`;
}

function appendOverlayToStoredJson(
  displayPage: number,
  text: string,
  props: Record<string, unknown>,
): void {
  const store = usePdfEditorStore.getState();
  const existing = store.getFabricJson(displayPage);

  // Construct the Fabric IText object literal that `mergeFabricEditsIntoPdf`
  // recognises. Mirroring the serialization shape Fabric emits on
  // `canvas.toJSON()`. Keep the keyset minimal — extra keys are ignored
  // by the merge pipeline, missing keys would force `parseFabricJson` to
  // null out.
  const itextObject = {
    type: "i-text",
    version: "6.0.0",
    text,
    ...props,
  };

  if (!existing) {
    // No prior canvas state for this page — write a fresh minimal
    // doc that the merge pipeline can read. Width/height of 0 would
    // cause parseFabricJson to return null — leave them undefined
    // and merge falls back to source dims.
    const fresh = JSON.stringify({
      version: "6.0.0",
      objects: [itextObject],
    });

    store.saveFabricJson(displayPage, fresh);

    return;
  }

  try {
    const parsed = JSON.parse(existing) as {
      objects?: unknown[];
      [key: string]: unknown;
    };

    parsed.objects = [...(parsed.objects ?? []), itextObject];
    store.saveFabricJson(displayPage, JSON.stringify(parsed));
  } catch {
    // Bad JSON in store — overwrite with a fresh doc that at least
    // carries the new overlay.
    store.saveFabricJson(
      displayPage,
      JSON.stringify({ version: "6.0.0", objects: [itextObject] }),
    );
  }
}

function serializeForPage(canvas: FabricCanvas): string {
  // Reuse the same shape `saveFabricCanvas` produces so the merge
  // pipeline can round-trip cleanly. Keep this minimal — full
  // `serializeFabricCanvas` lives in save-utils but we don't want a
  // cyclic dep just for that.
  return JSON.stringify(canvas.toJSON());
}
