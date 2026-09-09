"use client";

import type { Canvas as FabricCanvas, FabricObject } from "fabric";

import { useEffect, useRef } from "react";

import { serializeFabricCanvas } from "@/lib/client/pdf-editor/save-utils";
import { usePdfEditorStore } from "@/lib/client/stores";
import { logger } from "@/lib/shared/utils/logger";

/**
 * Shell-level Cmd/Ctrl+C / Cmd/Ctrl+V shortcut for the current Fabric
 * object selection. Ships the "copy signature from page N and paste on
 * page M" workflow the user asked for, but is object-agnostic so drawn
 * shapes, uploaded images, watermarks, etc. all copy-paste the same
 * way. Clipboard state lives in a module-scoped ref so pastes survive
 * page navigation (Fabric re-mounts per page, so a hook-local ref would
 * reset).
 *
 * Not wired to any UI — invisible keyboard shortcut. Skips when focus
 * is inside an input/textarea/contenteditable or when the selected
 * object is in text-editing mode (so Cmd+C copies the highlighted text
 * inside an IText, not the object itself).
 */

type ClipboardEntry = {
  json: Record<string, unknown>;
  sourcePage: number;
};

const clipboardRef: { current: ClipboardEntry | null } = { current: null };

const PASTE_OFFSET_PX = 20;

function isEditingText(canvas: FabricCanvas): boolean {
  const active = canvas.getActiveObject() as
    | (FabricObject & { isEditing?: boolean })
    | null;

  return !!active?.isEditing;
}

function isFocusInFormField(): boolean {
  const el = document.activeElement as HTMLElement | null;

  if (!el) return false;
  const tag = el.tagName;

  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;

  return false;
}

export function useObjectClipboard(fabricCanvas: FabricCanvas | null): void {
  const fabricRef = useRef(fabricCanvas);

  useEffect(() => {
    fabricRef.current = fabricCanvas;
  }, [fabricCanvas]);

  useEffect(() => {
    const onKeyDown = async (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();

      if (key !== "c" && key !== "v") return;

      const fc = fabricRef.current;

      if (!fc) return;
      if (isFocusInFormField()) return;
      if (isEditingText(fc)) return;

      if (key === "c") {
        const active = fc.getActiveObject();

        if (!active) return;

        // Skip auto-extracted source text — copying an extracted
        // sentence to another page would be more surprising than
        // useful, and it lacks the base coordinates a page-to-page
        // paste needs.
        const editorType = (active as unknown as { editorType?: string })
          .editorType;

        if (editorType === "editModeText") return;

        try {
          const objJson = (
            active as unknown as {
              toObject: (extra?: string[]) => Record<string, unknown>;
            }
          ).toObject([
            "editorType",
            "pristine",
            "originalText",
            "originalLeft",
            "originalTop",
            "originalWidth",
            "originalHeight",
            "pdfTextWidth",
            "textAlign",
            "fontFamily",
            "fontSize",
            "fontWeight",
            "fontStyle",
            "fill",
          ]);

          clipboardRef.current = {
            json: objJson,
            sourcePage: usePdfEditorStore.getState().currentPage,
          };
          e.preventDefault();
        } catch (err) {
          logger.captureError(err, "clipboard.copy_failed");
        }

        return;
      }

      if (key === "v") {
        const entry = clipboardRef.current;

        if (!entry) return;

        e.preventDefault();
        try {
          const { util } = await import("fabric");
          const cloned = await util.enlivenObjects<FabricObject>([entry.json]);
          const obj = cloned[0];

          if (!obj) return;

          const currentLeft = typeof obj.left === "number" ? obj.left : 0;
          const currentTop = typeof obj.top === "number" ? obj.top : 0;

          obj.set({
            left: currentLeft + PASTE_OFFSET_PX,
            top: currentTop + PASTE_OFFSET_PX,
          });
          fc.add(obj);
          fc.setActiveObject(obj);
          fc.requestRenderAll();

          const state = usePdfEditorStore.getState();
          const page = state.currentPage;

          state.pushHistory(page, JSON.stringify(fc.toJSON()));
          state.saveFabricJson(page, serializeFabricCanvas(fc));
          state.markDocumentDirty();
        } catch (err) {
          logger.captureError(err, "clipboard.paste_failed");
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}
