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
import { useEffect, useState } from "react";

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

  useEffect(() => {
    const toggle = () => setIsThumbsOpen((prev) => !prev);

    window.addEventListener("editor:toggle-thumbs", toggle);

    return () => window.removeEventListener("editor:toggle-thumbs", toggle);
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
    <div
      aria-label="Editor dock"
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-30 flex flex-col border-t border-default-200 bg-[var(--color-background)]/95 shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.15)] backdrop-blur-md"
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
        <div className="flex min-w-0 flex-1 touch-pan-x items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
