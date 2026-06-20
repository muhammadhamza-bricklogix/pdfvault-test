"use client";

import type { Canvas, Textbox } from "fabric";
import type { PDFPageProxy } from "pdfjs-dist";

import { useEffect, useRef } from "react";

import { installFabricCustomizations } from "@/lib/client/pdf-editor/fabric-customizations";
import {
  extractFontData,
  extractTextBlocks,
  type TextBlock,
  waitForFontFamily,
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
  // Pages where extraction threw (older iOS Safari WebKit `getTextContent`).
  // Once a source page lands here we don't retry — otherwise every tool
  // switch / page navigation would re-fire the error toast.
  const failedPagesRef = useRef<Set<number>>(new Set());

  // Clear caches on file change
  const file = usePdfEditorStore((s) => s.file);

  useEffect(() => {
    blocksCacheRef.current.clear();
    failedPagesRef.current.clear();
  }, [file]);

  // Install Fabric custom-property serialization patch once at mount. Without
  // this, `canvas.toJSON()` drops `originalText` / `originalLeft` / `pristine`
  // / `editorType`, breaking the merge pipeline's "did the user actually
  // modify source text?" detection and forcing every editModeText page into
  // the rasterise branch. See `fabric-customizations.ts` for the full story.
  useEffect(() => {
    void installFabricCustomizations();
  }, []);

  useEffect(() => {
    if (!fabricCanvas || !page) return;

    let cancelled = false;
    const sourcePage = getSourcePageIndex(currentPage);
    const alreadyExtracted = usePdfEditorStore
      .getState()
      .extractedPages.has(sourcePage);

    // Trigger extraction in two cases:
    //   1. User explicitly armed text editing via the "Edit Text" tool.
    //   2. Default Select tool on a fresh load — so users can click any
    //      run on the page and have it act as a Fabric object straight
    //      away (no Edit Text → click → Select toggle dance).
    // Already-extracted pages still flow through so the rotation-mismatch
    // reset below can re-extract if Manage Pages rotated the page.
    if (
      !alreadyExtracted &&
      activeTool !== "editText" &&
      activeTool !== "select"
    ) {
      return;
    }

    // If `getTextContent` previously threw on this page (older Safari
    // WebKit), don't retry — the user has already seen the toast and
    // native pdf.js text is still painting the page.
    if (!alreadyExtracted && failedPagesRef.current.has(sourcePage)) return;

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
          // ("undefined is not a function (near '...t of e...')"). Mark
          // this source page as failed so we don't retry on every tool
          // switch / page navigation, then revert from Edit Text to
          // Select (no-op if already on Select via auto-extract). Native
          // pdf.js text keeps painting because suppressText was never
          // flipped on. The raw error message is included so users can
          // share it for diagnosis.
          failedPagesRef.current.add(sourcePage);
          if (usePdfEditorStore.getState().activeTool === "editText") {
            usePdfEditorStore.getState().setActiveTool("select");
          }

          const rawMsg = err instanceof Error ? err.message : String(err ?? "");
          const truncated =
            rawMsg.length > 160 ? `${rawMsg.slice(0, 157)}…` : rawMsg;

          toast.error({
            title: "Text editing not supported on this browser",
            description: truncated
              ? `Reason: ${truncated}`
              : "The text layer couldn't be loaded for this PDF.",
          });

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

      const { Textbox: FabricTextbox } = await import("fabric");

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

      // Per-family wait for any font referenced by the text blocks
      // that hasn't yet reached `loaded` state. pdf.js can lazy-load
      // fonts as it streams the page, so `document.fonts.ready` alone
      // isn't sufficient — it resolves on the INITIAL font set. Without
      // this, the first paint of the IText overlay shows Helvetica
      // fallback (the "fonts change when I click Edit Text" report
      // 2026-06-16); the per-family wait makes the swap visually
      // identical to the pdf.js native rendering it replaces.
      const uniqueFamilies = Array.from(
        new Set(blocks.map((b) => b.fontFamily).filter(Boolean)),
      );

      await Promise.all(uniqueFamilies.map((f) => waitForFontFamily(f, 2000)));

      if (cancelled) return;

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

        const textObj = new FabricTextbox(block.text, {
          angle: block.rotation,
          editorType: "editModeText",
          // `pristine: true` is a fast-path hint cleared by
          // `useEditorHistory` on `object:modified` / `text:changed`.
          // The merge pipeline DOES NOT rely on it alone any more —
          // Fabric's `toJSON()` can drop the boolean on round-trip.
          // The robust signal the merge uses is `text !== originalText`
          // (and `left !== originalLeft`, `top !== originalTop`) —
          // those are always preserved because pdf-lib's serialiser
          // handles strings + numbers reliably.
          pristine: true,
          originalText: block.text,
          originalLeft: left,
          originalTop: top,
          // Snapshot the source-text's bounding box at extraction time.
          // The merge pipeline uses this to whiteout the original text
          // BEFORE drawing the user's modified Textbox on top, so the
          // page stays text-editable on reload (no rasterisation) AND
          // the edit replaces — not stacks on top of — the source word.
          // `block.width` is the pdf.js advance width (good proxy);
          // `block.height` is the font cap-height.
          originalWidth: block.width,
          originalHeight: block.height,
          fill: block.color,
          fontFamily: block.fontFamily,
          fontSize: block.fontSize,
          fontStyle: block.fontStyle,
          fontWeight: block.fontWeight,
          left,
          // Off-limits per CLAUDE.md — keep caching off.
          objectCaching: false,
          originX: "left",
          originY: "top",
          // Store original PDF text width for accurate export spacing.
          pdfTextWidth: block.width,
          // Textbox uses `width` as the wrap point — fixed at the source
          // run's advance width so typed text wraps inside the box
          // instead of overflowing the original glyph bounds.
          //
          // `splitByGrapheme: true` (NOT false) — extracted runs are
          // often short single words ("Hello", "Page", "Total"), so
          // word-wrap has nothing to break on; appending characters then
          // overflows the page horizontally because no whitespace gets
          // introduced. Grapheme wrap guarantees containment regardless
          // of the typed content's whitespace, and is also the correct
          // wrap mode for CJK if/when extraction supports it. drawIText
          // reads `_textLines` to round-trip wrapped lines through save.
          splitByGrapheme: true,
          top,
          width: Math.max(8, block.width),
        } as any) as Textbox;

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
