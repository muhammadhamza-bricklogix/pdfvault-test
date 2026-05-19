"use client";

import type { Canvas } from "fabric";
import type { RefObject } from "react";

import { useEffect, useRef, useState } from "react";

import { serializeFabricCanvas } from "@/lib/client/pdf-editor/save-utils";
import { usePdfEditorStore } from "@/lib/client/stores";

type UseFabricCanvasParams = {
  fabricCanvasRef: RefObject<HTMLCanvasElement | null>;
  renderedSize: { height: number; width: number } | null;
};

/**
 * The Fabric canvas always uses "base" dimensions (zoom=1, i.e. the PDF page
 * size in points). When the user zooms, we apply Fabric's own viewport zoom
 * rather than resizing the canvas. This keeps all object coordinates in a
 * stable, zoom-independent coordinate space so that:
 *   - Serialized JSON always represents zoom=1 coordinates
 *   - The merge pipeline always gets scaleX=scaleY=1
 *   - No rescaling is needed on load
 */
export function useFabricCanvas({
  fabricCanvasRef,
  renderedSize,
}: UseFabricCanvasParams) {
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const sourcePage = usePdfEditorStore((s) => {
    const order = s.pageOrder;

    if (!order.length) return s.currentPage;

    return order[s.currentPage - 1] ?? s.currentPage;
  });
  const zoom = usePdfEditorStore((s) => s.zoom);
  const getFabricJson = usePdfEditorStore((s) => s.getFabricJson);
  const saveFabricJsonBySourcePage = usePdfEditorStore(
    (s) => s.saveFabricJsonBySourcePage,
  );

  const fabricRef = useRef<Canvas | null>(null);
  const mountedPageRef = useRef<number>(sourcePage);
  const [fabricCanvas, setFabricCanvas] = useState<Canvas | null>(null);

  // Base dimensions = CSS size at zoom=1 (matches PDF page points)
  const baseWidth = renderedSize ? renderedSize.width / zoom : null;
  const baseHeight = renderedSize ? renderedSize.height / zoom : null;

  // --- Canvas creation & page-change lifecycle ---
  useEffect(() => {
    if (!fabricCanvasRef.current || !renderedSize || !baseWidth || !baseHeight)
      return;

    let cancelled = false;
    let initDone: Promise<void> | undefined;

    const init = async () => {
      const { Canvas: FabricCanvas, FabricObject } = await import("fabric");

      if (cancelled || !fabricCanvasRef.current) return;

      // Register custom properties so they survive toJSON() / loadFromJSON()
      for (const property of [
        "editorType",
        "noteText",
        "linkUrl",
        "pdfTextWidth",
        "shapeAspectLocked",
      ]) {
        if (!FabricObject.customProperties.includes(property)) {
          FabricObject.customProperties.push(property);
        }
      }

      // Create canvas at CSS size (zoom-scaled) but set logical dimensions to base
      const fc = new FabricCanvas(fabricCanvasRef.current, {
        backgroundColor: "transparent",
        enableRetinaScaling: true,
        height: renderedSize.height,
        selection: true,
        width: renderedSize.width,
      });

      // Apply Fabric zoom so objects are in base-coordinate space
      fc.setZoom(zoom);

      // Fabric wraps the canvas in a <div data-fabric="wrapper"> with position:relative.
      // We need to make it overlay the PDF canvas with position:absolute instead.
      const wrapper = fc.getElement().parentElement;

      if (wrapper) {
        wrapper.style.position = "absolute";
        wrapper.style.top = "0";
        wrapper.style.left = "0";
      }

      fabricRef.current = fc;
      mountedPageRef.current = sourcePage;

      // Rehydrate saved JSON for this page
      const saved = getFabricJson(currentPage);

      if (saved) {
        await fc.loadFromJSON(JSON.parse(saved));

        if (cancelled) return;

        // Restore zoom after loadFromJSON (which may reset it)
        fc.setZoom(zoom);
        fc.renderAll();
      }

      if (cancelled) return;

      setFabricCanvas(fc);
    };

    initDone = init();

    return () => {
      cancelled = true;

      const cleanup = () => {
        if (fabricRef.current) {
          const json = serializeFabricCanvas(fabricRef.current);

          saveFabricJsonBySourcePage(mountedPageRef.current, json);
          fabricRef.current.dispose();
          fabricRef.current = null;
          setFabricCanvas(null);
        }
      };

      if (initDone) {
        initDone.then(cleanup);
      } else {
        cleanup();
      }
    };
  }, [renderedSize, sourcePage]);

  // --- Update Fabric zoom when user changes zoom level ---
  useEffect(() => {
    if (!fabricRef.current) return;

    fabricRef.current.setZoom(zoom);
    fabricRef.current.renderAll();
  }, [zoom]);

  return { fabricCanvas, fabricRef };
}
