"use client";

import type { Key } from "@heroui/react";
import type { ActiveTool } from "@/lib/client/stores/pdf-editor-store";

import {
  Cursor01Icon,
  RedoIcon,
  TypeCursorIcon,
  UndoIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Button,
  ButtonGroup,
  Separator,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
} from "@heroui/react";

import { usePdfEditorStore } from "@/lib/client/stores";

const ZOOM_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

export function EditorTopBar() {
  const activeTool = usePdfEditorStore((s) => s.activeTool);
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const file = usePdfEditorStore((s) => s.file);
  const historyByPage = usePdfEditorStore((s) => s.historyByPage);
  const historyIndexByPage = usePdfEditorStore((s) => s.historyIndexByPage);
  const pageCount = usePdfEditorStore((s) => s.pageCount);
  const zoom = usePdfEditorStore((s) => s.zoom);
  const setActiveTool = usePdfEditorStore((s) => s.setActiveTool);
  const setCurrentPage = usePdfEditorStore((s) => s.setCurrentPage);
  const setZoom = usePdfEditorStore((s) => s.setZoom);

  const history = historyByPage.get(currentPage) ?? [];
  const idx = historyIndexByPage.get(currentPage) ?? -1;
  const canUndo = idx > 0;
  const canRedo = idx < history.length - 1;

  const zoomOut = () => {
    const prev = ZOOM_PRESETS.filter((z) => z < zoom).at(-1);

    if (prev !== undefined) setZoom(prev);
  };

  const zoomIn = () => {
    const next = ZOOM_PRESETS.find((z) => z > zoom);

    if (next !== undefined) setZoom(next);
  };

  const handleToolChange = (keys: Set<Key>) => {
    const key = [...keys][0] as ActiveTool;

    if (key) setActiveTool(key);
  };

  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--app-border)] bg-[var(--color-background)] px-3">
      {/* Left: tool selector + undo/redo */}
      <Toolbar aria-label="Editor tools">
        <ToggleButtonGroup
          disallowEmptySelection
          selectedKeys={new Set([activeTool])}
          selectionMode="single"
          size="sm"
          onSelectionChange={handleToolChange}
        >
          <ToggleButton isIconOnly aria-label="Select tool" id="select">
            <HugeiconsIcon icon={Cursor01Icon} size={16} />
          </ToggleButton>
          <ToggleButton isIconOnly aria-label="Text tool" id="text">
            <ToggleButtonGroup.Separator />
            <HugeiconsIcon icon={TypeCursorIcon} size={16} />
          </ToggleButton>
        </ToggleButtonGroup>

        <Separator />

        <ButtonGroup size="sm" variant="tertiary">
          <Button
            isIconOnly
            aria-label="Undo"
            isDisabled={!canUndo}
            onPress={() => window.dispatchEvent(new CustomEvent("editor:undo"))}
          >
            <HugeiconsIcon icon={UndoIcon} size={16} />
          </Button>
          <Button
            isIconOnly
            aria-label="Redo"
            isDisabled={!canRedo}
            onPress={() => window.dispatchEvent(new CustomEvent("editor:redo"))}
          >
            <ButtonGroup.Separator />
            <HugeiconsIcon icon={RedoIcon} size={16} />
          </Button>
        </ButtonGroup>
      </Toolbar>

      {/* Center: filename + page navigation */}
      <div className="flex items-center gap-3">
        <span className="max-w-40 truncate text-sm font-medium text-[var(--color-foreground)]">
          {file?.name ?? "PDF Editor"}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <Button
          isDisabled={currentPage <= 1}
          size="sm"
          variant="ghost"
          onPress={() => setCurrentPage(currentPage - 1)}
        >
          ‹
        </Button>
        <span className="min-w-24 text-center text-xs text-[var(--app-muted)]">
          Page {currentPage} of {pageCount}
        </span>
        <Button
          isDisabled={currentPage >= pageCount}
          size="sm"
          variant="ghost"
          onPress={() => setCurrentPage(currentPage + 1)}
        >
          ›
        </Button>
      </div>

      {/* Right: zoom controls */}
      <div className="flex items-center gap-1">
        <Button
          isDisabled={zoom <= ZOOM_PRESETS[0]}
          size="sm"
          variant="ghost"
          onPress={zoomOut}
        >
          −
        </Button>
        <span className="min-w-12 text-center text-xs tabular-nums text-[var(--app-muted)]">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          isDisabled={zoom >= ZOOM_PRESETS[ZOOM_PRESETS.length - 1]}
          size="sm"
          variant="ghost"
          onPress={zoomIn}
        >
          +
        </Button>
      </div>
    </div>
  );
}
