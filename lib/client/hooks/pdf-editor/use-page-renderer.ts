"use client";

import type { PDFPageProxy, RenderTask } from "pdfjs-dist";
import type { RefObject } from "react";

import { useEffect, useState } from "react";

type UsePageRendererParams = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  page: PDFPageProxy | null;
  zoom: number;
};

type RenderedSize = { height: number; width: number } | null;

export function usePageRenderer({
  canvasRef,
  page,
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

    const render = async () => {
      try {
        renderTask = page.render({ canvas, viewport });
        await renderTask.promise;
        setRenderedSize({ height: cssHeight, width: cssWidth });
      } catch {
        // render was cancelled — expected on re-renders
      }
    };

    render();

    return () => {
      renderTask?.cancel();
    };
  }, [canvasRef, page, zoom]);

  return { renderedSize };
}
