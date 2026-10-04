"use client";

import type { Canvas as FabricCanvas } from "fabric";

import { useCallback, useEffect, useRef } from "react";

import {
  buildNoteMarker,
  DEFAULT_NOTE_COLOR,
  DEFAULT_NOTE_ICON,
  getNoteIconDef,
  NOTE_MARKER_SIZE,
  type NoteIconId,
} from "@/lib/client/pdf-editor/annotation-notes";
import { serializeFabricCanvas } from "@/lib/client/pdf-editor/save-utils";
import { usePdfEditorStore } from "@/lib/client/stores";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

export type AnnotationEventDetail = { color?: string; icon?: NoteIconId };

/**
 * PDFGuru-style annotations are sticky notes: the PDF layer gets a small
 * marker, while the note body is edited in a separate DOM popover. Keeping
 * note text off the Fabric text layer prevents it from overlapping extracted
 * PDF text or summoning the text-format toolbar in Edit Text mode.
 *
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

  const handleAdd = useCallback(async (detail: AnnotationEventDetail) => {
    const liveCanvas = fabricCanvasRef.current;

    if (!liveCanvas) {
      toast.error({
        title: "No PDF open",
        description: "Open a PDF before adding an annotation.",
      });

      return;
    }

    const def = getNoteIconDef(detail.icon ?? DEFAULT_NOTE_ICON);
    const color = detail.color ?? DEFAULT_NOTE_COLOR;

    try {
      const { Group, Path } = await import("fabric");

      const zoom = liveCanvas.getZoom() || 1;
      const baseWidth = liveCanvas.getWidth() / zoom;
      const baseHeight = liveCanvas.getHeight() / zoom;
      const markerSize = NOTE_MARKER_SIZE;
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

      const obj = buildNoteMarker(
        { Group, Path },
        { color, icon: def.id, left, top },
      );

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
        title: `${def.label} note added`,
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

      void handleAdd(detail ?? {});
    };

    window.addEventListener("editor:add-annotation", onAdd);

    return () => {
      window.removeEventListener("editor:add-annotation", onAdd);
    };
  }, [handleAdd]);
}
