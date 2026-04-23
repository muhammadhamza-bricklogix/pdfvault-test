"use client";

import type { Canvas } from "fabric";
import type { RefObject } from "react";

import { useEffect, useRef, useState } from "react";

import { usePdfEditorStore } from "@/lib/client/stores";

type UseFabricCanvasParams = {
  fabricCanvasRef: RefObject<HTMLCanvasElement | null>;
  renderedSize: { height: number; width: number } | null;
};

export function useFabricCanvas({
  fabricCanvasRef,
  renderedSize,
}: UseFabricCanvasParams) {
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const getFabricJson = usePdfEditorStore((s) => s.getFabricJson);
  const saveFabricJson = usePdfEditorStore((s) => s.saveFabricJson);

  const fabricRef = useRef<Canvas | null>(null);
  const mountedPageRef = useRef<number>(currentPage);
  const [fabricCanvas, setFabricCanvas] = useState<Canvas | null>(null);

  useEffect(() => {
    if (!fabricCanvasRef.current || !renderedSize) return;

    let cancelled = false;
    let initDone: Promise<void> | undefined;

    const init = async () => {
      const { Canvas: FabricCanvas } = await import("fabric");

      if (cancelled || !fabricCanvasRef.current) return;

      const fc = new FabricCanvas(fabricCanvasRef.current, {
        backgroundColor: "transparent",
        height: renderedSize.height,
        selection: true,
        width: renderedSize.width,
      });

      // Fabric wraps the canvas in a <div data-fabric="wrapper"> with position:relative.
      // We need to make it overlay the PDF canvas with position:absolute instead.
      const wrapper = fc.getElement().parentElement;

      if (wrapper) {
        wrapper.style.position = "absolute";
        wrapper.style.top = "0";
        wrapper.style.left = "0";
      }

      fabricRef.current = fc;
      mountedPageRef.current = currentPage;

      // Rehydrate saved JSON for this page
      const saved = getFabricJson(currentPage);

      if (saved) {
        await fc.loadFromJSON(JSON.parse(saved));

        if (cancelled) return;

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
          const json = JSON.stringify(fabricRef.current.toJSON());

          saveFabricJson(mountedPageRef.current, json);
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
  }, [currentPage, renderedSize]);

  return { fabricCanvas, fabricRef };
}
