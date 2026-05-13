"use client";

import type { Canvas } from "fabric";
import type { PDFPageProxy } from "pdfjs-dist";
import type { RefObject } from "react";

import { useEffect, useRef, useState } from "react";

import { serializeFabricCanvas } from "@/lib/client/pdf-editor/save-utils";
import { usePdfEditorStore } from "@/lib/client/stores";

type UseFabricCanvasParams = {
  fabricCanvasRef: RefObject<HTMLCanvasElement | null>;
  /** Resolved pdf.js page for `currentPage`; init waits until this matches. */
  page: PDFPageProxy | null;
  renderedSize: { height: number; width: number } | null;
};

/**
 * Matches pdf.js page canvas: CSS size = renderedSize, backing store = CSS × DPR.
 * `enableRetinaScaling` stays false so we do not double-apply devicePixelRatio.
 */
function applyFabricViewport(
  fc: Canvas,
  renderedSize: { height: number; width: number },
  zoom: number,
): void {
  const dpr =
    typeof window !== "undefined"
      ? Math.max(1, window.devicePixelRatio || 1)
      : 1;

  fc.setDimensions({
    height: renderedSize.height,
    width: renderedSize.width,
  });
  fc.setDimensions(
    {
      height: Math.max(1, Math.round(renderedSize.height * dpr)),
      width: Math.max(1, Math.round(renderedSize.width * dpr)),
    },
    { backstoreOnly: true },
  );
  fc.setZoom(zoom);
  fc.renderAll();
}

/**
 * Fabric overlay uses PDF point space (logical size = renderedSize / zoom).
 * The canvas is **recreated only when `currentPage` or the loaded `page` proxy
 * changes**. Zoom updates use `setDimensions` + `setZoom` so annotations are not
 * disposed (avoids async teardown races and “disappearing” text).
 */
export function useFabricCanvas({
  fabricCanvasRef,
  page,
  renderedSize,
}: UseFabricCanvasParams) {
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const zoom = usePdfEditorStore((s) => s.zoom);
  const getFabricJson = usePdfEditorStore((s) => s.getFabricJson);
  const saveFabricJson = usePdfEditorStore((s) => s.saveFabricJson);

  const fabricRef = useRef<Canvas | null>(null);
  const mountedPageRef = useRef<number>(currentPage);
  const [fabricCanvas, setFabricCanvas] = useState<Canvas | null>(null);
  const initTokenRef = useRef(0);

  // --- Create / dispose when the PDF page changes (not on zoom-only renders) ---
  useEffect(() => {
    const fcExisting = fabricRef.current;

    if (fcExisting && mountedPageRef.current !== currentPage) {
      const json = serializeFabricCanvas(fcExisting);

      saveFabricJson(mountedPageRef.current, json);
      fcExisting.dispose();
      fabricRef.current = null;
      void setFabricCanvas(null);
    }

    if (!fabricCanvasRef.current || !renderedSize) {
      return;
    }

    if (!page || page.pageNumber !== currentPage) {
      return;
    }

    if (fabricRef.current && mountedPageRef.current === currentPage) {
      return;
    }

    const initToken = ++initTokenRef.current;
    let cancelled = false;

    const init = async () => {
      const { Canvas: FabricCanvas, FabricObject } = await import("fabric");

      if (
        cancelled ||
        initToken !== initTokenRef.current ||
        !fabricCanvasRef.current
      ) {
        return;
      }

      for (const property of [
        "editorType",
        "noteText",
        "linkUrl",
        "shapeAspectLocked",
      ]) {
        if (!FabricObject.customProperties.includes(property)) {
          FabricObject.customProperties.push(property);
        }
      }

      const fc = new FabricCanvas(fabricCanvasRef.current, {
        backgroundColor: "transparent",
        enableRetinaScaling: false,
        height: renderedSize.height,
        selection: true,
        width: renderedSize.width,
      });

      const wrapper = fc.getElement().parentElement;

      if (wrapper) {
        wrapper.style.position = "absolute";
        wrapper.style.left = "0";
        wrapper.style.top = "0";
      }

      fabricRef.current = fc;

      const saved = getFabricJson(currentPage);

      if (saved) {
        await fc.loadFromJSON(JSON.parse(saved));

        if (cancelled || initToken !== initTokenRef.current) {
          fc.dispose();

          if (fabricRef.current === fc) {
            fabricRef.current = null;
          }

          return;
        }
      }

      if (cancelled || initToken !== initTokenRef.current) {
        fc.dispose();

        if (fabricRef.current === fc) {
          fabricRef.current = null;
        }

        return;
      }

      applyFabricViewport(fc, renderedSize, zoom);
      mountedPageRef.current = currentPage;
      setFabricCanvas(fc);
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, [currentPage, getFabricJson, page, renderedSize, saveFabricJson]);

  // --- Zoom / DPR: resize viewport without recreating the canvas ---
  useEffect(() => {
    const fc = fabricRef.current;

    if (!fc || !renderedSize || mountedPageRef.current !== currentPage) {
      return;
    }

    if (!page || page.pageNumber !== currentPage) {
      return;
    }

    applyFabricViewport(fc, renderedSize, zoom);
  }, [currentPage, page, renderedSize, zoom]);

  // --- Unmount: persist and dispose ---
  useEffect(() => {
    return () => {
      initTokenRef.current += 1;

      const fc = fabricRef.current;

      if (!fc) return;

      const json = serializeFabricCanvas(fc);

      saveFabricJson(mountedPageRef.current, json);
      fc.dispose();
      fabricRef.current = null;
    };
  }, [saveFabricJson]);

  return { fabricCanvas, fabricRef };
}
