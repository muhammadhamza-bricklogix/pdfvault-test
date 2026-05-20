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
import { toast } from "@/lib/shared/utils/toast";

type UseEditTextModeParams = {
  fabricCanvas: Canvas | null;
  page: PDFPageProxy | null;
};

/**
 * Always-on text replacement:
 *
 * 1. The PDF canvas renders WITHOUT text (via operationsFilter in use-page-renderer)
 * 2. This hook extracts ALL text blocks and places them as Fabric.js IText objects
 *    using the actual embedded fonts loaded by pdf.js (via document.fonts)
 * 3. Users can click any text to edit it in-place
 * 4. Text objects are permanent — they ARE the text layer
 */
export function useEditTextMode({ fabricCanvas, page }: UseEditTextModeParams) {
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const fontWarningShownRef = useRef(false);

  // Cache extracted text blocks per page
  const blocksCacheRef = useRef<Map<number, TextBlock[]>>(new Map());

  // Clear cache on file change
  const file = usePdfEditorStore((s) => s.file);

  useEffect(() => {
    blocksCacheRef.current.clear();
    fontWarningShownRef.current = false;
  }, [file]);

  useEffect(() => {
    if (!fabricCanvas || !page) return;

    let cancelled = false;

    const setup = async () => {
      // Skip if canvas already has editModeText objects (restored from serialization)
      const existingEditText = fabricCanvas
        .getObjects()
        .filter((obj) => (obj as any).editorType === "editModeText");

      if (existingEditText.length > 0) {
        return;
      }

      // Extract text blocks (with caching)
      let blocks: TextBlock[];
      const cached = blocksCacheRef.current.get(currentPage);

      if (cached) {
        blocks = cached;
      } else {
        blocks = await extractTextBlocks(page);

        if (cancelled) return;

        blocksCacheRef.current.set(currentPage, blocks);

        // Extract and store font binary data for the export pipeline
        const fontNames = new Set(blocks.map((b) => b.fontFamily));
        const fonts = extractFontData(page, fontNames);

        if (fonts.length > 0) {
          usePdfEditorStore.getState().addFontData(fonts);
        }
      }

      if (blocks.length === 0) {
        toast.info({
          description: "This page may be scanned or contain only images.",
          title: "No editable text found",
        });

        return;
      }

      // Show font warning once per session
      if (!fontWarningShownRef.current) {
        fontWarningShownRef.current = true;
        toast.info({
          description:
            "Some characters may not be available in the embedded font subset.",
          title: "Embedded fonts loaded",
        });
      }

      const { IText: FabricIText } = await import("fabric");

      if (cancelled) return;

      // Place ALL text blocks as IText objects with real embedded fonts
      for (const block of blocks) {
        const textObj = new FabricIText(block.text, {
          editorType: "editModeText",
          fill: block.color,
          fontFamily: block.fontFamily,
          fontSize: block.fontSize,
          fontStyle: block.fontStyle,
          fontWeight: block.fontWeight,
          left: block.x,
          objectCaching: false,
          originX: "left",
          originY: "top",
          // Store original PDF text width for accurate export spacing
          pdfTextWidth: block.width,
          top: block.y,
        } as any) as IText;

        fabricCanvas.add(textObj);
      }

      fabricCanvas.renderAll();
    };

    setup();

    return () => {
      cancelled = true;
    };
  }, [fabricCanvas, page, currentPage]);
}
