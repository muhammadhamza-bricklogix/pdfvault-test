"use client";

import type { PDFPageProxy, RenderTask } from "pdfjs-dist";
import type { RefObject } from "react";

import { useEffect, useState } from "react";

import { logger } from "@/lib/shared/utils/logger";

// pdf.js OPS constants for text rendering operations (31–49)
const TEXT_OPS_MIN = 31;
const TEXT_OPS_MAX = 49;

type UsePageRendererParams = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  page: PDFPageProxy | null;
  /** When true, text operations are filtered out during rendering. Default false. */
  suppressText?: boolean;
  /** When true, render against a transparent background. Default false. */
  transparent?: boolean;
  zoom: number;
};

type RenderedSize = { height: number; width: number } | null;

export function usePageRenderer({
  canvasRef,
  page,
  suppressText = false,
  transparent = false,
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
        let operationsFilter: ((i: number) => boolean) | undefined;

        if (suppressText) {
          const opList = await page.getOperatorList();

          if (cancelled) return;

          const textIndices = new Set<number>();

          for (let i = 0; i < opList.fnArray.length; i++) {
            const op = opList.fnArray[i];

            if (op >= TEXT_OPS_MIN && op <= TEXT_OPS_MAX) {
              textIndices.add(i);
            }
          }
          operationsFilter = (i: number) => !textIndices.has(i);
        }

        renderTask = page.render({
          ...(transparent ? { background: "rgba(0,0,0,0)" } : {}),
          canvas,
          ...(operationsFilter ? { operationsFilter } : {}),
          viewport,
        });

        await renderTask.promise;

        if (!cancelled) {
          logger.info("[PDFedits] render: page", {
            page: page.pageNumber,
            cssWidth,
            cssHeight,
            suppressText,
          });
          setRenderedSize((prev) => {
            if (prev && prev.width === cssWidth && prev.height === cssHeight) {
              return prev;
            }

            return { height: cssHeight, width: cssWidth };
          });
        }
      } catch (err) {
        // render was cancelled — expected on re-renders
        const name = (err as { name?: string })?.name;

        if (name !== "RenderingCancelledException") {
          logger.warn("[PDFedits] render: failed", {
            page: page.pageNumber,
            err,
          });
        }
      }
    };

    render();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [canvasRef, page, zoom, suppressText, transparent]);

  return { renderedSize };
}
