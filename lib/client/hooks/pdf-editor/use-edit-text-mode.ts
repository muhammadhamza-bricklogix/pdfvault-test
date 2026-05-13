"use client";

import type { Canvas, IText } from "fabric";
import type { PDFPageProxy } from "pdfjs-dist";

import { useEffect, useRef } from "react";

import {
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
 *
 * Extraction runs only once per page load: we skip if the canvas already has any
 * IText/Text objects (including restored JSON without `editorType`) and we use a
 * run id so overlapping async work cannot add a second copy (Strict Mode / races).
 */
function canvasAlreadyHasPlacedText(fc: Canvas): boolean {
  return fc.getObjects().some((obj) => {
    const o = obj as { editorType?: string; type?: string };

    if (o.editorType === "editModeText") return true;

    const t = (o.type || "").toLowerCase();

    return (
      t === "i-text" || t === "itext" || t === "text" || t === "textbox"
    );
  });
}

export function useEditTextMode({ fabricCanvas, page }: UseEditTextModeParams) {
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const fontWarningShownRef = useRef(false);
  const setupRunIdRef = useRef(0);

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

    const runId = ++setupRunIdRef.current;
    let cancelled = false;

    const setup = async () => {
      // Skip if anything that looks like placed PDF / user text is already on canvas
      // (restored JSON, a prior extraction pass, or legacy saves without editorType).
      if (canvasAlreadyHasPlacedText(fabricCanvas)) {
        return;
      }

      // Extract text blocks (with caching)
      let blocks: TextBlock[];
      const cached = blocksCacheRef.current.get(currentPage);

      if (cached) {
        blocks = cached;
      } else {
        blocks = await extractTextBlocks(page);

        if (cancelled || runId !== setupRunIdRef.current) return;

        blocksCacheRef.current.set(currentPage, blocks);
      }

      if (cancelled || runId !== setupRunIdRef.current) return;

      // Another pass may have populated the canvas while we awaited (Strict Mode / races).
      if (canvasAlreadyHasPlacedText(fabricCanvas)) {
        return;
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

      if (cancelled || runId !== setupRunIdRef.current) return;

      if (canvasAlreadyHasPlacedText(fabricCanvas)) {
        return;
      }

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
          top: block.y,
        } as any) as IText;

        fabricCanvas.add(textObj);
      }

      fabricCanvas.renderAll();
    };

    void setup();

    return () => {
      cancelled = true;
    };
  }, [fabricCanvas, page, currentPage]);
}
