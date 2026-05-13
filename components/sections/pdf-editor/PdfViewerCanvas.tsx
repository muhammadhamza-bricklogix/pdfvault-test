"use client";

import type { Canvas, IText, TPointerEventInfo } from "fabric";
import type { PDFPageProxy } from "pdfjs-dist";
import type { MutableRefObject } from "react";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { useDrawTool } from "@/lib/client/hooks/pdf-editor/use-draw-tool";
import { useEditTextMode } from "@/lib/client/hooks/pdf-editor/use-edit-text-mode";
import { useEditorHistory } from "@/lib/client/hooks/pdf-editor/use-editor-history";
import { useEraserTool } from "@/lib/client/hooks/pdf-editor/use-eraser-tool";
import { useFabricCanvas } from "@/lib/client/hooks/pdf-editor/use-fabric-canvas";
import { useHighlightTool } from "@/lib/client/hooks/pdf-editor/use-highlight-tool";
import { useImageTool } from "@/lib/client/hooks/pdf-editor/use-image-tool";
import { usePageRenderer } from "@/lib/client/hooks/pdf-editor/use-page-renderer";
import { useShapeTool } from "@/lib/client/hooks/pdf-editor/use-shape-tool";
import { useSignatureTool } from "@/lib/client/hooks/pdf-editor/use-signature-tool";
import { usePdfEditorStore } from "@/lib/client/stores";

import { FloatingTextToolbar } from "./FloatingTextToolbar";
import { FloatingShapeToolbar } from "./FloatingShapeToolbar";
import { SignatureModal } from "./SignatureModal";

type PdfViewerCanvasProps = {
  /**
   * Updated in useLayoutEffect to match the live Fabric instance so save/export
   * can read it even when parent React state has not re-rendered yet.
   */
  fabricInstanceRef?: MutableRefObject<Canvas | null>;
  onFabricCanvasReady?: (canvas: Canvas | null) => void;
};

export function PdfViewerCanvas({
  fabricInstanceRef,
  onFabricCanvasReady,
}: PdfViewerCanvasProps) {
  const activeTool = usePdfEditorStore((s) => s.activeTool);
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const pageCount = usePdfEditorStore((s) => s.pageCount);
  const pdfDocument = usePdfEditorStore((s) => s.pdfDocument);
  const zoom = usePdfEditorStore((s) => s.zoom);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState<PDFPageProxy | null>(null);

  useEffect(() => {
    if (!pdfDocument) return;

    let cancelled = false;

    pdfDocument
      .getPage(currentPage)
      .then((p) => {
        if (!cancelled) setPage(p);
      })
      .catch(() => {
        // Document may have been destroyed mid-flight (e.g. file changed).
        // Ignore — a fresh effect will run with the new doc.
      });

    return () => {
      cancelled = true;
    };
  }, [currentPage, pdfDocument]);

  const { renderedSize } = usePageRenderer({
    canvasRef,
    page,
    suppressText: true,
    zoom,
  });

  const { fabricCanvas, fabricRef } = useFabricCanvas({
    fabricCanvasRef,
    page,
    renderedSize,
  });
  const { undo, redo } = useEditorHistory({ fabricCanvas, fabricRef });

  useLayoutEffect(() => {
    if (!fabricInstanceRef) return;

    fabricInstanceRef.current = fabricRef.current;

    return () => {
      fabricInstanceRef.current = null;
    };
  }, [fabricCanvas, fabricInstanceRef, fabricRef]);

  // Notify parent when fabricCanvas changes
  useEffect(() => {
    onFabricCanvasReady?.(fabricCanvas);

    return () => onFabricCanvasReady?.(null);
  }, [fabricCanvas, onFabricCanvasReady]);

  useDrawTool({ fabricCanvas });
  useEditTextMode({ fabricCanvas, page });
  useEraserTool({ fabricCanvas });
  useHighlightTool({ fabricCanvas });
  useImageTool({ fabricCanvas });
  useShapeTool({ fabricCanvas });
  const { handleModalClose } = useSignatureTool({ fabricCanvas });

  const isSignatureModalOpen = usePdfEditorStore((s) => s.isSignatureModalOpen);

  // Wire active tool cursor + click handler
  useEffect(() => {
    const fc = fabricCanvas;

    if (!fc) return;

    const cursorMap: Record<string, string> = {
      draw: "crosshair",
      eraser: "pointer",
      highlight: "crosshair",
      image: "default",
      select: "default",
      shape: "crosshair",
      signature: "default",
      text: "text",
      whiteout: "crosshair",
    };

    fc.defaultCursor = cursorMap[activeTool] ?? "default";
    fc.hoverCursor = activeTool === "select" ? "move" : fc.defaultCursor;
    fc.selection = activeTool === "select";

    if (activeTool !== "draw") {
      fc.isDrawingMode = false;
    }

    const handleMouseDown = async (opt: TPointerEventInfo) => {
      if (activeTool !== "text") return;

      // If clicking on an existing object, let Fabric handle it
      const activeObj = fc.getActiveObject();

      if (activeObj) return;

      const pointer = fc.getScenePoint(opt.e);
      const { IText: FabricIText } = await import("fabric");

      const textObj = new FabricIText("", {
        fill: "#000000",
        fontFamily: "Helvetica",
        fontSize: 16,
        left: pointer.x,
        lockScalingX: true,
        lockScalingY: true,
        top: pointer.y,
      }) as IText;

      fc.add(textObj);
      fc.setActiveObject(textObj);
      textObj.enterEditing();
      fc.renderAll();
    };

    fc.on("mouse:down", handleMouseDown);

    return () => {
      fc.off("mouse:down", handleMouseDown);
    };
  }, [activeTool, fabricCanvas]);

  // Keyboard undo/redo + toolbar button events
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (!mod) return;

      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault();
        redo();
      }
    };

    const onUndoEvent = () => undo();
    const onRedoEvent = () => redo();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("editor:undo", onUndoEvent);
    window.addEventListener("editor:redo", onRedoEvent);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("editor:undo", onUndoEvent);
      window.removeEventListener("editor:redo", onRedoEvent);
    };
  }, [undo, redo]);

  return (
    <div className="flex flex-1 items-start justify-center overflow-auto bg-default-100 p-6 pb-40 lg:pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="shadow-lg">
        <div ref={containerRef} className="relative">
          <canvas
            ref={canvasRef}
            aria-label={`PDF page ${currentPage} of ${pageCount}`}
            role="img"
          />
          <canvas
            ref={fabricCanvasRef}
            aria-label={`PDF editing canvas, page ${currentPage} of ${pageCount}`}
            role="application"
          />
          <FloatingTextToolbar
            canvasContainerRef={containerRef}
            fabricCanvas={fabricCanvas}
          />
          <FloatingShapeToolbar
            canvasContainerRef={containerRef}
            fabricCanvas={fabricCanvas}
          />
        </div>
      </div>
      <SignatureModal
        fabricCanvas={fabricCanvas}
        isOpen={isSignatureModalOpen}
        onClose={handleModalClose}
      />
    </div>
  );
}
