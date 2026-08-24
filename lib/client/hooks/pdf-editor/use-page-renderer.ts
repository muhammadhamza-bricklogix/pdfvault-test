"use client";

import type { PDFPageProxy, RenderTask } from "pdfjs-dist";
import type { RefObject } from "react";

import { useEffect, useState } from "react";

import { logger } from "@/lib/shared/utils/logger";

// pdf.js OPS constants for text rendering operations (31–49)
const TEXT_OPS_MIN = 31;
const TEXT_OPS_MAX = 49;

// PRD §7.1 — cache the parsed text-op index set per page proxy. Without
// this, every zoom change re-fetches page.getOperatorList() (the render
// effect depends on `zoom`, so it re-runs), which is 5–30ms on large
// pages. The WeakMap dies with the page proxy so a Manage-Pages rebuild
// or file swap naturally invalidates the cache.
const textIndexCache = new WeakMap<PDFPageProxy, Set<number>>();

function getTextOpIndices(
  page: PDFPageProxy,
  opList: { fnArray: ReadonlyArray<number> },
): Set<number> {
  const cached = textIndexCache.get(page);

  if (cached) return cached;

  const indices = new Set<number>();

  for (let i = 0; i < opList.fnArray.length; i++) {
    const op = opList.fnArray[i];

    if (op >= TEXT_OPS_MIN && op <= TEXT_OPS_MAX) {
      indices.add(i);
    }
  }
  textIndexCache.set(page, indices);

  return indices;
}

type UsePageRendererParams = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  page: PDFPageProxy | null;
  /** When true, text operations are filtered out during rendering. Default false. */
  suppressText?: boolean;
  /** When true, render against a transparent background. Default false. */
  transparent?: boolean;
  zoom: number;
  /**
   * When true, do NOT set `canvas.style.width/height` in CSS px. The caller
   * (typically a thumbnail using an aspect-ratio'd frame) owns the display
   * size via CSS so the canvas can be constrained to fit its container while
   * the bitmap stays at full pdf.js resolution for retina sharpness.
   */
  fitContainer?: boolean;
};

type RenderedSize = { height: number; width: number } | null;

export function usePageRenderer({
  canvasRef,
  page,
  suppressText = false,
  transparent = false,
  zoom,
  fitContainer = false,
}: UsePageRendererParams) {
  const [renderedSize, setRenderedSize] = useState<RenderedSize>(null);

  useEffect(() => {
    if (!page || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const scale = zoom * dpr;
    const viewport = page.getViewport({ scale });

    const cssWidth = viewport.width / dpr;
    const cssHeight = viewport.height / dpr;

    let renderTask: RenderTask | null = null;
    let cancelled = false;

    const render = async () => {
      try {
        let operationsFilter: ((i: number) => boolean) | undefined;

        if (suppressText) {
          const cachedIndices = textIndexCache.get(page);
          let textIndices: Set<number>;

          if (cachedIndices) {
            textIndices = cachedIndices;
          } else {
            const opList = await page.getOperatorList();

            if (cancelled) return;

            textIndices = getTextOpIndices(page, opList);
          }
          operationsFilter = (i: number) => !textIndices.has(i);
        }

        // Render offscreen FIRST, then copy to the visible canvas in one
        // paint. Assigning to `canvas.width` (even the same value) is
        // spec-mandated to clear the bitmap to fully transparent, which
        // shows as a BLACK FLASH between save/reload cycles when the
        // visible canvas is momentarily blank while pdf.js repaints.
        // Rendering offscreen sidesteps the clear entirely and only
        // touches the visible canvas after the new bitmap is ready.
        const offscreen = document.createElement("canvas");

        offscreen.width = viewport.width;
        offscreen.height = viewport.height;

        renderTask = page.render({
          ...(transparent ? { background: "rgba(0,0,0,0)" } : {}),
          canvas: offscreen,
          ...(operationsFilter ? { operationsFilter } : {}),
          viewport,
        });

        await renderTask.promise;

        if (cancelled) return;

        // Copy the finished render onto the visible canvas in one shot.
        // Resize only when dims differ (resizing itself clears — this
        // is the same trap as the outer effect). blitCtx.drawImage is
        // synchronous so the swap is a single paint with no gap.
        if (
          canvas.width !== viewport.width ||
          canvas.height !== viewport.height
        ) {
          canvas.width = viewport.width;
          canvas.height = viewport.height;
        }
        if (!fitContainer) {
          canvas.style.width = `${cssWidth}px`;
          canvas.style.height = `${cssHeight}px`;
        }
        const blitCtx = canvas.getContext("2d");

        if (blitCtx) {
          if (transparent) {
            blitCtx.clearRect(0, 0, canvas.width, canvas.height);
          }
          blitCtx.drawImage(offscreen, 0, 0);
        }

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
      } catch (err) {
        // render was cancelled — expected on re-renders / doc destroy
        const name = (err as { name?: string })?.name;

        if (
          name !== "RenderingCancelledException" &&
          // Swallow the "sendWithPromise of null" that fires when the
          // OLD pdf.js doc gets destroyed mid-render on a save reload
          // (`loadingTask.destroy()` nulls the worker's message
          // handler). The new render will replace this frame; the old
          // failure is harmless noise in the console.
          !/sendWithPromise/.test((err as { message?: string })?.message ?? "")
        ) {
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
  }, [canvasRef, page, zoom, suppressText, transparent, fitContainer]);

  // Derive `renderedSize` from `page` presence so downstream consumers see
  // the "no page ready" state as soon as pdf.js is torn down (file swap for
  // version restore / Manage Pages save). Without this, `renderedSize`
  // retains the previous file's dimensions, `useFabricCanvas`'s
  // `hasRenderedSize` stays true, and Fabric never unmounts — the OLD
  // file's overlays keep painting over the NEW PDF page until refresh
  // (QA report 2026-07-23: "restore doesn't update until refresh").
  return { renderedSize: page ? renderedSize : null };
}
