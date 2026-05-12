"use client";

import type { Canvas, FabricObject } from "fabric";

import { useEffect } from "react";

import { usePdfEditorStore } from "@/lib/client/stores";

const DEBUG_TEXT_BBOXES = true;

const DEBUG_META_KEY = "__textExtractionDebugRect";

type UseTextExtractionDebugOverlayParams = {
  fabricCanvas: Canvas | null;
};

export function useTextExtractionDebugOverlay({
  fabricCanvas,
}: UseTextExtractionDebugOverlayParams) {
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const items = usePdfEditorStore((s) =>
    s.extractedTextByPage.get(s.currentPage),
  );

  useEffect(() => {
    if (!DEBUG_TEXT_BBOXES) return;
    if (!fabricCanvas) return;

    const removeExisting = () => {
      const targets = fabricCanvas
        .getObjects()
        .filter(
          (o) =>
            (o as FabricObject & { [DEBUG_META_KEY]?: boolean })[
              DEBUG_META_KEY
            ] === true,
        );

      targets.forEach((o) => fabricCanvas.remove(o));
    };

    removeExisting();

    if (!items || items.length === 0) {
      fabricCanvas.renderAll();

      return;
    }

    let cancelled = false;

    (async () => {
      const { Rect } = await import("fabric");

      if (cancelled) return;

      // ALIGNMENT REFERENCE MARKERS — known coordinates we can eyeball.
      // Each marker is a 20x20 green filled square at a known fabric coord.
      // If math is right, these should land at the page positions noted below.
      const markers = [
        { left: 0, top: 0, label: "TL (0,0)" }, // top-left corner of page
        { left: 296, top: 386, label: "C (306,396)" }, // center of 612x792 page (offset for marker size)
        { left: 592, top: 772, label: "BR (612,792)" }, // bottom-right corner (offset for marker size)
      ];

      for (const m of markers) {
        const marker = new Rect({
          evented: false,
          excludeFromExport: true,
          fill: "rgba(0, 200, 0, 0.7)",
          height: 20,
          left: m.left,
          originX: "left",
          originY: "top",
          selectable: false,
          stroke: "#000",
          strokeWidth: 1,
          top: m.top,
          width: 20,
        });

        (marker as FabricObject & { [DEBUG_META_KEY]?: boolean })[
          DEBUG_META_KEY
        ] = true;

        fabricCanvas.add(marker);
      }

      for (const item of items) {
        // item.y is the baseline; the visible glyph row starts one em above it.
        const rect = new Rect({
          evented: false,
          excludeFromExport: true,
          fill: "transparent",
          height: item.fontSize,
          hoverCursor: "default",
          left: item.x,
          originX: "left",
          originY: "top",
          selectable: false,
          stroke: "rgba(255, 0, 0, 0.6)",
          strokeWidth: 1,
          top: item.y - item.fontSize,
          width: item.width,
        });

        (rect as FabricObject & { [DEBUG_META_KEY]?: boolean })[
          DEBUG_META_KEY
        ] = true;

        fabricCanvas.add(rect);
      }

      fabricCanvas.renderAll();
    })();

    return () => {
      cancelled = true;
      removeExisting();
      fabricCanvas.renderAll();
    };
  }, [fabricCanvas, items, currentPage]);
}
