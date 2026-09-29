"use client";

import type { Canvas as FabricCanvas, Path } from "fabric";

import { useCallback, useEffect, useRef } from "react";

import { serializeFabricCanvas } from "@/lib/client/pdf-editor/save-utils";
import { usePdfEditorStore } from "@/lib/client/stores";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

export type AnnotationId = "sticky-note";

export type AnnotationDef = {
  fill: string;
  id: AnnotationId;
  label: string;
};

/**
 * PDFGuru-style annotations are sticky notes: the PDF layer gets a small
 * marker, while the note body is edited in a separate DOM popover. Keeping
 * note text off the Fabric text layer prevents it from overlapping extracted
 * PDF text or summoning the text-format toolbar in Edit Text mode.
 */
export const ANNOTATIONS: ReadonlyArray<AnnotationDef> = [
  { fill: "#FFD633", id: "sticky-note", label: "Note" },
];

export type AnnotationEventDetail = { id: AnnotationId };

/**
 * Listens for `editor:add-annotation` (dispatched by `AnnotationsModal`) and
 * drops a sticky-note marker in the centre of the currently visible viewport.
 * The note body is stored as custom metadata (`noteText`) and edited by
 * `FloatingAnnotationNote`.
 */
export function useAnnotationsEditor(fabricCanvas: FabricCanvas | null) {
  const fabricCanvasRef = useRef<FabricCanvas | null>(fabricCanvas);

  useEffect(() => {
    fabricCanvasRef.current = fabricCanvas;
  }, [fabricCanvas]);

  const handleAdd = useCallback(async (id: AnnotationId) => {
    const liveCanvas = fabricCanvasRef.current;

    if (!liveCanvas) {
      toast.error({
        title: "No PDF open",
        description: "Open a PDF before adding an annotation.",
      });

      return;
    }

    const def = ANNOTATIONS.find((a) => a.id === id);

    if (!def) {
      logger.warn("Unknown annotation id", { id });

      return;
    }

    try {
      const { Path: FabricPath } = await import("fabric");

      // Fabric coords are stored at zoom=1; convert the current visual
      // viewport centre back into base coords so save/export stays aligned.
      const zoom = liveCanvas.getZoom() || 1;
      const baseWidth = liveCanvas.getWidth() / zoom;
      const baseHeight = liveCanvas.getHeight() / zoom;
      const markerSize = 24;
      const clamp = (value: number, min: number, max: number) =>
        Math.min(Math.max(value, min), max);

      let left = clamp(
        (baseWidth - markerSize) / 2,
        0,
        Math.max(0, baseWidth - markerSize),
      );
      let top = clamp(
        (baseHeight - markerSize) / 2,
        0,
        Math.max(0, baseHeight - markerSize),
      );

      const canvasEl = liveCanvas.getElement();
      const scrollEl = canvasEl.closest<HTMLElement>(
        "[data-pdf-viewer-scroll]",
      );

      if (scrollEl) {
        const canvasRect = canvasEl.getBoundingClientRect();
        const scrollRect = scrollEl.getBoundingClientRect();
        const visibleCenterX = scrollRect.left + scrollRect.width / 2;
        const visibleCenterY = scrollRect.top + scrollRect.height / 2;
        const baseCenterX = (visibleCenterX - canvasRect.left) / zoom;
        const baseCenterY = (visibleCenterY - canvasRect.top) / zoom;

        left = clamp(
          baseCenterX - markerSize / 2,
          0,
          Math.max(0, baseWidth - markerSize),
        );
        top = clamp(
          baseCenterY - markerSize / 2,
          0,
          Math.max(0, baseHeight - markerSize),
        );
      }

      const obj = new FabricPath(
        "M3 1H21C22.1 1 23 1.9 23 3V16C23 17.1 22.1 18 21 18H13L5 23V18H3C1.9 18 1 17.1 1 16V3C1 1.9 1.9 1 3 1Z",
        {
          annotationKind: "sticky-note",
          editorType: "annotation",
          fill: def.fill,
          left,
          noteText: "",
          objectCaching: false,
          originX: "left",
          originY: "top",
          stroke: "#E0B400",
          strokeLineJoin: "round",
          strokeWidth: 1,
          top,
        } as any,
      ) as Path;

      obj.set({
        annotationKind: "sticky-note",
        editorType: "annotation",
        noteText: "",
      } as any);

      liveCanvas.add(obj);
      liveCanvas.setActiveObject(obj);
      liveCanvas.renderAll();

      const store = usePdfEditorStore.getState();

      store.markDocumentDirty();
      store.saveFabricJson(
        store.currentPage,
        serializeFabricCanvas(liveCanvas),
      );
      window.dispatchEvent(new CustomEvent("editor:focus-annotation-note"));

      toast.success({
        title: `${def.label} added`,
        description: "Add details in the note.",
      });
    } catch (err) {
      logger.error("Failed to add annotation", err);
      toast.error({
        title: "Couldn't add annotation",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  }, []);

  useEffect(() => {
    const onAdd = (event: Event) => {
      const detail = (event as CustomEvent<AnnotationEventDetail>).detail;

      if (!detail?.id) return;

      void handleAdd(detail.id);
    };

    window.addEventListener("editor:add-annotation", onAdd);

    return () => {
      window.removeEventListener("editor:add-annotation", onAdd);
    };
  }, [handleAdd]);
}
