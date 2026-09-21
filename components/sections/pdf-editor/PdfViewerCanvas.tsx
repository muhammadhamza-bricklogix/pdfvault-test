"use client";

import type { FabricObject, Textbox, TPointerEventInfo } from "fabric";
import type { PDFPageProxy } from "pdfjs-dist";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { useDrawTool } from "@/lib/client/hooks/pdf-editor/use-draw-tool";
import { useEditTextMode } from "@/lib/client/hooks/pdf-editor/use-edit-text-mode";
import { useEditorHistory } from "@/lib/client/hooks/pdf-editor/use-editor-history";
import { useEraserTool } from "@/lib/client/hooks/pdf-editor/use-eraser-tool";
import { useFabricCanvas } from "@/lib/client/hooks/pdf-editor/use-fabric-canvas";
import { useHighlightTool } from "@/lib/client/hooks/pdf-editor/use-highlight-tool";
import { useImageTool } from "@/lib/client/hooks/pdf-editor/use-image-tool";
import { useIsMobile } from "@/lib/client/hooks/use-is-mobile";
import { usePageRenderer } from "@/lib/client/hooks/pdf-editor/use-page-renderer";
import { useShapeTool } from "@/lib/client/hooks/pdf-editor/use-shape-tool";
import { useSignatureTool } from "@/lib/client/hooks/pdf-editor/use-signature-tool";
import { useTestHarness } from "@/lib/client/hooks/pdf-editor/use-test-harness";
import { useWatermarkTool } from "@/lib/client/hooks/pdf-editor/use-watermark-tool";
import { setLastPointer } from "@/lib/client/pdf-editor/last-pointer";
import { serializeFabricCanvas } from "@/lib/client/pdf-editor/save-utils";
import { shouldWatermarkPage } from "@/lib/client/pdf-editor/watermark-utils";
import { usePdfEditorStore } from "@/lib/client/stores";

import { FloatingTextToolbar } from "./FloatingTextToolbar";
import { FloatingShapeToolbar } from "./FloatingShapeToolbar";
import { SearchHighlightLayer } from "./SearchHighlightLayer";
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
  const setCurrentPage = usePdfEditorStore((s) => s.setCurrentPage);
  const isMobile = useIsMobile();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerScrollRef = useRef<HTMLDivElement>(null);
  // Guards against double-navigation when the scroll handler fires again before
  // the page change + scroll-reset have taken effect.
  const mobilePageNavRef = useRef(false);
  const [fading, setFading] = useState(false);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks whether the last navigation was forward (1) or backward (-1) so the
  // scroll-reset effect can land at the top vs bottom of the incoming page.
  const navDirectionRef = useRef<1 | -1>(1);

  // Fade out → change page → fade in. direction=1 (forward) resets scroll to
  // top; direction=-1 (backward) lands at the bottom of the previous page so
  // the motion feels continuous rather than a jarring jump-to-top.
  const navigatePage = useCallback(
    (targetPage: number, direction: 1 | -1 = 1) => {
      navDirectionRef.current = direction;
      mobilePageNavRef.current = true;
      setFading(true);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      // 200 ms fade-out before the canvas content swaps.
      fadeTimerRef.current = setTimeout(() => {
        setCurrentPage(targetPage);
      }, 200);
    },
    [setCurrentPage],
  );

  const [page, setPage] = useState<PDFPageProxy | null>(null);
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

  // Gate `page` on the current `pdfDocument`. `setPage` runs asynchronously
  // (`.then`), so after a file swap (version restore, Manage Pages save)
  // the `page` state still points at the destroyed proxy from the previous
  // file — `use-page-renderer`'s `page ? renderedSize : null` guard
  // (2abb697) can't fire because the stale proxy is truthy, so
  // `useFabricCanvas`'s `hasRenderedSize` stays true and the OLD file's
  // overlays keep painting over the restored bytes until the user hard-
  // refreshes (QA report 2026-07-23). Deriving the effective page here
  // avoids a setState-in-effect while still flipping the guard the moment
  // the store's `pdfDocument` clears.
  const effectivePage = pdfDocument ? page : null;

  // Fit-to-width on first open of every file (mobile + desktop). PDF
  // pages (e.g. 612pt-wide US Letter) leave the user staring at white
  // margins at zoom=1.0 on any viewport that isn't roughly page-sized.
  // Auto-fitting on first load matches the experience users expect from
  // mainstream PDF viewers and saves the manual pinch / + button hunt.
  // Re-fit triggers only on file CHANGE (`fittedFileRef` guard) so the
  // user's subsequent manual zoom adjustments are preserved across page
  // navigation, tool switches, etc.
  //
  // MAX_ZOOM caps at natural page size (1.0). Above 1.0 the browser is
  // effectively rendering the PDF larger than its intrinsic size, and
  // when browser CSS zoom is < 100% the container's CSS width can
  // compute a fit ratio above the toolbar's zoom-in ceiling — locking
  // the user at max zoom with no headroom to zoom in further. Capping
  // at natural size keeps `+` always operable and mirrors Adobe /
  // macOS Preview defaults (fit-to-width never enlarges past 100%).
  useEffect(() => {
    if (!effectivePage || !file || !viewerScrollRef.current) return;
    if (fittedFileRef.current === file) return;

    // Match the `p-6` (24px) horizontal padding on the scroll container.
    const HORIZONTAL_PADDING = 48;
    const available = viewerScrollRef.current.clientWidth - HORIZONTAL_PADDING;

    if (available <= 0) return;

    const baseViewport = effectivePage.getViewport({ scale: 1 });
    // 0.95 leaves a small visual breathing margin so the page doesn't butt
    // against the scroll-area edge.
    const fitZoom = (available / baseViewport.width) * 0.95;
    const MIN_ZOOM = 0.5;
    const MAX_ZOOM = 1;
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fitZoom));

    usePdfEditorStore.getState().setZoom(clamped);
    fittedFileRef.current = file;
  }, [effectivePage, file]);

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
    page: effectivePage,
    suppressText: isPageExtracted,
    zoom,
  });

  // Keeps the viewport's visual center anchored across zoom changes: useLayoutEffect
  // captures the centered fraction before usePageRenderer resizes the canvas, and the
  // effect below re-applies it after the resize so the same point stays centered.
  const scrollAnchorRef = useRef<{ fracX: number; fracY: number } | null>(
    null,
  );
  const prevZoomRef = useRef(zoom);

  useLayoutEffect(() => {
    const el = viewerScrollRef.current;

    if (el && zoom !== prevZoomRef.current) {
      const { scrollWidth, scrollHeight, clientWidth, clientHeight } = el;

      if (scrollWidth > 0 && scrollHeight > 0) {
        scrollAnchorRef.current = {
          fracX: (el.scrollLeft + clientWidth / 2) / scrollWidth,
          fracY: (el.scrollTop + clientHeight / 2) / scrollHeight,
        };
      }
    }
    prevZoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    const el = viewerScrollRef.current;
    const anchor = scrollAnchorRef.current;

    if (!el || !anchor) return;

    el.scrollLeft = anchor.fracX * el.scrollWidth - el.clientWidth / 2;
    el.scrollTop = anchor.fracY * el.scrollHeight - el.clientHeight / 2;
    scrollAnchorRef.current = null;
  }, [zoom]);

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

  // --- Save-reload flicker fix (2026-08-24) ---
  //
  // Sequence on Save without this listener:
  //   1. `applyPostSaveReset` swaps `store.file` + sweeps `fabricJsonByPage`
  //   2. `usePdfLoader` reloads → `pdfDocument` null → Fabric disposes →
  //      the just-drawn shape/highlight VANISHES from the Fabric layer
  //   3. pdf.js takes ~300-500ms to render the new baked bytes
  //   4. Shape reappears (baked into `savedFile` as a PDF object) → user
  //      sees an ugly flash where the shape blinks out and back
  //
  // With this listener:
  //   • `postSaveReloadPending = true` keeps `renderedSize` alive in
  //     `usePageRenderer`, so Fabric stays mounted with its pre-save
  //     objects visible throughout the reload
  //   • Once the new pdf render finishes, `usePageRenderer` dispatches
  //     `editor:post-save-render-done` — the pdf layer now shows the
  //     baked shape, so we swap Fabric to the swept map in-place via
  //     `loadFromJSON`. Shape stays visible via one layer or the other
  //     the entire time → no visible gap.
  //
  // Guarded by `postSaveReloadPending` so restore-version / Manage
  // Pages saves cycle Fabric via the normal disposal path (they need
  // to, because the new file often has different content).
  useEffect(() => {
    const handler = () => {
      const state = usePdfEditorStore.getState();

      if (!state.postSaveReloadPending) return;
      const fc = fabricRef.current;

      if (!fc) return;
      const source = state.getSourcePageIndex(state.currentPage);
      const saved = state.fabricJsonByPage.get(source);

      void (async () => {
        // `loadFromJSON` fires `object:added` per restored object. Those
        // events reach `use-editor-history.ts`'s `snapshot` +
        // `markDirtyOnAdd` handlers, which call `saveFabricJson` +
        // `markDocumentDirty` — both flip `hasUnsavedChanges` back to
        // true immediately after the save just cleared it, so the
        // "Unsaved edits" chip persists even though the file is saved
        // (QA 2026-09-07). Gate the reload with `isRestoringHistory` so
        // those listeners bail. Cleared in `finally` even if
        // `loadFromJSON` throws, so a bad-JSON page doesn't leave the
        // flag stuck on and mask future user edits.
        state.setIsRestoringHistory(true);
        try {
          if (saved) {
            await fc.loadFromJSON(JSON.parse(saved));
          } else {
            fc.clear();
          }
          fc.setZoom(state.zoom);
          fc.renderAll();
        } catch {
          // Best-effort: on a bad-JSON parse we leave Fabric as-is
          // rather than clearing to blank. The dispose-on-page-change
          // path will normalize state on next navigation.
        } finally {
          state.setIsRestoringHistory(false);
          state.clearPostSaveReloadPending();
        }
      })();
    };

    window.addEventListener("editor:post-save-render-done", handler);

    return () => {
      window.removeEventListener("editor:post-save-render-done", handler);
    };
  }, [fabricRef]);

  // Live thumbnail sync — after any Fabric edit on the current page, composite
  // the PDF canvas + Fabric canvas into a JPEG data URL and push it to the
  // store so the thumbnail sidebar reflects the change immediately.
  // Debounced to 500 ms so rapid keystrokes don't flood canvas.toDataURL calls.
  useEffect(() => {
    if (!fabricCanvas) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const capture = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const pdfCanvas = canvasRef.current;
        const fabricLower = fabricCanvas.lowerCanvasEl as
          | HTMLCanvasElement
          | undefined;

        if (!pdfCanvas || !fabricLower) return;

        const tmp = document.createElement("canvas");

        tmp.width = pdfCanvas.width;
        tmp.height = pdfCanvas.height;
        const ctx = tmp.getContext("2d");

        if (!ctx) return;
        ctx.drawImage(pdfCanvas, 0, 0);
        ctx.drawImage(fabricLower, 0, 0);
        const dataUrl = tmp.toDataURL("image/jpeg", 0.7);
        const page = usePdfEditorStore.getState().currentPage;

        usePdfEditorStore.getState().setThumbnailSnapshot(page, dataUrl);
      }, 500);
    };

    fabricCanvas.on("object:modified", capture);
    fabricCanvas.on("object:added", capture);
    fabricCanvas.on("object:removed", capture);
    fabricCanvas.on("text:changed", capture);

    return () => {
      if (timer) clearTimeout(timer);
      fabricCanvas.off("object:modified", capture);
      fabricCanvas.off("object:added", capture);
      fabricCanvas.off("object:removed", capture);
      fabricCanvas.off("text:changed", capture);
    };
  }, [fabricCanvas]);

  useTestHarness(fabricCanvas);

  useDrawTool({ fabricCanvas });
  // `useEditTextMode` decides internally whether to extract: it runs only
  // when the user has activated the "Edit Text" toolbar tool for a page
  // that hasn't been extracted yet. After a successful extraction it
  // marks the source page in `extractedPages` (store), which is what
  // flips `suppressText` above on. The Fabric overlay always receives the
  // canvas — the hook itself guards work, so the IText objects stay
  // tappable even when the user switches back to Select / Draw / etc.
  useEditTextMode({ fabricCanvas, page: effectivePage });
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
          // Structural check — extracted text is now a Textbox (extends
          // IText). `enterEditing` exists on both, so the instanceof
          // check we previously had against IText would miss Textbox.
          const editable = target as unknown as {
            enterEditing?: (e?: Event) => void;
            setCursorByClick?: (e?: Event) => void;
            initDelayedCursor?: (restart?: boolean) => void;
          };

          if (typeof editable.enterEditing === "function") {
            fc.setActiveObject(target);
            editable.enterEditing(opt.e);
            // Position the caret at the tapped glyph. `enterEditing()` only
            // flips editing on — it leaves selectionStart at 0, so the first
            // keystroke would insert at the START of the run instead of where
            // the user tapped (reported as "typing starts a few chars before
            // my cursor"). Fabric's built-in click-to-edit flow calls
            // `setCursorByClick`; because we shortcut straight into editing on
            // the first tap, we have to do the same ourselves.
            editable.setCursorByClick?.(opt.e);
            editable.initDelayedCursor?.(true);
            fc.renderAll();
          }

          return;
        }

        // Clicked on some other object (shape / drawing / signature /
        // image / etc.) while Edit Text is active — leave that object
        // alone. Creating a new text box on top of it would be
        // surprising. Only empty-space clicks fall through to the
        // Textbox-creation path below.
        if (target) return;

        // Empty space in Edit Text mode → fall through to the Textbox
        // creation logic normally reserved for the Text tool. QA
        // 2026-09-08: user was clicking empty space with Edit selected
        // and expected an empty box to type in — same intuition as
        // clicking with the Text tool.
      } else if (activeTool !== "text") {
        return;
      }

      // If clicking on an existing object, let Fabric handle it
      const activeObj = fc.getActiveObject();

      if (activeObj) return;

      const pointer = fc.getScenePoint(opt.e);
      const { Textbox: FabricTextbox } = await import("fabric");

      // Default new text boxes to ~240pt wide (a comfortable paragraph
      // width on US Letter / A4), but ensure the box always fits
      // horizontally on the page — QA 2026-09-10: "if I am adding the
      // text box then it's going under the page on left and right".
      //
      // Previous version used `Math.max(80, Math.min(240, pageW -
      // pointer.x - 16))` — the `Math.max(80, …)` floor meant a click
      // 20pt from the right edge still produced an 80-wide box that
      // overflowed the page by ~60pt. Same overflow was possible on
      // the left when `pointer.x` was very close to (or beyond) 0.
      //
      // Fix: pick a preferred width, then clamp the box's left origin
      // so `left + width + rightMargin <= pageW` AND `left >= 0`. If
      // the horizontal budget can't fit the min width (extremely
      // narrow window or malformed pointer), shrink the box to
      // whatever WILL fit — better a thin box that's on-page than a
      // "normal" box hanging off it. Wrap is grapheme-based so typed
      // content can never overflow horizontally, regardless of
      // whether the text contains whitespace.
      const pageW = fc.getWidth();
      const rightMargin = 16;
      const minWidth = 80;
      const preferredWidth = 240;
      const usableWidth = Math.max(0, pageW - rightMargin);

      // Width: as much as fits, capped at preferredWidth. If usable
      // space is smaller than minWidth (edge case), width collapses
      // to usableWidth rather than overflowing.
      const boxWidth = Math.min(
        preferredWidth,
        Math.max(Math.min(minWidth, usableWidth), 1),
      );

      // Left origin: clamp so the box's right edge sits at or before
      // `pageW - rightMargin`. If pointer.x itself is negative
      // (shouldn't happen with getScenePoint on a well-formed canvas
      // but guard anyway), snap to 0.
      const clampedLeft = Math.max(
        0,
        Math.min(pointer.x, pageW - rightMargin - boxWidth),
      );

      const textObj = new FabricTextbox("", {
        fill: "#000000",
        fontFamily: "Helvetica",
        fontSize: 16,
        left: clampedLeft,
        splitByGrapheme: true,
        top: pointer.y,
        width: boxWidth,
      }) as Textbox;

      // Remove the text object on exit if the user left it empty — otherwise
      // every accidental click on the text tool leaves a phantom IText in the
      // canvas JSON and inflates history snapshots.
      const onEditingExited = () => {
        const store = usePdfEditorStore.getState();

        if (!textObj.text || textObj.text.trim() === "") {
          fc.remove(textObj);
          fc.renderAll();
        } else {
          // Persist synchronously — matches the 2026-07-23 draw/signature
          // pattern. Without this, the Textbox lives only on the live
          // canvas until the next Save flushes it. If Save flushes at a
          // moment the canvas is empty (mid-remount race) OR the user
          // exports before Save flushes, the typed text vanishes from
          // the exported file.
          store.saveFabricJson(store.currentPage, serializeFabricCanvas(fc));
          store.markDocumentDirty();
        }
        textObj.off("editing:exited", onEditingExited);
      };

      textObj.on("editing:exited", onEditingExited);

      fc.add(textObj);
      fc.setActiveObject(textObj);
      textObj.enterEditing();
      fc.renderAll();
    };

    // Resize handles must change the bounding box, NOT the rendered font
    // size. Fabric's default behaviour multiplies the visible glyphs by
    // scaleX/scaleY when the user drags corners — the user perceives this
    // as "the font got bigger". Fold the scale into width/height instead
    // and reset scaleX/scaleY to 1. Textbox (used for extracted source
    // text) consumes the new width as its wrap point, so the box's text
    // re-wraps without the font growing. We hook both `object:scaling`
    // for live preview and `object:modified` to commit the final state
    // when the user releases the handle.
    const handleScaling = (opt: { target?: FabricObject }) => {
      const t = opt.target as
        | (FabricObject & {
            editorType?: string;
            width?: number;
            height?: number;
          })
        | undefined;

      if (!t || t.editorType !== "editModeText") return;

      const sx = (t.scaleX as number) ?? 1;
      const sy = (t.scaleY as number) ?? 1;

      if (sx === 1 && sy === 1) return;

      const newWidth = Math.max(8, ((t.width as number) ?? 0) * sx);
      const newHeight = Math.max(8, ((t.height as number) ?? 0) * sy);

      t.set({
        height: newHeight,
        scaleX: 1,
        scaleY: 1,
        width: newWidth,
      });
    };

    fc.on("mouse:down", handleMouseDown);
    fc.on("object:scaling", handleScaling);
    fc.on("object:modified", handleScaling);

    // Track the last pointer position in BASE coords so tools that open
    // a modal (signature, image) can drop their object where the user
    // was hovering. Falls back to page centre if unset (mobile taps
    // without a preceding hover).
    let lastMoveTs = 0;
    const handleMouseMove = (opt: TPointerEventInfo) => {
      const now = Date.now();

      if (now - lastMoveTs < 32) return;
      lastMoveTs = now;
      const p = (opt as unknown as { scenePoint?: { x: number; y: number } })
        .scenePoint;

      if (!p) return;
      setLastPointer(p.x, p.y, usePdfEditorStore.getState().currentPage);
    };

    fc.on("mouse:move", handleMouseMove);

    return () => {
      fc.off("mouse:down", handleMouseDown);
      fc.off("object:scaling", handleScaling);
      fc.off("object:modified", handleScaling);
      fc.off("mouse:move", handleMouseMove);
    };
  }, [activeTool, fabricCanvas]);

  // Keyboard undo/redo + delete + toolbar button events
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't hijack keys when the user is typing in a sidebar input,
      // watermark text field, range input, etc. Also skip when an IText
      // is in edit mode — its own keydown handles backspace/delete to
      // edit text rather than delete the whole object.
      const active = document.activeElement;
      const tag = active?.tagName;
      const inTextField =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (active as HTMLElement | null)?.isContentEditable;

      const fc = fabricCanvas;
      const activeObj = fc?.getActiveObject() as
        | (FabricObject & { isEditing?: boolean })
        | undefined;
      const isITextEditing = !!activeObj && activeObj.isEditing === true;

      // Delete / Backspace removes the currently-selected Fabric object
      // (annotation, shape, signature, watermark stamp, page number, etc.).
      // Multiple objects are removed when an ActiveSelection is the target.
      // Guarded against typing in form fields and against an IText edit
      // session — there the keys belong to the text editor.
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !inTextField &&
        !isITextEditing &&
        fc &&
        activeObj
      ) {
        e.preventDefault();
        const sel = activeObj as FabricObject & {
          type?: string;
          getObjects?: () => FabricObject[];
        };

        if (
          (sel.type === "activeselection" || sel.type === "activeSelection") &&
          typeof sel.getObjects === "function"
        ) {
          for (const obj of sel.getObjects()) fc.remove(obj);
        } else {
          fc.remove(activeObj);
        }
        fc.discardActiveObject();
        fc.requestRenderAll();

        return;
      }

      const mod = e.metaKey || e.ctrlKey;

      if (!mod) return;

      if (inTextField) return;

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
  }, [undo, redo, fabricCanvas]);

  // Pinch-zoom (mobile) + wheel-zoom (desktop trackpad / Cmd-wheel).
  // Both call `setZoom` directly on the store — `use-page-renderer.ts` re-renders
  // the PDF layer at the new zoom, and once that completes `use-fabric-canvas.ts`'s
  // resize effect picks up the paired `renderedSize.zoom` to resize/rezoom the
  // overlay in lockstep, so nothing else needs to know about gestures.
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

  // Reset scroll to top on every page change so arriving on a new page always
  // starts at the top. Also clears the navigation guard so the scroll handler
  // is ready for the next bottom-reach.
  useEffect(() => {
    const el = viewerScrollRef.current;

    if (el) {
      if (navDirectionRef.current === -1) {
        // Backward navigation → land at the bottom so the gesture feels like
        // the user scrolled back up into the previous page.
        el.scrollTop = 999999; // browser clamps to actual scrollHeight
      } else {
        el.scrollTop = 0;
      }
    }

    mobilePageNavRef.current = false;
    // 50 ms lets the new page content render before fading in (slow reveal).
    const t = setTimeout(() => setFading(false), 50);

    return () => clearTimeout(t);
  }, [currentPage]);

  // Page navigation via wheel OVERSCROLL. The previous "reach the bottom →
  // flip" behaviour force-scrolled users away from the bottom of the page
  // even when they only wanted to READ content near the bottom edge (QA
  // report 2026-08-20). The overscroll model matches Kindle / Apple Books /
  // Google Docs: sitting at the boundary does nothing; the page only flips
  // when the user actively pushes past it with continued wheel input.
  //
  //   • Wheel DOWN while at the bottom → accumulate deltaY; after ~140 px
  //     of overscroll in a continuous gesture, advance one page.
  //   • Wheel UP while at the top → same accumulator, retreat one page.
  //   • Scrolling in the middle of the page resets the accumulator so
  //     overscroll must be a continuous intent, not stitched across pauses.
  //
  // Mobile page navigation stays on the swipe / pull-at-boundary gestures
  // in the effect below — native touch scroll simply stops at the edge,
  // giving readers all the dwell time they want.
  useEffect(() => {
    if (pageCount <= 1) return;
    const el = viewerScrollRef.current;

    if (!el) return;

    const OVERSCROLL_THRESHOLD = 140; // px of push-past-edge before flipping
    const RESET_MS = 700; // clears accumulator if the user pauses
    let overscroll = 0;
    let resetTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleReset = () => {
      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        overscroll = 0;
        resetTimer = null;
      }, RESET_MS);
    };

    const clearAccumulator = () => {
      overscroll = 0;
      if (resetTimer) {
        clearTimeout(resetTimer);
        resetTimer = null;
      }
    };

    const onWheelNav = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return; // zoom handled elsewhere
      if (mobilePageNavRef.current) return;
      const state = usePdfEditorStore.getState();
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
      const atTop = el.scrollTop <= 0;

      if (e.deltaY > 0 && atBottom && state.currentPage < state.pageCount) {
        overscroll += e.deltaY;
        scheduleReset();
        if (overscroll >= OVERSCROLL_THRESHOLD) {
          clearAccumulator();
          navigatePage(state.currentPage + 1, 1);
        }
      } else if (e.deltaY < 0 && atTop && state.currentPage > 1) {
        overscroll += Math.abs(e.deltaY);
        scheduleReset();
        if (overscroll >= OVERSCROLL_THRESHOLD) {
          clearAccumulator();
          navigatePage(state.currentPage - 1, -1);
        }
      } else {
        // Scrolling within the page — reset so accumulated overscroll
        // must be a continuous gesture, not stitched across pauses.
        clearAccumulator();
      }
    };

    el.addEventListener("wheel", onWheelNav, { passive: true });

    return () => {
      clearAccumulator();
      el.removeEventListener("wheel", onWheelNav);
    };
  }, [pageCount, navigatePage]);

  // Mobile swipe / pull gestures for page navigation.
  // Registered on document (not viewerScrollRef) because Fabric registers its
  // own touchend listener on document — touch events from the canvas element
  // would not reliably bubble to the inner scroll container by the time Fabric
  // finishes processing them.
  //
  //   • Swipe LEFT  → next page
  //   • Swipe RIGHT → previous page
  //   • Pull DOWN at the very top → previous page
  //   • Pull UP at the very bottom → next page
  //
  // Skipped when a drawing tool is active (those gestures belong to Fabric).
  // Skipped for horizontal swipes when the page has real horizontal overflow
  // (user is panning a zoomed-in page, not flipping pages).
  useEffect(() => {
    if (!isMobile || pageCount <= 1) return;
    const el = viewerScrollRef.current;

    if (!el) return;

    const DRAW_TOOL_SET = new Set([
      "draw",
      "eraser",
      "highlight",
      "redact",
      "shape",
      "whiteout",
    ]);

    let startX = 0;
    let startY = 0;
    let startScrollTop = 0;
    // Track whether the touch started inside the PDF viewer element.
    // The listeners below are attached to `document` so Fabric's own
    // touch handling doesn't swallow them, but that means every touch
    // on the page fires here — including swipes on the BottomDock's
    // tool-tabs strip and the FloatingTextToolbar. Without this guard,
    // a horizontal swipe on the dock (dx=278, dy=0) satisfies the
    // `absDx > absDy && absDx > 50 && !hasHorizontalOverflow` branch
    // below and inadvertently flips PDF pages. QA report 2026-08-26:
    // "when I scroll the bottom nav the above page viewer is scrolling
    // automatically" — actually the PAGE was changing, not scrolling.
    let touchStartedInsideViewer = false;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startScrollTop = el.scrollTop;
      const target = e.target as (Node & Element) | null;
      const inViewer = Boolean(target && el.contains(target));
      // FloatingTextToolbar and FloatingShapeToolbar are DOM-nested
      // INSIDE `viewerScrollRef` (they render inside `containerRef` so
      // they can absolutely-position relative to the canvas on desktop),
      // even though on mobile they're `position: fixed` at the bottom
      // of the screen. So `el.contains(target)` returns true for
      // touches on them, and horizontal swipes on the FONT/SIZE/STYLE
      // strip inadvertently flipped PDF pages via `navigatePage()`
      // below. Exclude any element inside a `data-editor-overlay`
      // subtree — the two floating toolbars carry that attribute on
      // their mobile branch. Same pattern as the earlier BottomDock
      // fix which lives OUTSIDE the viewer entirely; overlays inside
      // the viewer need an explicit opt-out.
      const isOverlay = Boolean(target?.closest?.("[data-editor-overlay]"));

      touchStartedInsideViewer = inViewer && !isOverlay;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length !== 1) return;
      if (mobilePageNavRef.current) return;
      // Bail if the gesture started outside the viewer — dock, toolbar,
      // hamburger menu, modal chrome, etc. See `touchStartedInsideViewer`
      // comment above for the failure mode this prevents.
      if (!touchStartedInsideViewer) return;

      const state = usePdfEditorStore.getState();

      if (DRAW_TOOL_SET.has(state.activeTool)) return;

      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // ── Horizontal swipe (swipe left = next, swipe right = prev) ──────
      const hasHorizontalOverflow = el.scrollWidth > el.clientWidth + 10;

      if (absDx > absDy && absDx > 50 && !hasHorizontalOverflow) {
        if (dx < 0 && state.currentPage < state.pageCount) {
          navigatePage(state.currentPage + 1, 1);
        } else if (dx > 0 && state.currentPage > 1) {
          navigatePage(state.currentPage - 1, -1);
        }

        return;
      }

      // ── Vertical pull at boundary ─────────────────────────────────────
      if (absDy > absDx && absDy > 60) {
        const atTop = startScrollTop === 0;
        const atBottom =
          startScrollTop + el.clientHeight >= el.scrollHeight - 20;

        if (dy > 0 && atTop && state.currentPage > 1) {
          navigatePage(state.currentPage - 1, -1);
        }

        if (dy < 0 && atBottom && state.currentPage < state.pageCount) {
          navigatePage(state.currentPage + 1, 1);
        }
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [isMobile, pageCount, navigatePage]);

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
      <div
        className="mx-auto w-fit"
        style={{
          opacity: fading ? 0 : 1,
          // Fast fade-out hides old content quickly; slow fade-in gives the new
          // page a gentle reveal that feels like a Google Docs page transition.
          transition: fading
            ? "opacity 200ms ease-out"
            : "opacity 350ms ease-in",
        }}
      >
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
            <SearchHighlightLayer currentPage={currentPage} zoom={zoom} />
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
