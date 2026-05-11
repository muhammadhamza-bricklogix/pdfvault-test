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
        console.log(
          "[edit-text-mode] Canvas already has",
          existingEditText.length,
          "editModeText objects, skipping placement",
        );

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
            "Original fonts may not be available. Text will use substitute fonts.",
          title: "Font substitution",
        });
      }

      const { IText: FabricIText } = await import("fabric");

      if (cancelled) return;

      // --- DEBUG LOGGING ---
      console.group("[edit-text-mode] Canvas state before placing text");
      console.log("fabricCanvas zoom:", fabricCanvas.getZoom());
      console.log(
        "existing objects on canvas:",
        fabricCanvas.getObjects().length,
      );
      console.log("blocks to place:", blocks.length);
      console.groupEnd();

      // Place ALL text blocks as IText objects
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];

        const textObj = new FabricIText(block.text, {
          editorType: "editModeText",
          fill: block.color,
          fontFamily: block.fontFamily,
          fontSize: block.fontSize,
          left: block.x,
          originX: "left",
          originY: "top",
          top: block.y,
        } as any) as IText;

        fabricCanvas.add(textObj);

        // --- DEBUG: Log first 3 placed objects ---
        if (i < 3) {
          console.log(
            `[edit-text-mode] Placed ${i}: "${block.text.slice(0, 25)}" at (${block.x.toFixed(1)}, ${block.y.toFixed(1)}) fontSize=${block.fontSize.toFixed(1)} boundingRect=`,
            textObj.getBoundingRect(),
          );
        }
      }

      console.log("[edit-text-mode] Total placed:", blocks.length);
      fabricCanvas.renderAll();
    };

    setup();

    return () => {
      cancelled = true;
    };
  }, [fabricCanvas, page, currentPage]);
}
