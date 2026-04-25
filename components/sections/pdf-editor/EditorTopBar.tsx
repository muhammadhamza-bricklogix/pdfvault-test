"use client";

import type { Key } from "@heroui/react";
import type { ActiveTool } from "@/lib/client/stores/pdf-editor-store";

import {
  Analytics01Icon,
  ArrowDownRight01Icon,
  CircleIcon,
  Cursor01Icon,
  EraserIcon,
  HighlighterIcon,
  Image01Icon,
  LinerIcon,
  PaintBrush01Icon,
  PaintBucketIcon,
  RedoIcon,
  SignatureIcon,
  SquareIcon,
  TextFontIcon,
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
  Tooltip,
} from "@heroui/react";

import { usePdfEditorStore } from "@/lib/client/stores";

import { HamburgerMenu } from "./HamburgerMenu";

const ZOOM_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

// ---------------------------------------------------------------------------
// Info Bar — filename, page navigation, zoom, undo/redo
// ---------------------------------------------------------------------------
type EditorInfoBarProps = {
  isPerformancePanelOpen?: boolean;
  onTogglePerformancePanel?: () => void;
};

export function EditorInfoBar({
  isPerformancePanelOpen,
  onTogglePerformancePanel,
}: EditorInfoBarProps) {
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const file = usePdfEditorStore((s) => s.file);
  const historyByPage = usePdfEditorStore((s) => s.historyByPage);
  const historyIndexByPage = usePdfEditorStore((s) => s.historyIndexByPage);
  const pageCount = usePdfEditorStore((s) => s.pageCount);
  const zoom = usePdfEditorStore((s) => s.zoom);
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

  const fileName = file?.name ?? "PDF Editor";

  return (
    <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--app-border)] bg-[var(--color-background)] px-3">
      {/* Left: menu + undo/redo */}
      <div className="flex items-center gap-1">
        <HamburgerMenu />
        <Toolbar aria-label="Actions">
          <ButtonGroup size="sm" variant="tertiary">
            <Tooltip delay={300}>
              <Button
                isIconOnly
                aria-label="Undo"
                isDisabled={!canUndo}
                onPress={() =>
                  window.dispatchEvent(new CustomEvent("editor:undo"))
                }
              >
                <HugeiconsIcon icon={UndoIcon} size={16} />
              </Button>
              <Tooltip.Content>
                <p>Undo</p>
              </Tooltip.Content>
            </Tooltip>
            <Tooltip delay={300}>
              <Button
                isIconOnly
                aria-label="Redo"
                isDisabled={!canRedo}
                onPress={() =>
                  window.dispatchEvent(new CustomEvent("editor:redo"))
                }
              >
                <ButtonGroup.Separator />
                <HugeiconsIcon icon={RedoIcon} size={16} />
              </Button>
              <Tooltip.Content>
                <p>Redo</p>
              </Tooltip.Content>
            </Tooltip>
          </ButtonGroup>
        </Toolbar>
      </div>

      {/* Center: filename + page navigation */}
      <div className="flex items-center gap-3">
        <Tooltip delay={300}>
          <span className="max-w-40 cursor-default truncate text-sm font-medium text-[var(--color-foreground)]">
            {fileName}
          </span>
          <Tooltip.Content>
            <p>{fileName}</p>
          </Tooltip.Content>
        </Tooltip>

        <Separator className="!h-4" orientation="vertical" />

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
      </div>

      {/* Right: zoom controls */}
      <div className="flex items-center gap-1">
        <Tooltip delay={300}>
          <Button
            isDisabled={zoom <= ZOOM_PRESETS[0]}
            size="sm"
            variant="ghost"
            onPress={zoomOut}
          >
            −
          </Button>
          <Tooltip.Content>
            <p>Zoom out</p>
          </Tooltip.Content>
        </Tooltip>
        <span className="min-w-12 text-center text-xs tabular-nums text-[var(--app-muted)]">
          {Math.round(zoom * 100)}%
        </span>
        <Tooltip delay={300}>
          <Button
            isDisabled={zoom >= ZOOM_PRESETS[ZOOM_PRESETS.length - 1]}
            size="sm"
            variant="ghost"
            onPress={zoomIn}
          >
            +
          </Button>
          <Tooltip.Content>
            <p>Zoom in</p>
          </Tooltip.Content>
        </Tooltip>

        {onTogglePerformancePanel && (
          <>
            <Separator className="!h-4" orientation="vertical" />
            <Tooltip delay={300}>
              <Button
                isIconOnly
                aria-label="Performance panel"
                size="sm"
                variant={isPerformancePanelOpen ? "secondary" : "ghost"}
                onPress={onTogglePerformancePanel}
              >
                <HugeiconsIcon icon={Analytics01Icon} size={16} />
              </Button>
              <Tooltip.Content>
                <p>Performance</p>
              </Tooltip.Content>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tool Bar — all editing tools as individual buttons
// ---------------------------------------------------------------------------

type ToolId = ActiveTool | `shape:${string}`;

function parseToolId(id: ToolId): {
  shapeType?: string;
  tool: ActiveTool;
} {
  if (id.startsWith("shape:")) {
    return { shapeType: id.slice(6), tool: "shape" };
  }

  return { tool: id as ActiveTool };
}

function toToggleKey(activeTool: ActiveTool, activeShapeType: string): ToolId {
  if (activeTool === "shape") return `shape:${activeShapeType}`;

  return activeTool;
}

const TOOLS = [
  { icon: Cursor01Icon, id: "select", label: "Select" },
  { icon: TextFontIcon, id: "text", label: "Text" },
  { icon: PaintBrush01Icon, id: "draw", label: "Draw" },
  { icon: HighlighterIcon, id: "highlight", label: "Highlight" },
  { icon: SquareIcon, id: "shape:rect", label: "Rectangle" },
  { icon: CircleIcon, id: "shape:ellipse", label: "Ellipse" },
  { icon: LinerIcon, id: "shape:line", label: "Line" },
  { icon: ArrowDownRight01Icon, id: "shape:arrow", label: "Arrow" },
  { icon: EraserIcon, id: "eraser", label: "Eraser" },
  { icon: PaintBucketIcon, id: "whiteout", label: "Whiteout" },
  { icon: SignatureIcon, id: "signature", label: "Signature" },
  { icon: Image01Icon, id: "image", label: "Image" },
] as const;

const HIGHLIGHT_COLORS = [
  { color: "#FFEB3B", label: "Yellow" },
  { color: "#A5D6A7", label: "Green" },
  { color: "#90CAF9", label: "Blue" },
  { color: "#F48FB1", label: "Pink" },
] as const;

export function EditorToolBar() {
  const activeShapeType = usePdfEditorStore((s) => s.activeShapeType);
  const activeTool = usePdfEditorStore((s) => s.activeTool);
  const highlightColor = usePdfEditorStore((s) => s.highlightColor);
  const setActiveTool = usePdfEditorStore((s) => s.setActiveTool);
  const setActiveShapeType = usePdfEditorStore((s) => s.setActiveShapeType);
  const setHighlightColor = usePdfEditorStore((s) => s.setHighlightColor);

  const selectedKey = toToggleKey(activeTool, activeShapeType);

  const handleToolChange = (keys: Set<Key>) => {
    const key = [...keys][0] as ToolId | undefined;

    if (!key) return;

    const { tool, shapeType } = parseToolId(key);

    if (shapeType) {
      setActiveShapeType(shapeType as "rect" | "ellipse" | "line" | "arrow");
    }

    setActiveTool(tool);
  };

  return (
    <div className="flex h-10 shrink-0 items-center justify-center gap-2 border-b border-[var(--app-border)] bg-[var(--color-background)] px-3">
      <Toolbar aria-label="Drawing tools">
        <ToggleButtonGroup
          disallowEmptySelection
          selectedKeys={new Set([selectedKey])}
          selectionMode="single"
          size="sm"
          onSelectionChange={handleToolChange}
        >
          {TOOLS.map((tool, i) => (
            <Tooltip key={tool.id} delay={300}>
              <ToggleButton isIconOnly aria-label={tool.label} id={tool.id}>
                {i > 0 && <ToggleButtonGroup.Separator />}
                <HugeiconsIcon icon={tool.icon} size={16} />
              </ToggleButton>
              <Tooltip.Content>
                <p>{tool.label}</p>
              </Tooltip.Content>
            </Tooltip>
          ))}
        </ToggleButtonGroup>
      </Toolbar>

      {/* Highlight color presets — visible only when highlight tool is active */}
      {activeTool === "highlight" && (
        <div className="flex items-center gap-1">
          {HIGHLIGHT_COLORS.map((preset) => (
            <Tooltip key={preset.color} delay={300}>
              <button
                aria-label={`${preset.label} highlight`}
                aria-pressed={highlightColor === preset.color}
                className="size-5 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  backgroundColor: preset.color,
                  borderColor:
                    highlightColor === preset.color
                      ? "var(--color-foreground)"
                      : "transparent",
                }}
                onClick={() => setHighlightColor(preset.color)}
              />
              <Tooltip.Content>
                <p>{preset.label}</p>
              </Tooltip.Content>
            </Tooltip>
          ))}
        </div>
      )}
    </div>
  );
}
