"use client";

import type { IText, TPointerEventInfo } from "fabric";
import type { PDFPageProxy } from "pdfjs-dist";

import { useEffect, useRef, useState } from "react";

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
import { useWatermarkTool } from "@/lib/client/hooks/pdf-editor/use-watermark-tool";
import { useIsMobile } from "@/lib/client/hooks/use-is-mobile";
import { shouldWatermarkPage } from "@/lib/client/pdf-editor/watermark-utils";
import { usePdfEditorStore } from "@/lib/client/stores";

import { FloatingTextToolbar } from "./FloatingTextToolbar";
import { FloatingShapeToolbar } from "./FloatingShapeToolbar";
import { SignatureModal } from "./SignatureModal";

type PdfViewerCanvasProps = {
  onFabricCanvasReady?: (canvas: import("fabric").Canvas | null) => void;
};

export function PdfViewerCanvas({ onFabricCanvasReady }: PdfViewerCanvasProps) {
  const activeTool = usePdfEditorStore((s) => s.activeTool);
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const pageCount = usePdfEditorStore((s) => s.pageCount);
  const pdfDocument = usePdfEditorStore((s) => s.pdfDocument);
  const backgroundImageConfig = usePdfEditorStore(
    (s) => s.backgroundImageConfig,
  );
  const sourcePage = usePdfEditorStore((s) => {
    const order = s.pageOrder;

    if (!order.length) return s.currentPage;

    return order[s.currentPage - 1] ?? s.currentPage;
  });
  const zoom = usePdfEditorStore((s) => s.zoom);
  const isPageExtracted = usePdfEditorStore((s) =>
    s.extractedPages.has(s.getSourcePageIndex(s.currentPage)),
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerScrollRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const isMobile = useIsMobile();
  const file = usePdfEditorStore((s) => s.file);
  const fittedFileRef = useRef<File | null>(null);

  useEffect(() => {
    if (!pdfDocument) return;

    let cancelled = false;

    pdfDocument
      .getPage(sourcePage)
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
  }, [sourcePage, pdfDocument]);

  // Fit-to-width on mobile when a new file is opened. PDF pages (e.g.
  // 612pt-wide US Letter) overflow narrow viewports at zoom=1.0, leaving the
  // user staring at white margins until they pinch-zoom out. Mobile Safari
  // also misrenders the Fabric IText overlay at the very small zoom values
  // that aggressive pinching produces, so the page appears blank. Picking a
  // fit-width zoom on first load keeps the experience close to desktop.
  useEffect(() => {
    if (!isMobile) {
      fittedFileRef.current = null;

      return;
    }

    if (!page || !file || !viewerScrollRef.current) return;
    if (fittedFileRef.current === file) return;

    // Match the `p-6` (24px) horizontal padding on the scroll container.
    const HORIZONTAL_PADDING = 48;
    const available = viewerScrollRef.current.clientWidth - HORIZONTAL_PADDING;

    if (available <= 0) return;

    const baseViewport = page.getViewport({ scale: 1 });
    // 0.95 leaves a small visual breathing margin so the page doesn't butt
    // against the scroll-area edge.
    const fitZoom = (available / baseViewport.width) * 0.95;
    const MIN_ZOOM = 0.5;
    const MAX_ZOOM = 2;
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fitZoom));

    usePdfEditorStore.getState().setZoom(clamped);
    fittedFileRef.current = file;
  }, [isMobile, page, file]);

  const bgShouldShow =
    backgroundImageConfig.enabled &&
    !!backgroundImageConfig.imageData &&
    shouldWatermarkPage(
      currentPage,
      pageCount,
      backgroundImageConfig.pageScope,
      backgroundImageConfig.customPageRange,
    );

  // Text rendering is two-mode:
  //   • Default: pdf.js paints text natively (suppressText=false). Works
  //     everywhere, including older iOS Safari WebKit where pdf.js's
  //     `getTextContent` throws — we just don't call it.
  //   • After the user activates the "Edit Text" tool and extraction
  //     succeeds for this source page (tracked via `extractedPages` in the
  //     store): the page is in IText-overlay mode (suppressText=true). The
  //     Fabric IText layer owns text rendering AND lets the user tap any
  //     run to edit. Once a page is extracted, it stays extracted until
  //     the file changes — so users don't have to re-arm Edit Text per
  //     navigation.
  // `useEditTextMode` is what flips the page from default → extracted.
  const { renderedSize } = usePageRenderer({
    canvasRef,
    page,
    suppressText: isPageExtracted,
    zoom,
  });

  const bgObjectFit: "contain" | "cover" | "fill" =
    backgroundImageConfig.fit === "stretch"
      ? "fill"
      : backgroundImageConfig.fit;

  const { fabricCanvas, fabricRef } = useFabricCanvas({
    fabricCanvasRef,
    renderedSize,
  });
  const { undo, redo } = useEditorHistory({ fabricCanvas, fabricRef });

  // Notify parent when fabricCanvas changes
  useEffect(() => {
    onFabricCanvasReady?.(fabricCanvas);

    return () => onFabricCanvasReady?.(null);
  }, [fabricCanvas, onFabricCanvasReady]);

  useDrawTool({ fabricCanvas });
  // `useEditTextMode` decides internally whether to extract: it runs only
  // when the user has activated the "Edit Text" toolbar tool for a page
  // that hasn't been extracted yet. After a successful extraction it
  // marks the source page in `extractedPages` (store), which is what
  // flips `suppressText` above on. The Fabric overlay always receives the
  // canvas — the hook itself guards work, so the IText objects stay
  // tappable even when the user switches back to Select / Draw / etc.
  useEditTextMode({ fabricCanvas, page });
  useEraserTool({ fabricCanvas });
  useHighlightTool({ fabricCanvas });
  useImageTool({ fabricCanvas });
  useShapeTool({ fabricCanvas });
  const { handleModalClose } = useSignatureTool({ fabricCanvas });

  useWatermarkTool({ fabricCanvas });

  const isSignatureModalOpen = usePdfEditorStore((s) => s.isSignatureModalOpen);

  // Wire active tool cursor + click handler
  useEffect(() => {
    const fc = fabricCanvas;

    if (!fc) return;

    const cursorMap: Record<string, string> = {
      draw: "crosshair",
      editText: "text",
      eraser: "pointer",
      highlight: "crosshair",
      image: "default",
      select: "default",
      redact: "crosshair",
      shape: "crosshair",
      signature: "default",
      text: "text",
      watermark: "default",
      whiteout: "crosshair",
    };

    // Fabric requires mutating the canvas instance directly to change
    // cursors / selection mode — the immutability rule doesn't apply here.
    /* eslint-disable react-hooks/immutability */
    fc.defaultCursor = cursorMap[activeTool] ?? "default";
    if (activeTool === "select") {
      fc.hoverCursor = "move";
    } else if (activeTool === "editText") {
      fc.hoverCursor = "text";
    } else {
      fc.hoverCursor = fc.defaultCursor;
    }
    fc.selection = activeTool === "select" || activeTool === "editText";

    if (activeTool !== "draw") {
      fc.isDrawingMode = false;
    }
    /* eslint-enable react-hooks/immutability */

    const handleMouseDown = async (opt: TPointerEventInfo) => {
      // Edit Text tool — tap any IText sentence to start editing it.
      // Without this handler users would need Fabric's default
      // select-then-click sequence, which feels broken on touch.
      if (activeTool === "editText") {
        const target = opt.target as
          | (import("fabric").FabricObject & { editorType?: string })
          | null;

        if (target && target.editorType === "editModeText") {
          const { IText: FabricIText } = await import("fabric");

          if (target instanceof FabricIText) {
            fc.setActiveObject(target);
            target.enterEditing(opt.e);
            // Position the caret at the tapped glyph. `enterEditing()` only
            // flips editing on — it leaves selectionStart at 0, so the first
            // keystroke would insert at the START of the run instead of where
            // the user tapped (reported as "typing starts a few chars before
            // my cursor"). Fabric's built-in click-to-edit flow calls
            // `setCursorByClick`; because we shortcut straight into editing on
            // the first tap, we have to do the same ourselves.
            target.setCursorByClick(opt.e);
            target.initDelayedCursor(true);
            fc.renderAll();
          }
        }

        return;
      }

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

      // Remove the text object on exit if the user left it empty — otherwise
      // every accidental click on the text tool leaves a phantom IText in the
      // canvas JSON and inflates history snapshots.
      const onEditingExited = () => {
        if (!textObj.text || textObj.text.trim() === "") {
          fc.remove(textObj);
          fc.renderAll();
        }
        textObj.off("editing:exited", onEditingExited);
      };

      textObj.on("editing:exited", onEditingExited);

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

      // Don't hijack Ctrl+Z when the user is typing in a sidebar input,
      // watermark text field, range input, etc.
      const active = document.activeElement;
      const tag = active?.tagName;

      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (active as HTMLElement | null)?.isContentEditable
      ) {
        return;
      }

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

  // Pinch-zoom (mobile) + wheel-zoom (desktop trackpad / Cmd-wheel).
  // Both call `setZoom` directly on the store — `use-fabric-canvas.ts` already
  // watches `zoom` and resizes the canvas in its resize effect (lines 153-173),
  // so nothing else needs to know about gestures.
  useEffect(() => {
    const el = containerRef.current;

    if (!el) return;

    const MIN_ZOOM = 0.25;
    const MAX_ZOOM = 4;
    const clamp = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
    // Pinch-zoom (mobile) is clamped tighter: below ~0.5 on iOS Safari the
    // Fabric IText overlay stops rendering and the page goes blank, so we
    // keep the mobile floor at the toolbar's preset minimum.
    const PINCH_MIN_ZOOM = 0.5;
    const PINCH_MAX_ZOOM = 2;
    const clampPinch = (z: number) =>
      Math.min(PINCH_MAX_ZOOM, Math.max(PINCH_MIN_ZOOM, z));

    // Latest zoom is read off the store at gesture-start time so we don't
    // close over a stale React-snapshot value.
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // bare wheel scrolls the page
      e.preventDefault();
      const current = usePdfEditorStore.getState().zoom;
      // Multiplicative step — feels natural at any zoom level.
      const factor = Math.exp(-e.deltaY * 0.001);

      usePdfEditorStore.getState().setZoom(clamp(current * factor));
    };

    let pinchStartDist = 0;
    let pinchStartZoom = 1;

    const dist = (a: Touch, b: Touch) =>
      Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      pinchStartDist = dist(e.touches[0], e.touches[1]);
      pinchStartZoom = usePdfEditorStore.getState().zoom;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || pinchStartDist === 0) return;
      e.preventDefault(); // suppress the page's native pinch
      const d = dist(e.touches[0], e.touches[1]);
      const ratio = d / pinchStartDist;

      usePdfEditorStore.getState().setZoom(clampPinch(pinchStartZoom * ratio));
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchStartDist = 0;
    };

    // `passive: false` so preventDefault() is respected — otherwise iOS
    // Safari will scroll the page out from under the pinch.
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  return (
    <div
      ref={viewerScrollRef}
      className="flex-1 touch-pan-x touch-pan-y overflow-auto bg-default-100 p-6 pb-40 lg:pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {/*
        `w-fit mx-auto` sizes to the page and auto-centres horizontally.
        Unlike a flex parent with `justify-center`, this lets the scroll
        container reach the left/top edge of the page when zoomed in —
        iOS Safari otherwise pins the centred child and 1-finger swipes
        feel frozen.
      */}
      <div className="mx-auto w-fit">
        <div className="shadow-lg">
          <div ref={containerRef} className="relative bg-white">
            {bgShouldShow && backgroundImageConfig.imageData && (
              /* eslint-disable-next-line @next/next/no-img-element -- data URL preview, not optimizable */
              <img
                aria-hidden
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full"
                src={backgroundImageConfig.imageData}
                style={{
                  objectFit: bgObjectFit,
                  opacity: backgroundImageConfig.opacity,
                }}
              />
            )}
            <canvas
              ref={canvasRef}
              aria-label={`PDF page ${currentPage} of ${pageCount}`}
              role="img"
              style={{
                mixBlendMode: bgShouldShow ? "multiply" : undefined,
                position: "relative",
              }}
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
      </div>
      <SignatureModal
        fabricCanvas={fabricCanvas}
        isOpen={isSignatureModalOpen}
        onClose={handleModalClose}
      />
    </div>
  );
}
