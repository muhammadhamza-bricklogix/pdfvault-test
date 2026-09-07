"use client";

import type { Canvas as FabricCanvas, IText } from "fabric";

import { useCallback, useEffect, useRef } from "react";

import { serializeFabricCanvas } from "@/lib/client/pdf-editor/save-utils";
import { usePdfEditorStore } from "@/lib/client/stores";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

export type AnnotationId =
  | "check"
  | "cross"
  | "arrow-right"
  | "arrow-up"
  | "question"
  | "exclamation"
  | "star"
  | "circle-outline"
  | "pin"
  | "paragraph"
  | "asterisk"
  | "dash";

export type AnnotationDef = {
  id: AnnotationId;
  /** Display name shown in the modal grid + the success toast. */
  label: string;
  /** Unicode glyph that becomes the IText content. */
  glyph: string;
  /** Default fill colour as hex. Reds/greens emphasise check/cross. */
  fill: string;
  /** Default font size in PDF points (matches Fabric base coords). */
  fontSize: number;
};

/**
 * Annotation catalogue.
 *
 * Each annotation is just a Fabric IText stamped at canvas centre — no
 * custom render code. Users can move, recolour, resize, or edit the
 * glyph after placement using the existing `FloatingTextToolbar`.
 *
 * Picking unicode glyphs over SVG paths because:
 *   - IText is already the renderer used for source-text editing +
 *     page numbers, so the merge pipeline already handles it correctly.
 *   - No per-symbol PDF embedding logic — `Helvetica` covers the
 *     symbols below and pdf-lib's WinAnsi sanitiser already substitutes
 *     unknown glyphs with `?` rather than crashing the save.
 */
export const ANNOTATIONS: ReadonlyArray<AnnotationDef> = [
  {
    id: "check",
    label: "Check mark",
    glyph: "✓",
    fill: "#16a34a",
    fontSize: 36,
  },
  {
    id: "cross",
    label: "Cross out",
    glyph: "✗",
    fill: "#dc2626",
    fontSize: 36,
  },
  {
    id: "arrow-right",
    label: "Right arrow",
    glyph: "→",
    fill: "#111111",
    fontSize: 36,
  },
  {
    id: "arrow-up",
    label: "Up arrow",
    glyph: "↑",
    fill: "#111111",
    fontSize: 36,
  },
  {
    id: "question",
    label: "Question mark",
    glyph: "?",
    fill: "#2563eb",
    fontSize: 40,
  },
  {
    id: "exclamation",
    label: "Important",
    glyph: "!",
    fill: "#ea580c",
    fontSize: 40,
  },
  { id: "star", label: "Star", glyph: "★", fill: "#eab308", fontSize: 36 },
  {
    id: "circle-outline",
    label: "Circle",
    glyph: "○",
    fill: "#111111",
    fontSize: 40,
  },
  { id: "pin", label: "Flag", glyph: "⚑", fill: "#111111", fontSize: 36 },
  {
    id: "paragraph",
    label: "Paragraph",
    glyph: "¶",
    fill: "#111111",
    fontSize: 36,
  },
  {
    id: "asterisk",
    label: "Asterisk",
    glyph: "*",
    fill: "#111111",
    fontSize: 40,
  },
  { id: "dash", label: "Dash line", glyph: "—", fill: "#111111", fontSize: 36 },
];

export type AnnotationEventDetail = { id: AnnotationId };

/**
 * Listens for `editor:add-annotation` (dispatched by `AnnotationsModal`).
 *
 * Adds the selected glyph as a Fabric IText at the centre of the live
 * canvas viewport. Mirrors the page-numbers + image-tool patterns:
 *   - The IText becomes part of `fabricJsonByPage` on the next flush,
 *     so it persists across navigation and survives Save → reload.
 *   - The user can drag, resize, recolour, or even retype the glyph
 *     after placement — annotations are just text objects with a
 *     pre-filled label.
 *   - `editorType: "annotation"` marks them as user-authored overlays
 *     (NOT `editModeText`), so the 2026-06-15 (c) merge guard treats
 *     them as genuine edits and ensures they reach the saved PDF.
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
      const { IText: FabricIText } = await import("fabric");

      // Centre the glyph on the current Fabric viewport. `getZoom`
      // returns the visual zoom; we want base (zoom=1) coords so the
      // object position matches what `mergeFabricEditsIntoPdf`
      // expects. Width/height of the canvas at zoom=1 = base dims.
      const zoom = liveCanvas.getZoom() || 1;
      const baseWidth = liveCanvas.getWidth() / zoom;
      const baseHeight = liveCanvas.getHeight() / zoom;

      // Drop the annotation roughly at canvas centre. Width estimate
      // uses the same `fontSize * 0.6` heuristic used elsewhere — exact
      // centring isn't critical since the user usually drags it after.
      const approxWidth = def.glyph.length * def.fontSize * 0.6;
      const left = Math.max(0, (baseWidth - approxWidth) / 2);
      const top = Math.max(0, (baseHeight - def.fontSize) / 2);

      const obj = new FabricIText(def.glyph, {
        editorType: "annotation",
        fill: def.fill,
        fontFamily: "Helvetica",
        fontSize: def.fontSize,
        left,
        // Lock scaling so corner-handle drags don't distort symbols.
        // Users can still resize via the FloatingTextToolbar fontSize.
        lockScalingX: true,
        lockScalingY: true,
        originX: "left",
        originY: "top",
        top,
      } as any) as IText;

      liveCanvas.add(obj);
      // Deliberately NOT calling `setActiveObject(obj)` here — auto-
      // selecting the fresh annotation fires `selection:created`, which
      // pops the FloatingTextToolbar (font/size/color controls). QA
      // 2026-09-07 flagged the toolbar appearing immediately after
      // picking an annotation as unexpected. Users can still tap the
      // annotation on the canvas later to summon the toolbar for font
      // adjustments. The success toast below tells them the annotation
      // was placed.
      liveCanvas.discardActiveObject();
      liveCanvas.renderAll();

      // Mark dirty so `hasUnsavedChanges` flips and the next Save
      // picks the new annotation up. `pushHistory` is triggered by
      // the canvas `object:added` listener registered in
      // `useEditorHistory` — we don't double-fire it here.
      const store = usePdfEditorStore.getState();

      store.markDocumentDirty();
      // Persist synchronously so save/export can't miss it if the flush at
      // export time hits a stale/empty live canvas (matches the 2026-07-23
      // draw/signature persistence pattern).
      store.saveFabricJson(
        store.currentPage,
        serializeFabricCanvas(liveCanvas),
      );

      toast.success({
        title: `${def.label} added`,
        description: "Drag to position, double-click to edit.",
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
