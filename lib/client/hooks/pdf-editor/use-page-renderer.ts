"use client";

import type { PDFPageProxy, RenderTask } from "pdfjs-dist";
import type { RefObject } from "react";

import { useEffect, useState } from "react";

// pdf.js OPS constants for text rendering operations (31–49)
const TEXT_OPS_MIN = 31;
const TEXT_OPS_MAX = 49;

type UsePageRendererParams = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  page: PDFPageProxy | null;
  /** When true, text operations are filtered out during rendering. Default false. */
  suppressText?: boolean;
  zoom: number;
};

type RenderedSize = { height: number; width: number } | null;

export function usePageRenderer({
  canvasRef,
  page,
  suppressText = false,
  zoom,
}: UsePageRendererParams) {
  const [renderedSize, setRenderedSize] = useState<RenderedSize>(null);

  useEffect(() => {
    if (!page || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const scale = zoom * dpr;
    const viewport = page.getViewport({ scale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${viewport.width / dpr}px`;
    canvas.style.height = `${viewport.height / dpr}px`;

    const cssWidth = viewport.width / dpr;
    const cssHeight = viewport.height / dpr;

    let renderTask: RenderTask | null = null;
    let cancelled = false;

    const render = async () => {
      try {
        if (suppressText) {
          // Get operator list first to identify text operations by index
          const opList = await page.getOperatorList();

          if (cancelled) return;

          const textIndices = new Set<number>();

          for (let i = 0; i < opList.fnArray.length; i++) {
            const op = opList.fnArray[i];

            if (op >= TEXT_OPS_MIN && op <= TEXT_OPS_MAX) {
              textIndices.add(i);
            }
          }

          // Render without text operations
          renderTask = page.render({
            canvas,
            operationsFilter: (i: number) => !textIndices.has(i),
            viewport,
          });
        } else {
          renderTask = page.render({ canvas, viewport });
        }

        await renderTask.promise;

        if (!cancelled) {
          setRenderedSize({ height: cssHeight, width: cssWidth });
        }
      } catch {
        // render was cancelled — expected on re-renders
      }
    };

    render();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [canvasRef, page, zoom, suppressText]);

  return { renderedSize };
}
