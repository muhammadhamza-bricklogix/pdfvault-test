"use client";

import type { ActiveTool } from "@/lib/client/stores/pdf-editor-store";
import type { Canvas } from "fabric";
import type { RefObject } from "react";

import { useEffect, useRef, useState } from "react";

import { serializeFabricCanvas } from "@/lib/client/pdf-editor/save-utils";
import { usePdfEditorStore } from "@/lib/client/stores";

type UseFabricCanvasParams = {
  fabricCanvasRef: RefObject<HTMLCanvasElement | null>;
  renderedSize: { height: number; width: number } | null;
};

// Tools that draw onto the Fabric overlay with a 1-finger gesture. Only these
// need `touch-action: none` so iOS Safari hands the gesture to Fabric. For
// every other tool (select, text, image, watermark, etc.) the wrapper must
// allow `pan-x pan-y` so the user can swipe to pan a zoomed-in page.
const DRAW_TOOLS: ReadonlySet<ActiveTool> = new Set<ActiveTool>([
  "draw",
  "eraser",
  "highlight",
  "redact",
  "shape",
  "whiteout",
]);

function touchActionFor(tool: ActiveTool): string {
  return DRAW_TOOLS.has(tool) ? "none" : "pan-x pan-y";
}

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
  const activeTool = usePdfEditorStore((s) => s.activeTool);
  const getFabricJson = usePdfEditorStore((s) => s.getFabricJson);
  const saveFabricJsonBySourcePage = usePdfEditorStore(
    (s) => s.saveFabricJsonBySourcePage,
  );

  const fabricRef = useRef<Canvas | null>(null);
  const mountedPageRef = useRef<number>(sourcePage);
  // Snapshot of the File at mount time. The unmount cleanup compares against
  // the store's current file before persisting JSON — if the file was swapped
  // (Create New PDF, Open Another), we MUST NOT write the previous canvas's
  // objects into the new file's fabricJsonByPage map, or the freshly-mounted
  // canvas would load the old file's text overlays back onto the new doc.
  const mountedFileRef = useRef<File | null>(null);
  const [fabricCanvas, setFabricCanvas] = useState<Canvas | null>(null);

  // Latest renderedSize is read inside the mount effect via a ref so we don't
  // re-mount Fabric on every zoom change. Only sourcePage changes trigger a
  // full re-mount; zoom/size adjustments live in the resize effect below.
  const renderedSizeRef = useRef(renderedSize);
  const zoomRef = useRef(zoom);

  useEffect(() => {
    renderedSizeRef.current = renderedSize;
    zoomRef.current = zoom;
  }, [renderedSize, zoom]);

  const hasRenderedSize = !!renderedSize;

  // --- Canvas creation & page-change lifecycle ---
  useEffect(() => {
    if (!fabricCanvasRef.current) return;
    const currentRenderedSize = renderedSizeRef.current;

    if (!currentRenderedSize) return;

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

      const fc = new FabricCanvas(fabricCanvasRef.current, {
        backgroundColor: "transparent",
        enableRetinaScaling: true,
        height: currentRenderedSize.height,
        selection: true,
        width: currentRenderedSize.width,
      });

      fc.setZoom(zoomRef.current);

      // Fabric wraps the canvas in a <div data-fabric="wrapper"> with position:relative.
      // Make it overlay the PDF canvas with position:absolute instead.
      const wrapper = fc.getElement().parentElement;

      if (wrapper) {
        wrapper.style.position = "absolute";
        wrapper.style.top = "0";
        wrapper.style.left = "0";
        // For drawing tools, `touch-action: none` hands every gesture to
        // Fabric (otherwise iOS Safari's scroll container steals touchstart
        // and strokes drop frames or get cancelled). For select / text /
        // image / watermark / etc. we set `pan-x pan-y` so the user can
        // 1-finger swipe to pan a zoomed-in page. The active-tool effect
        // below keeps this in sync as the user switches tools.
        wrapper.style.touchAction = touchActionFor(
          usePdfEditorStore.getState().activeTool,
        );
      }

      fabricRef.current = fc;
      mountedPageRef.current = sourcePage;
      mountedFileRef.current = usePdfEditorStore.getState().file;

      const saved = getFabricJson(currentPage);

      if (saved) {
        await fc.loadFromJSON(JSON.parse(saved));

        if (cancelled) return;

        // Wait for pdf.js's embedded fonts before painting any restored
        // IText — see use-edit-text-mode.ts for the iOS Safari background.
        if (typeof document !== "undefined" && document.fonts) {
          try {
            await document.fonts.ready;
          } catch {
            // Some FontFace failed; render anyway so successful fonts show.
          }

          if (cancelled) return;
        }

        fc.setZoom(zoomRef.current);
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
          // Only persist objects back to the store if the file is still the
          // same one that was loaded into this canvas. Otherwise we'd write
          // the previous file's IText into the new file's page-1 slot.
          const currentFile = usePdfEditorStore.getState().file;

          if (currentFile && currentFile === mountedFileRef.current) {
            const json = serializeFabricCanvas(fabricRef.current);

            saveFabricJsonBySourcePage(mountedPageRef.current, json);
          }

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
  }, [sourcePage, hasRenderedSize]);

  // --- Touch-action follows the active tool ---
  // Drawing tools must own touchstart (`none`); everything else releases
  // 1-finger gestures back to the outer scroll container so the user can
  // swipe to pan a zoomed-in page.
  useEffect(() => {
    const fc = fabricRef.current;
    const wrapper = fc?.getElement().parentElement;

    if (!wrapper) return;

    wrapper.style.touchAction = touchActionFor(activeTool);
  }, [activeTool, fabricCanvas]);

  // --- Resize + zoom: keep the existing canvas, don't re-mount ---
  // Critical for sharp text + smooth UX when the user zooms in/out.
  useEffect(() => {
    const fc = fabricRef.current;

    if (!fc || !renderedSize) return;

    fc.setDimensions({
      height: renderedSize.height,
      width: renderedSize.width,
    });
    fc.setZoom(zoom);

    // Fabric caches a rasterized bitmap per object (text/groups especially).
    // Without invalidation, that cached bitmap is just scaled when zoom
    // changes — producing visible blur. Mark every object dirty so Fabric
    // re-rasterizes them at the new zoom level.
    for (const obj of fc.getObjects()) {
      obj.dirty = true;
    }

    fc.renderAll();
  }, [renderedSize, zoom, fabricCanvas]);

  return { fabricCanvas, fabricRef };
}
