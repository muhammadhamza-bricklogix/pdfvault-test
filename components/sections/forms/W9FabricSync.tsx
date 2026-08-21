"use client";

import type { FormField } from "@/lib/shared/types/forms.types";

import { useEffect, useSyncExternalStore } from "react";

import { W9_SCHEMA } from "@/lib/client/forms/w9-schema";
import {
  getActiveFabricCanvas,
  getActiveFabricCanvasServerSnapshot,
  subscribeActiveFabricCanvas,
} from "@/lib/client/pdf-editor/active-fabric-canvas";
import { flushLiveFabricPage } from "@/lib/client/pdf-editor/save-utils";
import { useFormEditorStore, usePdfEditorStore } from "@/lib/client/stores";

const W9_FABRIC_TAG = "w9Value";

type Rect = { x: number; y: number; w: number; h: number };

/**
 * Mirrors `useFormEditorStore.values` + `signaturePreview` into Fabric
 * objects on the shared pdf-composer canvas so the standard
 * `useExportEditor` Download pipeline includes the W-9 form values in
 * the exported PDF.
 *
 * Without this bridge the values live only in the form store; pdf-composer's
 * export merges Fabric edits into the source PDF and would ship a blank
 * W-9 — the "downloaded form has no edited values" bug reported 2026-08-21.
 *
 * On every change to values / signature / canvas / page:
 *   1. Remove all existing Fabric objects tagged `editorType === 'w9Value'`
 *      for a clean re-sync (idempotent, no drift).
 *   2. Walk the current page's schema fields; for each with a value:
 *      - text / date         → Fabric IText positioned at the field rect
 *      - ssn / ein           → one IText per digit, per segment cell
 *      - checkbox            → "X" glyph at the tick rect
 *      - radio               → "X" glyph at the SELECTED option's rect
 *      - signature           → FabricImage from `signaturePreview` data URL
 *   3. `flushLiveFabricPage(currentPage, canvas)` so `fabricJsonByPage`
 *      persists the objects across page navigation + export.
 *
 * All synced objects are `selectable:false, evented:false, editable:false`
 * so users can't accidentally drag / edit them — the form store stays the
 * single source of truth. To change a value the user re-types in the
 * yellow overlay; the sync effect regenerates the Fabric object.
 */
export function W9FabricSync() {
  const fabricCanvas = useSyncExternalStore(
    subscribeActiveFabricCanvas,
    getActiveFabricCanvas,
    getActiveFabricCanvasServerSnapshot,
  );
  const values = useFormEditorStore((s) => s.values);
  const signaturePreview = useFormEditorStore((s) => s.signaturePreview);
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const pdfDocument = usePdfEditorStore((s) => s.pdfDocument);

  useEffect(() => {
    if (!fabricCanvas || !pdfDocument) return;

    const pageFields: FormField[] = W9_SCHEMA.sections
      .flatMap((s) => s.fields)
      .filter((f) => f.rect.page === currentPage);

    if (pageFields.length === 0) return;

    let cancelled = false;

    void (async () => {
      const [fabricMod, page] = await Promise.all([
        import("fabric"),
        pdfDocument.getPage(currentPage),
      ]);

      if (cancelled) return;

      const viewport = page.getViewport({ scale: 1 });
      const canvasZoom = fabricCanvas.getZoom() || 1;
      const baseWidth = fabricCanvas.getWidth() / canvasZoom;
      const baseHeight = fabricCanvas.getHeight() / canvasZoom;
      const scaleX = baseWidth / viewport.width;
      const scaleY = baseHeight / viewport.height;

      // Full-replace strategy — cheap enough for a single-page form and
      // idempotent, no drift possible. Clone the array before iterating
      // because `canvas.remove` mutates it.
      const existing = fabricCanvas.getObjects().filter((obj) => {
        return (obj as { editorType?: string }).editorType === W9_FABRIC_TAG;
      });

      for (const obj of existing) fabricCanvas.remove(obj);

      const toFabricRect = (
        rect: Rect,
      ): { left: number; top: number; width: number; height: number } => ({
        left: rect.x * scaleX,
        top: (viewport.height - (rect.y + rect.h)) * scaleY,
        width: rect.w * scaleX,
        height: rect.h * scaleY,
      });

      const stampText = (text: string, rect: Rect): void => {
        if (!text) return;
        const r = toFabricRect(rect);
        const iText = new fabricMod.IText(text, {
          left: r.left,
          top: r.top,
          fontFamily: "Arial",
          fontSize: Math.max(r.height * 0.7, 8),
          fill: "#000",
          selectable: false,
          evented: false,
          editable: false,
          hoverCursor: "default",
        });

        (iText as unknown as { editorType: string }).editorType = W9_FABRIC_TAG;
        fabricCanvas.add(iText);
      };

      for (const field of pageFields) {
        const value = values[field.id] ?? "";

        if (field.type === "text" || field.type === "date") {
          stampText(value, field.rect);
          continue;
        }

        if (field.type === "ssn" || field.type === "ein") {
          if (!value || !field.segments) continue;
          const digits = value.replace(/\D/g, "").slice(0, 9);
          let digitIndex = 0;

          for (const segment of field.segments) {
            const cellW = segment.rect.w / segment.length;

            for (let i = 0; i < segment.length; i += 1) {
              const char = digits[digitIndex] ?? "";

              digitIndex += 1;
              if (!char) continue;
              stampText(char, {
                x: segment.rect.x + cellW * i,
                y: segment.rect.y,
                w: cellW,
                h: segment.rect.h,
              });
            }
          }
          continue;
        }

        if (field.type === "checkbox") {
          if (value === "true" || value === "1" || value === "X") {
            stampText("X", field.rect);
          }
          continue;
        }

        if (field.type === "radio") {
          if (!value || !field.options) continue;
          const selected = field.options.find((o) => o.id === value);

          if (!selected?.rect) continue;
          stampText("X", selected.rect);
          continue;
        }

        if (field.type === "signature") {
          if (!signaturePreview) continue;
          const img = await fabricMod.FabricImage.fromURL(signaturePreview);

          if (cancelled) return;
          const r = toFabricRect(field.rect);
          const imgW = img.width || r.width;
          const imgH = img.height || r.height;
          const s = Math.min(r.width / imgW, r.height / imgH);

          img.set({
            left: r.left,
            top: r.top,
            scaleX: s,
            scaleY: s,
            selectable: false,
            evented: false,
            hoverCursor: "default",
          });
          (img as unknown as { editorType: string }).editorType = W9_FABRIC_TAG;
          fabricCanvas.add(img);
        }
      }

      fabricCanvas.requestRenderAll();

      // Persist the current page's Fabric state so pdf-composer's export
      // pipeline (reads `fabricJsonByPage`) includes our stamped values.
      flushLiveFabricPage(currentPage, fabricCanvas);
    })();

    return () => {
      cancelled = true;
    };
  }, [fabricCanvas, pdfDocument, currentPage, values, signaturePreview]);

  return null;
}
