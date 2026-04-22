"use client";

import type { IText, TPointerEventInfo } from "fabric";
import type { PDFPageProxy } from "pdfjs-dist";

import { useEffect, useRef, useState } from "react";

import { useEditorHistory } from "@/lib/client/hooks/pdf-editor/use-editor-history";
import { useFabricCanvas } from "@/lib/client/hooks/pdf-editor/use-fabric-canvas";
import { usePageRenderer } from "@/lib/client/hooks/pdf-editor/use-page-renderer";
import { usePdfEditorStore } from "@/lib/client/stores";

import { FloatingTextToolbar } from "./FloatingTextToolbar";

export function PdfViewerCanvas() {
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

    pdfDocument.getPage(currentPage).then((p) => {
      if (!cancelled) setPage(p);
    });

    return () => {
      cancelled = true;
    };
  }, [currentPage, pdfDocument]);

  const { renderedSize } = usePageRenderer({ canvasRef, page, zoom });

  const { fabricCanvas, fabricRef } = useFabricCanvas({
    fabricCanvasRef,
    renderedSize,
  });
  const { undo, redo } = useEditorHistory({ fabricCanvas, fabricRef });

  // Wire active tool cursor + click handler
  useEffect(() => {
    const fc = fabricCanvas;

    if (!fc) return;

    fc.defaultCursor = activeTool === "text" ? "text" : "default";
    fc.hoverCursor = activeTool === "text" ? "text" : "move";
    fc.isDrawingMode = false;
    fc.selection = activeTool === "select";

    const handleMouseDown = async (opt: TPointerEventInfo) => {
      if (activeTool !== "text") return;

      // If clicking on an existing object, let Fabric handle it
      const activeObj = fc.getActiveObject();

      if (activeObj) return;

      const pointer = fc.getScenePoint(opt.e);
      const { IText: FabricIText } = await import("fabric");

      const textObj = new FabricIText("", {
        fill: "#000000",
        fontFamily: "Arial",
        fontSize: 16,
        left: pointer.x,
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
    <div className="flex flex-1 items-start justify-center overflow-auto bg-[var(--app-surface)] p-6">
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
        </div>
      </div>
    </div>
  );
}
