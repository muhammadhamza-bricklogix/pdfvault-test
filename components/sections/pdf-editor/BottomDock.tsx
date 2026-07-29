"use client";

import type { Canvas as FabricCanvas } from "fabric";

import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Layout03Icon,
  NoteIcon,
  RedoIcon,
  UndoIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Tooltip } from "@heroui/react";
import { useState } from "react";

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

export function BottomDock({ fabricCanvas, onReorderPages }: BottomDockProps) {
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const historyByPage = usePdfEditorStore((s) => s.historyByPage);
  const historyIndexByPage = usePdfEditorStore((s) => s.historyIndexByPage);
  const pageCount = usePdfEditorStore((s) => s.pageCount);
  const setIsManagePagesOpen = usePdfEditorStore((s) => s.setIsManagePagesOpen);
  const [isThumbsOpen, setIsThumbsOpen] = useState(false);

  const history = historyByPage.get(currentPage) ?? [];
  const idx = historyIndexByPage.get(currentPage) ?? -1;
  const canUndo = idx > 0;
  const canRedo = idx < history.length - 1;

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
        <Tooltip delay={300}>
          <Button
            aria-label="Undo"
            isDisabled={!canUndo}
            size="sm"
            variant="tertiary"
            onPress={() => window.dispatchEvent(new CustomEvent("editor:undo"))}
          >
            <HugeiconsIcon icon={UndoIcon} size={16} />
          </Button>
          <Tooltip.Content>
            <p>Undo</p>
          </Tooltip.Content>
        </Tooltip>
        <Tooltip delay={300}>
          <Button
            aria-label="Redo"
            isDisabled={!canRedo}
            size="sm"
            variant="tertiary"
            onPress={() => window.dispatchEvent(new CustomEvent("editor:redo"))}
          >
            <HugeiconsIcon icon={RedoIcon} size={16} />
          </Button>
          <Tooltip.Content>
            <p>Redo</p>
          </Tooltip.Content>
        </Tooltip>

        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ToolsContent showLabels toolIconSize={18} />
        </div>

        {pageCount > 0 && (
          <Tooltip delay={300}>
            <Button
              aria-label="Manage pages"
              size="sm"
              variant="tertiary"
              onPress={() => void handleOpenManagePages()}
            >
              <HugeiconsIcon icon={Layout03Icon} size={16} />
            </Button>
            <Tooltip.Content>
              <p>Manage pages</p>
            </Tooltip.Content>
          </Tooltip>
        )}

        {pageCount > 1 && (
          <Tooltip delay={300}>
            <Button
              aria-expanded={isThumbsOpen}
              aria-label={isThumbsOpen ? "Hide pages" : "Show pages"}
              size="sm"
              variant={isThumbsOpen ? "secondary" : "tertiary"}
              onPress={() => setIsThumbsOpen((prev) => !prev)}
            >
              <HugeiconsIcon icon={NoteIcon} size={16} />
              <HugeiconsIcon
                icon={isThumbsOpen ? ArrowDown01Icon : ArrowUp01Icon}
                size={14}
              />
            </Button>
            <Tooltip.Content>
              <p>{isThumbsOpen ? "Hide pages" : "Show pages"}</p>
            </Tooltip.Content>
          </Tooltip>
        )}
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
