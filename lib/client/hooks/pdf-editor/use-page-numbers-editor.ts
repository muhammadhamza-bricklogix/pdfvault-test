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

      // Remove any existing page-number overlays before adding the
      // new set. Without this, every "Add" pressed on the modal
      // ACCUMULATES page numbers — open it twice and you end up with
      // two sets of numbers on each page (different positions /
      // formats / colours). Users expect "Add" to REPLACE the current
      // page numbers, not stack new ones on top.
      removeExistingPageNumbers(liveCanvas, page);

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

        const { left, top, originX } = computeFabricPosition(
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
          // Row 97 QA 2026-10-04: originX varies by chosen alignment so
          // right/center page numbers anchor on the real page edge
          // minus margin, instead of relying on an offline
          // measureText() that often disagrees with Fabric's internal
          // glyph width (different font fallback → drift of several px
          // per char at large font sizes).
          originX,
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

        // Row 98 QA 2026-10-04: non-current pages had their fresh JSON
        // created WITHOUT width/height, so (a) `parseFabricJson` in
        // the merge pipeline returned null and skipped the overlay on
        // export, and (b) `loadFromJSON` on page navigation left the
        // Fabric canvas at default dimensions and the IText rendered
        // off-screen. Pass the real pdf.js page dimensions so stored
        // JSON round-trips correctly through both merge and loadFromJSON.
        appendOverlayToStoredJson(p, label, props, pageWidth, pageHeight);
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

  const handleRemove = useCallback(() => {
    const { currentPage: page, fabricCanvas: liveCanvas } = stateRef.current;
    const store = usePdfEditorStore.getState();
    const pdfDocument = store.pdfDocument;

    if (!pdfDocument) {
      toast.error({
        title: "No PDF open",
        description: "Open a PDF before removing page numbers.",
      });

      return;
    }

    const removed = removeExistingPageNumbers(liveCanvas, page);

    if (removed === 0) {
      toast.info({
        title: "No page numbers to remove",
        description: "This document has no page-number overlays.",
      });

      return;
    }

    store.markDocumentDirty();

    toast.success({
      title: `Removed page numbers from ${removed} ${removed === 1 ? "page" : "pages"}`,
      description: "Save to persist.",
    });
  }, []);

  useEffect(() => {
    const onAdd = (event: Event) => {
      const detail = (event as CustomEvent<PageNumbersEventDetail>).detail;

      if (!detail?.options) return;

      void handleAdd(detail.options);
    };

    const onRemove = () => {
      handleRemove();
    };

    window.addEventListener("editor:add-page-numbers", onAdd);
    window.addEventListener("editor:remove-page-numbers", onRemove);

    return () => {
      window.removeEventListener("editor:add-page-numbers", onAdd);
      window.removeEventListener("editor:remove-page-numbers", onRemove);
    };
  }, [handleAdd, handleRemove]);
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
  _textWidth: number,
  fontSize: number,
  margin: number,
): { left: number; top: number; originX: "left" | "center" | "right" } {
  // Fabric: Y grows downward (top-left origin). Top edge = margin.
  // Bottom edge = pageHeight - margin - fontSize so the text sits
  // entirely above the margin line.
  const top = position.startsWith("top")
    ? margin
    : pageHeight - margin - fontSize;

  // Row 97 QA 2026-10-04: switch to origin-based positioning so
  // Fabric itself anchors the text to the chosen edge. originX="right"
  // + left=(pageWidth - margin) means Fabric aligns the text's RIGHT
  // edge exactly `margin` away from the page's right edge, regardless
  // of browser-canvas text measurement vs Fabric glyph measurement.
  if (position.endsWith("left")) {
    return { left: margin, top, originX: "left" };
  }
  if (position.endsWith("right")) {
    return { left: pageWidth - margin, top, originX: "right" };
  }

  return { left: pageWidth / 2, top, originX: "center" };
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
  pageWidth: number,
  pageHeight: number,
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
    // doc with REAL width/height (not undefined). parseFabricJson
    // explicitly returns null on `!parsed.width || !parsed.height`
    // (see save-utils.ts:173), which is what made page numbers
    // appear only on the current page before — Fabric's live
    // addition always had dimensions, but non-current pages wrote
    // dimension-less JSON that both the merge pipeline and the
    // on-navigate loadFromJSON silently dropped. Row 98 QA
    // 2026-10-04.
    const fresh = JSON.stringify({
      version: "6.0.0",
      width: pageWidth,
      height: pageHeight,
      objects: [itextObject],
    });

    store.saveFabricJson(displayPage, fresh);

    return;
  }

  try {
    const parsed = JSON.parse(existing) as {
      width?: number;
      height?: number;
      objects?: unknown[];
      [key: string]: unknown;
    };

    parsed.objects = [...(parsed.objects ?? []), itextObject];
    // Backfill width/height if the existing JSON predates the row
    // 98 fix and would still null-out in parseFabricJson.
    if (!parsed.width) parsed.width = pageWidth;
    if (!parsed.height) parsed.height = pageHeight;
    store.saveFabricJson(displayPage, JSON.stringify(parsed));
  } catch {
    // Bad JSON in store — overwrite with a fresh doc that at least
    // carries the new overlay.
    store.saveFabricJson(
      displayPage,
      JSON.stringify({
        version: "6.0.0",
        width: pageWidth,
        height: pageHeight,
        objects: [itextObject],
      }),
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

/**
 * Strips every `editorType: "pageNumber"` overlay from BOTH the live
 * canvas (so the user immediately sees the old number disappear) and
 * from `fabricJsonByPage` for every page (so navigating away/back
 * doesn't surface stale numbers). Called at the top of `handleAdd` so
 * "Add" is replace-not-append.
 */
function removeExistingPageNumbers(
  liveCanvas: FabricCanvas | null,
  currentDisplayPage: number,
): number {
  const affectedPages = new Set<number>();

  // 1. Remove from the live canvas so the current page repaints clean.
  if (liveCanvas) {
    const toRemove = liveCanvas
      .getObjects()
      .filter(
        (obj) => (obj as { editorType?: string }).editorType === "pageNumber",
      );

    for (const obj of toRemove) {
      liveCanvas.remove(obj);
    }
    if (toRemove.length) {
      liveCanvas.renderAll();
      affectedPages.add(currentDisplayPage);
    }
  }

  // 2. Strip page-number objects from every stored page's JSON.
  const store = usePdfEditorStore.getState();
  const map = store.fabricJsonByPage;

  if (map instanceof Map && map.size > 0) {
    // Array.from for TS `--target` compatibility on Map iteration.
    Array.from(map.entries()).forEach(([page, json]) => {
      if (!json) return;
      try {
        const parsed = JSON.parse(json) as {
          objects?: { editorType?: string }[];
          [k: string]: unknown;
        };
        const objects = parsed.objects ?? [];
        const filtered = objects.filter((o) => o.editorType !== "pageNumber");

        if (filtered.length === objects.length) return;

        const next = { ...parsed, objects: filtered };

        store.saveFabricJson(page, JSON.stringify(next));
        affectedPages.add(page);
      } catch {
        // Bad JSON — leave it alone. Next save will overwrite via the
        // live-canvas flush anyway.
      }
    });
  }

  // 3. If we ALSO have the live canvas, flush it to overwrite the
  // current page's stored JSON with the now-clean canvas state.
  if (liveCanvas) {
    store.saveFabricJson(
      currentDisplayPage,
      JSON.stringify(liveCanvas.toJSON()),
    );
  }

  return affectedPages.size;
}
