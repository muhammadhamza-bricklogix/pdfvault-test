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

    // QA 2026-09-16: re-enabled auto-extract on the default Select tool
    // so users can select / tap text the moment a PDF opens, without
    // first activating "Edit Text" from the toolbar. Extraction still
    // runs on `editText` too (unchanged); the new branch is the
    // `select` allowance below.
    //
    // Known trade-off (see 2026-06-24 revert): the colour extractor's
    // zip-by-index fallback can render white-on-coloured-background
    // text (e.g. a white heading on a red banner) as black on load
    // for pages where graphics-state-driven colouring drifts from the
    // extracted colour array. If that regression comes back the fix
    // belongs in `extractSequentialTextColors` (make the fallback
    // colour-aware) rather than reverting this gate again — QA's
    // "text isn't selectable until Edit is clicked" report is a
    // higher-priority UX issue than the colour edge case.
    // Routes that pair a specialised form-fill overlay with the shared
    // `<PdfEditorShell />` (currently the W-9 route via `W9EditorBootstrap`)
    // opt out of Select-tool auto-extract by setting
    // `disableAutoTextExtract`. Users on those routes interact through
    // the form field overlays — not by tapping source text — and any
    // pixel-level mismatch between Fabric IText and pdf.js's native paint
    // reads as visible glyph doubling on the pre-printed template. The
    // opt-out restores the pre-9284eb9 (2026-09-16) behaviour for those
    // routes without affecting `/pdf-composer` (QA 2026-09-16: text
    // selectable on open stays intact). Explicit Edit Text activation
    // still triggers extraction even when the opt-out is on.
    const disableAutoExtract =
      usePdfEditorStore.getState().disableAutoTextExtract;
    const armedForExtraction =
      activeTool === "editText" ||
      (activeTool === "select" && !disableAutoExtract);

    if (!alreadyExtracted && !armedForExtraction) return;

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
        // Defensive: `existingEditText` was added by a PREVIOUS run of
        // this effect (fabricCanvas / page / currentPage dep re-fire)
        // that may have been cancelled between the add-loop and
        // `markPageExtracted` — leaving IText on the canvas without
        // flipping `suppressText`. That combination re-introduces the
        // "pdf.js native text under Fabric IText" doubling this hook is
        // meant to prevent. Restoring the invariant here is a no-op when
        // `alreadyExtracted === true` (markPageExtracted early-returns)
        // and self-heals the race when it isn't.
        if (!alreadyExtracted) {
          usePdfEditorStore.getState().markPageExtracted(sourcePage);
        }

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
          const activeToolAtFailure = usePdfEditorStore.getState().activeTool;

          if (activeToolAtFailure === "editText") {
            usePdfEditorStore.getState().setActiveTool("select");
          }

          // Row 29: pages inserted via Manage Pages can throw
          // `getTextContent failed: ... sendWithStream` on first entry to
          // Edit Text. Prior behaviour showed a scary "Text editing not
          // supported on this browser" error toast on every page nav where
          // extraction failed — on a logged-in user editing a freshly
          // added blank page this disrupts the UI for a transient
          // per-page failure, not a browser capability issue.
          //
          // New policy:
          //  - Auto-extract on the default Select tool (QA 2026-09-16):
          //    swallow silently. Native pdf.js text still paints and the
          //    user never asked for the overlay, so no toast is needed.
          //  - Explicit Edit Text activation: show a quiet info toast
          //    telling the user editing isn't available on THIS page, not
          //    the dire browser-support error.
          if (activeToolAtFailure === "editText") {
            toast.info({
              title: "Text editing unavailable on this page",
              description:
                "This page's text layer couldn't be read. Try another page or re-open the file.",
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
        const typedFile = file as
          | (File & { __createdBlank?: boolean; __createdFromImage?: boolean })
          | null;
        const isCreatedBlank = typedFile?.__createdBlank === true;
        // Row 73/79: image-to-PDF uploads (jpg/png → PDF) are rasterised
        // pages by design; the "No editable text found" info toast is
        // misleading on them because the user never asked for editable
        // text. uploadAsPdf tags the File when it ran a jpg/png
        // conversion; honour that tag the same way blank-created PDFs
        // are honoured above.
        const isCreatedFromImage = typedFile?.__createdFromImage === true;

        if (!isCreatedBlank && !isCreatedFromImage) {
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
          // Match pdf.js's cap-height paint. Fabric Textbox defaults
          // `lineHeight` to 1.16, so every extracted run visibly grew
          // ~16% the moment Edit-Text activated — combined with the
          // 2026-07-22 width bump, headings could still wrap to a
          // second line because the taller-than-source glyphs pushed
          // the last character over the box edge, and the user
          // perceived it as "size changed on click." `lineHeight: 1`
          // aligns the overlay's rendered baseline metrics with
          // pdf.js's native paint. Merge pipeline unaffected — pdf-lib
          // uses `fontSize` directly at export, never `lineHeight`.
          lineHeight: 1,
          left,
          // Off-limits per CLAUDE.md — keep caching off.
          objectCaching: false,
          originX: "left",
          originY: "top",
          // Store original PDF text width for accurate export spacing.
          pdfTextWidth: block.width,
          // Reverted 2026-06-24 from `true` → `false`. Grapheme wrap
          // caused the very first render of source-extracted text to
          // truncate the last character: pdf.js's stored advance width
          // (`block.width`) sits ~1–5% under the Fabric-rendered
          // natural width because the embedded font's metrics differ
          // from the canvas-rasterised fallback. With per-grapheme
          // wrap, the overflow character (often a single letter at
          // the end of a heading) hopped to a hidden line 2 — you saw
          // "Architectur" instead of "Architecture" on the AWS-arch
          // banner. Word-wrap (`false`) lets the natural width spill a
          // pixel or two past the box rather than mangle the glyph
          // sequence — far better fidelity to the source. The
          // trade-off (typed single-word content can overflow the
          // page) is rare in source-text editing; the text TOOL
          // (PdfViewerCanvas) still uses `splitByGrapheme: true` for
          // newly-created text boxes where typing is the primary use.
          splitByGrapheme: false,
          top,
          width: Math.max(8, block.width),
        } as any) as Textbox;

        // Fabric Textbox wraps whenever its natural rendered width
        // exceeds `width`. `block.width` is pdf.js's advance width; the
        // browser canvas measures the freshly-loaded embedded font
        // ~1–5% wider than the advance, so headings and single-token
        // runs silently wrap onto a hidden second line INSIDE the box.
        // Because every overlay sits at its source coordinates, that
        // hidden line paints over the next run below → the "text
        // squeezed / stacked when Edit activates" user report
        // (2026-07-22).
        //
        // 2026-07-23: the original fix here called `textObj.calcTextWidth()`
        // to derive `natural`, but Fabric implements that method as
        // `max(getLineWidth(i))` over the ALREADY-WRAPPED lines. When
        // the string had already wrapped at `block.width`, the return
        // value was ≤ block.width and the bump never fired. The
        // Playwright probe `tests/uat/edit-text-height.spec.ts`
        // reproduced this on `back-end-infrastructure.pdf`: 36 / 61
        // overlays still wrapped despite the bump code being present.
        //
        // Fix: measure the raw un-wrapped string via a fresh
        // `HTMLCanvasElement.getContext("2d").measureText()` using the
        // same font stack we're about to render. That's independent of
        // Fabric's wrap state and gives the true glyph-run width. We
        // then bump `width` past that so the string fits on a single
        // visual line.
        //
        // Whiteout + export spacing keep using the pdf.js advance via
        // `originalWidth` / `pdfTextWidth`, so the merge pipeline is
        // untouched. Try/catch so a canvas API mismatch on any single
        // block falls back to today's behaviour instead of throwing.
        try {
          const measureCanvas = document.createElement("canvas");
          const ctx = measureCanvas.getContext("2d");

          if (ctx) {
            // Build a font shorthand identical to what Fabric will
            // paint with. Order: style, weight, size (px), family.
            const styleTok =
              block.fontStyle && block.fontStyle !== "normal"
                ? block.fontStyle
                : "";
            const weightTok =
              block.fontWeight && block.fontWeight !== "normal"
                ? String(block.fontWeight)
                : "";

            ctx.font = [
              styleTok,
              weightTok,
              `${block.fontSize}px`,
              block.fontFamily,
            ]
              .filter(Boolean)
              .join(" ");

            const natural = ctx.measureText(block.text).width;

            if (Number.isFinite(natural) && natural > block.width) {
              textObj.set(
                "width",
                Math.max(textObj.width ?? 0, Math.ceil(natural) + 2),
              );
              (textObj as any).initDimensions?.();
            }
          }
        } catch {
          // fall through — no worse than the pre-fix behaviour
        }

        fabricCanvas.add(textObj);
      }

      fabricCanvas.renderAll();
      // Flip suppressText on for this page (via PdfViewerCanvas reading
      // extractedPages) now that IText is on the canvas — order matters
      // so the user never sees a blank frame between "native pdf.js text
      // disappears" and "Fabric IText appears".
      usePdfEditorStore.getState().markPageExtracted(sourcePage);
      // QA 2026-10-03 row 1: snapshot handler for `object:added` in
      // `use-editor-history.ts` skips `editorType === "editModeText"` so
      // extraction doesn't flood the undo stack. But the mount-time
      // baseline captured by the history hook ran BEFORE extraction
      // (empty canvas). Replace it with the post-extraction state so
      // undoing all the way back lands on "extracted text visible, no
      // user edits" instead of wiping extracted text to an empty canvas.
      // Guard (`IfVirgin`) ensures a user edit landed before extraction
      // completed is not overwritten.
      usePdfEditorStore
        .getState()
        .resetHistoryBaselineIfVirgin(
          usePdfEditorStore.getState().currentPage,
          JSON.stringify(fabricCanvas.toJSON()),
        );
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
