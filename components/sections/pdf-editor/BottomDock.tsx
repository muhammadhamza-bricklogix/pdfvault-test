"use client";

import type { Canvas as FabricCanvas } from "fabric";
import type { ActiveTool } from "@/lib/client/stores/pdf-editor-store";
import type { ComponentProps } from "react";

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

import { usePdfEditorStore } from "@/lib/client/stores";
import { saveBeforeAction } from "@/lib/client/pdf-editor/save-before-action";

import { TOOLS } from "./EditorTopBar";
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
  { id: "page-numbers", label: "Page No", icon: TextNumberSignIcon },
  { id: "annotate", label: "Annotate", icon: Comment01Icon },
] as const;

// Split at the same 6/7 boundary as desktop's GROUP_A/GROUP_B (PvEditorTopChrome.tsx).
const MODE_TOOLS_GROUP_1 = TOOLS.slice(0, 6);
const MODE_TOOLS_GROUP_2 = TOOLS.slice(6);

type DockIcon = ComponentProps<typeof HugeiconsIcon>["icon"];

// Mirrors desktop's ToolButton (PvEditorTopChrome.tsx), sized down for the mobile dock.
function DockToolButton({
  icon,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: DockIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={`flex h-auto shrink-0 flex-col items-center gap-0.5 rounded-md px-2.5 py-1.5 text-[10px] font-medium leading-tight transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? "bg-[var(--color-accent)]/12 text-[var(--color-accent)] ring-1 ring-inset ring-[var(--color-accent)]/40"
          : "text-default-600 hover:bg-default-100"
      }`}
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      <HugeiconsIcon icon={icon} size={18} />
      <span>{label}</span>
    </button>
  );
}

// Mirrors desktop's PillGroup (PvEditorTopChrome.tsx) bordered-card styling.
function DockPillGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-[16px] border border-[var(--pv-hairline,rgb(235,235,235))] bg-white px-1.5 py-1.5 shadow-[0_2px_10px_-6px_rgba(0,0,0,0.15)]">
      {children}
    </div>
  );
}

export function BottomDock({ fabricCanvas, onReorderPages }: BottomDockProps) {
  const pageCount = usePdfEditorStore((s) => s.pageCount);
  const file = usePdfEditorStore((s) => s.file);
  const isSignedIn = usePdfEditorStore((s) => s.isSignedIn);
  const activeTool = usePdfEditorStore((s) => s.activeTool);
  const setActiveTool = usePdfEditorStore((s) => s.setActiveTool);
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

  // Observability logs so we can quickly diagnose any future touch
  // regressions on this dock — the previous "page above scrolls when I
  // swipe the dock" bug turned out to be `PdfViewerCanvas`'s
  // `document`-scoped touchend triggering page navigation on the dock's
  // horizontal swipe (2026-08-26 QA). Real fix lives there — a guard
  // that only fires page-nav for touches starting inside the viewer.
  // These logs are cheap; leave them until we're confident.
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

      // eslint-disable-next-line no-console
      console.log("[PDFedits] dock touchmove", {
        dx: Math.round(dx),
        dy: Math.round(dy),
        isHorizontal,
        insideScroller,
      });
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });

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
    if (!isSignedIn) {
      setIsManagePagesOpen(true);

      return;
    }

    const ok = await saveBeforeAction(
      "Saving your edits before opening Manage Pages.",
    );

    if (ok) setIsManagePagesOpen(true);
  };

  // Dispatches editor:toolbar-tool-picked (clears any open floating toolbar) before switching tools.
  const handleModeToolPick = (id: ActiveTool) => {
    window.dispatchEvent(new CustomEvent("editor:toolbar-tool-picked"));
    setActiveTool(id);
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
              aria-label="Manage Pages"
              className="h-auto shrink-0 flex-col gap-0.5 px-2.5 py-1.5"
              size="sm"
              variant="tertiary"
              onPress={() => void handleOpenManagePages()}
            >
              <HugeiconsIcon icon={Layout03Icon} size={18} />
              <span className="text-[10px] leading-tight">Manage Pages</span>
            </Button>
            <Tooltip.Content>
              <p>Manage Pages</p>
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
          <DockPillGroup>
            {MODE_TOOLS_GROUP_1.map((tool) => (
              <DockToolButton
                key={tool.id}
                active={activeTool === tool.id}
                icon={tool.icon}
                label={tool.label}
                onClick={() => handleModeToolPick(tool.id)}
              />
            ))}
          </DockPillGroup>

          <DockPillGroup>
            {MODE_TOOLS_GROUP_2.map((tool) => (
              <DockToolButton
                key={tool.id}
                active={activeTool === tool.id}
                icon={tool.icon}
                label={tool.label}
                onClick={() => handleModeToolPick(tool.id)}
              />
            ))}
          </DockPillGroup>

          <DockPillGroup>
            {ACTION_TOOLS.map((tool) => (
              <DockToolButton
                key={tool.id}
                disabled={!file}
                icon={tool.icon}
                label={tool.label}
                onClick={() => handleAction(tool.id)}
              />
            ))}
          </DockPillGroup>
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
