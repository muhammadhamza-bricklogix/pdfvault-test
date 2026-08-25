"use client";

import type { Canvas as FabricCanvas } from "fabric";

import {
  Comment01Icon,
  Copy01Icon,
  FileExportIcon,
  FileMinusIcon,
  Layers01Icon,
  Layout03Icon,
  LockedIcon,
  SplitIcon,
  TextNumberSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Tooltip } from "@heroui/react";
import { useEffect, useRef, useState } from "react";

import { saveBeforeAction } from "@/lib/client/pdf-editor/save-before-action";
import { usePdfEditorStore } from "@/lib/client/stores";

import { ToolsContent } from "./EditorTopBar";
import { MobileToolPropertiesModal } from "./MobileToolPropertiesModal";
import { ShapePropertiesContent } from "./RightSidebar";
import { ThumbnailStrip } from "./ThumbnailSidebar";

type BottomDockProps = {
  fabricCanvas: FabricCanvas | null;
  onReorderPages?: (fromDisplay: number, toDisplay: number) => void;
};

const ACTION_TOOLS = [
  { id: "compress", label: "Compress", icon: FileMinusIcon },
  { id: "secure", label: "Secure", icon: LockedIcon },
  { id: "merge", label: "Merge", icon: Copy01Icon },
  { id: "split", label: "Split", icon: SplitIcon },
  { id: "flatten", label: "Flatten", icon: Layers01Icon },
  { id: "extract", label: "Extract", icon: FileExportIcon },
  { id: "page-numbers", label: "Page No.", icon: TextNumberSignIcon },
  { id: "annotate", label: "Annotation", icon: Comment01Icon },
] as const;

export function BottomDock({ fabricCanvas, onReorderPages }: BottomDockProps) {
  const pageCount = usePdfEditorStore((s) => s.pageCount);
  const file = usePdfEditorStore((s) => s.file);
  const setIsManagePagesOpen = usePdfEditorStore((s) => s.setIsManagePagesOpen);
  const setIsCompressModalOpen = usePdfEditorStore(
    (s) => s.setIsCompressModalOpen,
  );
  const setIsPasswordModalOpen = usePdfEditorStore(
    (s) => s.setIsPasswordModalOpen,
  );
  const setIsPageNumbersModalOpen = usePdfEditorStore(
    (s) => s.setIsPageNumbersModalOpen,
  );
  const [isThumbsOpen, setIsThumbsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const toggle = () => setIsThumbsOpen((prev) => !prev);

    window.addEventListener("editor:toggle-thumbs", toggle);

    return () => window.removeEventListener("editor:toggle-thumbs", toggle);
  }, []);

  // JS-level touch containment. CSS `touch-action` alone doesn't hold on
  // iOS Safari for `position: fixed` overlays — vertical drags on the
  // dock's padding/gaps still bubble up and scroll the PDF viewer
  // beneath. This listener runs on the outer dock with
  // `{ passive: false }` so we can `preventDefault()` mid-gesture, which
  // iOS respects unconditionally. We only allow the browser's native
  // behavior for touches that both (a) start on an element inside a
  // horizontal scroller marked `data-touch-scroll-x` AND (b) are
  // horizontal-dominant. Everything else is preventDefault'd → no
  // scroll leakage. Logs are intentional for QA — remove once verified.
  useEffect(() => {
    const el = rootRef.current;

    if (!el) return;
    let startX = 0;
    let startY = 0;
    let insideScroller = false;

    const onStart = (event: TouchEvent) => {
      const t = event.touches[0];

      if (!t) return;
      startX = t.clientX;
      startY = t.clientY;
      const target = event.target as HTMLElement | null;

      insideScroller = Boolean(target?.closest?.("[data-touch-scroll-x]"));
      // eslint-disable-next-line no-console
      console.log("[PDFedits] dock touchstart", {
        x: Math.round(startX),
        y: Math.round(startY),
        insideScroller,
        target: target?.tagName,
      });
    };

    const onMove = (event: TouchEvent) => {
      const t = event.touches[0];

      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const isHorizontal = Math.abs(dx) > Math.abs(dy);
      const shouldAllow = insideScroller && isHorizontal;

      if (!shouldAllow && event.cancelable) {
        event.preventDefault();
      }
      // eslint-disable-next-line no-console
      console.log("[PDFedits] dock touchmove", {
        dx: Math.round(dx),
        dy: Math.round(dy),
        isHorizontal,
        insideScroller,
        prevented: !shouldAllow,
      });
    };

    // `passive: false` is required to call preventDefault() on touchmove.
    // iOS Safari and Chrome treat the default as `passive: true` on the
    // document root, but not when we attach explicitly with the option.
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });

    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
    };
  }, []);

  const handleAction = (id: string) => {
    switch (id) {
      case "compress":
        setIsCompressModalOpen(true);
        break;
      case "secure":
        setIsPasswordModalOpen(true);
        break;
      case "page-numbers":
        setIsPageNumbersModalOpen(true);
        break;
      case "merge":
        window.dispatchEvent(new CustomEvent("editor:open-merge"));
        break;
      case "split":
        window.dispatchEvent(new CustomEvent("editor:open-split"));
        break;
      case "flatten":
        window.dispatchEvent(new CustomEvent("editor:open-flatten"));
        break;
      case "extract":
        window.dispatchEvent(new CustomEvent("editor:extract-images"));
        break;
      case "annotate":
        window.dispatchEvent(new CustomEvent("editor:open-annotations"));
        break;
    }
  };

  const handleOpenManagePages = async () => {
    const ok = await saveBeforeAction(
      "Saving your edits before opening Manage Pages.",
    );

    if (ok) setIsManagePagesOpen(true);
  };

  return (
    // `touch-none` (= `touch-action: none`) on the outer fixed chrome
    // so ANY touch that starts on the dock — including padding between
    // buttons, gaps around the strip, the Manage button, or the
    // thumbnail-strip wrapper — is consumed with no scroll effect. The
    // inner horizontal scroll strip below re-enables `touch-pan-x` for
    // itself so users can still swipe the tool tabs left/right. Button
    // taps are unaffected because `touch-action` doesn't gate click
    // events. Prior `touch-pan-x` on the inner strip only worked when
    // the finger landed EXACTLY on that scroll strip; touches on the
    // outer div's padding still leaked to the PDF viewer above via
    // iOS Safari's default scroll-chaining behavior. QA report
    // 2026-08-26 (second pass).
    <div
      ref={rootRef}
      aria-label="Editor dock"
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-30 flex touch-none flex-col border-t border-default-200 bg-[var(--color-background)]/95 shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.15)] backdrop-blur-md"
      role="toolbar"
    >
      <ShapePropertiesContent
        fabricCanvas={fabricCanvas}
        orientation="horizontal"
        variant="strip"
      />

      <div className="flex items-center gap-2 px-2 py-2">
        {pageCount > 0 && (
          <Tooltip delay={300}>
            <Button
              aria-label="Manage pages"
              className="h-auto shrink-0 flex-col gap-0.5 px-2.5 py-1.5"
              size="sm"
              variant="tertiary"
              onPress={() => void handleOpenManagePages()}
            >
              <HugeiconsIcon icon={Layout03Icon} size={18} />
              <span className="text-[10px] leading-tight">Manage</span>
            </Button>
            <Tooltip.Content>
              <p>Manage pages</p>
            </Tooltip.Content>
          </Tooltip>
        )}

        {/* `touch-pan-x` (= `touch-action: pan-x`) constrains this strip to
            horizontal-only touch panning. Without it, a vertical drag that
            starts on the dock has no gesture registered for the element, so
            the browser walks up the DOM and pans the PDF viewer instead —
            users saw the page slide out from under them while just trying
            to swipe the toolbar. Horizontal scrolling of the strip and tap
            clicks on the buttons are unaffected. */}
        <div
          data-touch-scroll-x
          className="flex min-w-0 flex-1 touch-pan-x items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <ToolsContent showLabels toolIconSize={18} />
          {ACTION_TOOLS.map((tool) => (
            <button
              key={tool.id}
              aria-label={tool.label}
              className="flex h-auto shrink-0 flex-col items-center gap-0.5 rounded-md px-2.5 py-1.5 text-default-600 transition-colors hover:bg-default-100 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!file}
              type="button"
              onClick={() => handleAction(tool.id)}
            >
              <HugeiconsIcon icon={tool.icon} size={18} />
              <span className="text-[10px] leading-tight">{tool.label}</span>
            </button>
          ))}
        </div>
      </div>

      {isThumbsOpen && pageCount > 1 && (
        <div className="border-t border-default-200/70 bg-default-50/70">
          <ThumbnailStrip onReorderPages={onReorderPages} />
        </div>
      )}

      <MobileToolPropertiesModal />
    </div>
  );
}
