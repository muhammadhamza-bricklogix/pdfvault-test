"use client";

import type { Canvas as FabricCanvas } from "fabric";

import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  NoteIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Tooltip } from "@heroui/react";
import { useState } from "react";

import { usePdfEditorStore } from "@/lib/client/stores";

import { ToolsContent } from "./EditorTopBar";
import { ShapePropertiesContent } from "./RightSidebar";
import { ThumbnailStrip } from "./ThumbnailSidebar";

type BottomDockProps = {
  fabricCanvas: FabricCanvas | null;
};

export function BottomDock({ fabricCanvas }: BottomDockProps) {
  const pageCount = usePdfEditorStore((s) => s.pageCount);
  const [isThumbsOpen, setIsThumbsOpen] = useState(false);

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
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ToolsContent showLabels={false} toolIconSize={20} />
        </div>

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
          <ThumbnailStrip />
        </div>
      )}
    </div>
  );
}
