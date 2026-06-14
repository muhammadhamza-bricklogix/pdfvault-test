"use client";

import type { Canvas, IText } from "fabric";
import type { PDFPageProxy } from "pdfjs-dist";

import { useEffect, useRef } from "react";

import {
  extractFontData,
  extractTextBlocks,
  type TextBlock,
} from "@/lib/client/pdf-editor/text-extraction";
import { usePdfEditorStore } from "@/lib/client/stores";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

type UseEditTextModeParams = {
  fabricCanvas: Canvas | null;
  page: PDFPageProxy | null;
};

/**
 * On-demand text replacement (driven by the "Edit Text" toolbar tool):
 *
 * 1. By default the PDF canvas paints text natively — works on every
 *    browser, including older iOS Safari WebKit where pdf.js's
 *    `getTextContent` throws.
 * 2. When the user activates the "Edit Text" tool for a page that hasn't
 *    been extracted yet, this hook extracts ALL text blocks and places
 *    them as Fabric.js IText objects using pdf.js's embedded fonts.
 * 3. After successful extraction we call `markPageExtracted(sourcePage)`,
 *    which flips `suppressText` on in `usePageRenderer` so the native
 *    pdf.js text stops painting (avoids glyph doubling). The Fabric
 *    IText layer now owns text rendering and accepts click-to-edit.
 * 4. If extraction throws (older iOS Safari), we revert `activeTool` to
 *    "select" + toast the user. The page stays readable via native
 *    pdf.js text since `suppressText` was never flipped on.
 * 5. Once a page is extracted, IText survives tool switches — users can
 *    still tap any sentence to edit even after switching to Select etc.
 */
export function useEditTextMode({ fabricCanvas, page }: UseEditTextModeParams) {
  const activeTool = usePdfEditorStore((s) => s.activeTool);
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  // Key the cache by SOURCE page index, not display slot — otherwise a page
  // reorder via the thumbnail strip serves stale text from the previously
  // selected slot. Pulled via getSourcePageIndex which respects pageOrder.
  const getSourcePageIndex = usePdfEditorStore((s) => s.getSourcePageIndex);

  // Cache extracted text blocks per SOURCE page (stable across reorder).
  const blocksCacheRef = useRef<Map<number, TextBlock[]>>(new Map());

  // Clear cache on file change
  const file = usePdfEditorStore((s) => s.file);

  useEffect(() => {
    blocksCacheRef.current.clear();
  }, [file]);

  useEffect(() => {
    if (!fabricCanvas || !page) return;

    let cancelled = false;
    const sourcePage = getSourcePageIndex(currentPage);
    const alreadyExtracted = usePdfEditorStore
      .getState()
      .extractedPages.has(sourcePage);

    // Only run when the user has explicitly armed text editing for this
    // page (via the "Edit Text" toolbar tool), OR when we're returning
    // to a page we've already extracted (so the rotation-mismatch reset
    // below can re-extract if Manage Pages rotated the page).
    if (!alreadyExtracted && activeTool !== "editText") return;

    const setup = async () => {
      const existingEditText = fabricCanvas
        .getObjects()
        .filter((obj) => (obj as any).editorType === "editModeText");

      // If existing overlays were extracted for a DIFFERENT page rotation
      // (user rotated the page in Manage Pages between sessions), their
      // angle/position is stale — strip them so the extraction below
      // re-creates the overlay matching the page's current rotation.
      const currentRotation = (page.rotate ?? 0) as number;
      const overlaysMatchRotation =
        existingEditText.length === 0 ||
        existingEditText.every(
          (obj) => ((obj.angle as number | undefined) ?? 0) === currentRotation,
        );

      if (existingEditText.length > 0 && overlaysMatchRotation) {
        return;
      }

      if (existingEditText.length > 0 && !overlaysMatchRotation) {
        for (const obj of existingEditText) {
          fabricCanvas.remove(obj);
        }
        fabricCanvas.renderAll();
        // Don't reuse the cache either — block positions there were for the
        // previous rotation.
        blocksCacheRef.current.delete(sourcePage);
      }

      // Extract text blocks (with caching by source page)
      let blocks: TextBlock[];
      const cached = blocksCacheRef.current.get(sourcePage);

      if (cached) {
        blocks = cached;
        logger.info("[PDFedits] text: cache-hit", {
          sourcePage,
          blocks: blocks.length,
        });
      } else {
        try {
          blocks = await extractTextBlocks(page);
        } catch (err) {
          // Inline message + stack so they're visible without expanding the
          // Error object — mobile devtools often won't surface those props.
          logger.error("[PDFedits] text: extract failed", {
            sourcePage,
            message: err instanceof Error ? err.message : String(err),
            name: err instanceof Error ? err.name : undefined,
            stack: err instanceof Error ? err.stack : undefined,
            err,
          });

          // pdf.js `getTextContent` can throw on older iOS Safari WebKit
          // ("undefined is not a function (near '...t of e...')"). When
          // that happens we revert to Select so the page keeps painting
          // text natively (suppressText stays false — we never marked
          // this page extracted), and toast the user.
          if (usePdfEditorStore.getState().activeTool === "editText") {
            usePdfEditorStore.getState().setActiveTool("select");
            toast.error({
              title: "Text editing not supported on this browser",
              description:
                "Your browser version can't load the editable text layer for this PDF.",
            });
          }

          return;
        }

        if (cancelled) return;

        blocksCacheRef.current.set(sourcePage, blocks);
        logger.info("[PDFedits] text: extract ok", {
          sourcePage,
          blocks: blocks.length,
        });

        // Extract and store font binary data for the export pipeline
        const fontNames = new Set(blocks.map((b) => b.fontFamily));
        const fonts = extractFontData(page, fontNames);

        if (fonts.length > 0) {
          usePdfEditorStore.getState().addFontData(fonts);
        }
      }

      if (blocks.length === 0) {
        logger.warn("[PDFedits] text: no blocks (scanned PDF?)", {
          sourcePage,
        });
        const isCreatedBlank =
          (file as (File & { __createdBlank?: boolean }) | null)
            ?.__createdBlank === true;

        if (!isCreatedBlank) {
          toast.info({
            description: "This page may be scanned or contain only images.",
            title: "No editable text found",
          });
        }

        return;
      }

      const { IText: FabricIText } = await import("fabric");

      if (cancelled) return;

      // Wait for pdf.js's embedded fonts to finish loading before drawing.
      // iOS Safari paints `fillText` with no glyphs when the requested font
      // is still in `loading` state, producing a blank text overlay even
      // though shapes / table borders (rendered by the PDF canvas itself)
      // remain visible. Chrome usually has fonts ready by this point, so
      // this is essentially a no-op there.
      if (typeof document !== "undefined" && document.fonts) {
        try {
          await document.fonts.ready;
        } catch {
          // Font loading failed for some face — fall through; resolved fonts
          // for the rest of the page will still render.
        }

        if (cancelled) return;
      }

      // Place ALL text blocks as IText objects with real embedded fonts.
      // For rotated pages, Fabric `angle` rotates the IText around its
      // top-left anchor — we adjust (left, top) so the visual baseline-left
      // of the rotated bounding box lands at the same pixel that the upright
      // case used (block.x, block.y + block.height).
      for (const block of blocks) {
        const h = block.height;
        let left = block.x;
        let top = block.y;

        if (block.rotation === 90) {
          left = block.x + h;
          top = block.y + h;
        } else if (block.rotation === 180) {
          left = block.x;
          top = block.y + 2 * h;
        } else if (block.rotation === 270) {
          left = block.x - h;
          top = block.y + h;
        }

        const textObj = new FabricIText(block.text, {
          angle: block.rotation,
          editorType: "editModeText",
          fill: block.color,
          fontFamily: block.fontFamily,
          fontSize: block.fontSize,
          fontStyle: block.fontStyle,
          fontWeight: block.fontWeight,
          left,
          objectCaching: false,
          originX: "left",
          originY: "top",
          // Store original PDF text width for accurate export spacing
          pdfTextWidth: block.width,
          top,
        } as any) as IText;

        fabricCanvas.add(textObj);
      }

      fabricCanvas.renderAll();
      // Flip suppressText on for this page (via PdfViewerCanvas reading
      // extractedPages) now that IText is on the canvas — order matters
      // so the user never sees a blank frame between "native pdf.js text
      // disappears" and "Fabric IText appears".
      usePdfEditorStore.getState().markPageExtracted(sourcePage);
      logger.info("[PDFedits] text: drew IText", {
        sourcePage,
        count: blocks.length,
        sampleFont: blocks[0]?.fontFamily,
      });
    };

    setup();

    // Belt-and-braces re-render when any additional font finishes loading
    // after the initial paint. pdf.js can lazy-load fonts mid-page on iOS
    // Safari, leaving the first paint with blank glyphs for those runs.
    const onFontsLoadingDone = () => {
      if (cancelled || !fabricCanvas) return;

      for (const obj of fabricCanvas.getObjects()) {
        if ((obj as any).editorType === "editModeText") {
          obj.dirty = true;
        }
      }
      fabricCanvas.renderAll();
    };

    document.fonts?.addEventListener?.("loadingdone", onFontsLoadingDone);

    return () => {
      cancelled = true;
      document.fonts?.removeEventListener?.("loadingdone", onFontsLoadingDone);
    };
  }, [fabricCanvas, page, currentPage, activeTool, getSourcePageIndex]);
}
