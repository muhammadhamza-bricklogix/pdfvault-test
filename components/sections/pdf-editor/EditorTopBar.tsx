"use client";

import type { Key } from "@heroui/react";
import type { ActiveTool } from "@/lib/client/stores/pdf-editor-store";

import {
  ArrowDown01Icon,
  BackgroundIcon,
  Cursor01Icon,
  DashboardSpeed01Icon,
  EraserIcon,
  HighlighterIcon,
  Image01Icon,
  Layout03Icon,
  PaintBrush01Icon,
  PaintBucketIcon,
  PencilEdit01Icon,
  RedoIcon,
  SaveMoneyDollarIcon,
  ShapesIcon,
  SignatureIcon,
  Stamp01Icon,
  TextFontIcon,
  UndoIcon,
  ViewOffIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Button,
  ButtonGroup,
  Dropdown,
  Label,
  Separator,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
} from "@heroui/react";
import { useState } from "react";

import { ThemeToggle } from "@/components/ui/theme/theme-toggle";
import { dispatchSignInPrompt } from "@/components/shared/sign-in-prompt-modal";
import { saveBeforeAction } from "@/lib/client/pdf-editor/save-before-action";
import { usePdfEditorStore } from "@/lib/client/stores";

import { HamburgerMenu } from "./HamburgerMenu";
import { ToolsModal } from "./ToolsModal";

const ZOOM_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

// Format options shown in the Save dropdown. The editor only opens PDFs, so
// every non-PDF entry routes through the `/conversion` backend
// (pdf_to_<format>) via the editor:export event in use-export-editor.ts.
const EXPORT_FORMATS = [
  { id: "pdf", label: "PDF (.pdf)" },
  { id: "docx", label: "Word (.docx)" },
  { id: "xlsx", label: "Excel (.xlsx)" },
  { id: "pptx", label: "PowerPoint (.pptx)" },
  { id: "jpg", label: "JPG image" },
  { id: "png", label: "PNG image" },
  { id: "html", label: "HTML" },
  { id: "txt", label: "Plain text (.txt)" },
] as const;

// ---------------------------------------------------------------------------
// Info Bar — filename, page navigation, zoom, save
// ---------------------------------------------------------------------------

export function EditorInfoBar() {
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const file = usePdfEditorStore((s) => s.file);
  const isSignedIn = usePdfEditorStore((s) => s.isSignedIn);
  const pageCount = usePdfEditorStore((s) => s.pageCount);
  const zoom = usePdfEditorStore((s) => s.zoom);
  const setCurrentPage = usePdfEditorStore((s) => s.setCurrentPage);
  const setZoom = usePdfEditorStore((s) => s.setZoom);

  const [isToolsModalOpen, setIsToolsModalOpen] = useState(false);

  const zoomOut = () => {
    const prev = ZOOM_PRESETS.filter((z) => z < zoom).at(-1);

    if (prev !== undefined) setZoom(prev);
  };

  const zoomIn = () => {
    const next = ZOOM_PRESETS.find((z) => z > zoom);

    if (next !== undefined) setZoom(next);
  };

  const fileName = file?.name ?? "PDF Editor";

  // Enable Save whenever a file is open. Signed-out users get bounced into
  // the sign-in flow (with a redirect back to `/pdf-composer`) instead of
  // hitting a silently-disabled button — that was confusing users into
  // thinking Save was broken.
  const canSave = !!file;
  const saveTooltip = !file
    ? "Open a PDF to save"
    : !isSignedIn
      ? "Sign in to save to your library"
      : "Save";
  const onSaveClick = () => {
    if (!isSignedIn) {
      dispatchSignInPrompt({
        title: "Sign in to save",
        description:
          "Saving stores this PDF in your library so you can come back to it. Cancel to keep editing here without an account.",
        confirmLabel: "Sign in & continue",
      });

      return;
    }
    window.dispatchEvent(new CustomEvent("editor:save"));
  };

  const handleExportAction = (key: Key) => {
    window.dispatchEvent(
      new CustomEvent("editor:export", { detail: { format: String(key) } }),
    );
  };

  const pageNav = (
    <div className="flex items-center gap-1">
      <Button
        aria-label="Previous page"
        className="!min-w-9"
        isDisabled={currentPage <= 1}
        size="sm"
        variant="ghost"
        onPress={() => setCurrentPage(currentPage - 1)}
      >
        ‹
      </Button>
      <span className="min-w-12 text-center text-xs text-default-500 sm:min-w-16 lg:min-w-24">
        <span className="hidden sm:inline">Page </span>
        {currentPage}
        <span className="hidden sm:inline"> of</span>
        <span className="sm:hidden">/</span> {pageCount}
      </span>
      <Button
        aria-label="Next page"
        className="!min-w-9"
        isDisabled={currentPage >= pageCount}
        size="sm"
        variant="ghost"
        onPress={() => setCurrentPage(currentPage + 1)}
      >
        ›
      </Button>
    </div>
  );

  const zoomNav = (
    <div className="flex items-center gap-1">
      <Tooltip delay={300}>
        <Button
          aria-label="Zoom out"
          className="!min-w-9"
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
      <span className="min-w-10 text-center text-[10px] tabular-nums text-default-500 sm:min-w-12 sm:text-xs">
        {Math.round(zoom * 100)}%
      </span>
      <Tooltip delay={300}>
        <Button
          aria-label="Zoom in"
          className="!min-w-9"
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
    </div>
  );

  return (
    <>
      <ToolsModal
        isOpen={isToolsModalOpen}
        onClose={() => setIsToolsModalOpen(false)}
      />
      {/*
        Mobile (<sm) gets a two-row layout: action bar on row 1, page + zoom
        nav on row 2. The single-row variant crammed five button groups into
        ~320px on narrow phones and QA reported the next-page `›` and zoom
        `−` controls overlapping / clipping at the section boundary, making
        them un-tappable. Splitting nav onto its own centered row gives both
        groups full reach without sacrificing the desktop layout.
      */}
      <div className="flex flex-col gap-1 px-2 py-1 sm:h-10 sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:py-0 lg:px-3">
        {/* Action row: left actions + right save/theme. Doubles as the only
            row on sm+ where the page nav sits between them. */}
        <div className="flex items-center justify-between gap-2 sm:flex-1">
          <div className="flex items-center gap-1">
            <HamburgerMenu />
            <Tooltip delay={300}>
              <Button
                aria-label="Browse all tools"
                size="sm"
                variant="tertiary"
                onPress={() => setIsToolsModalOpen(true)}
              >
                <HugeiconsIcon icon={DashboardSpeed01Icon} size={16} />
                <span className="hidden sm:inline">Tools</span>
              </Button>
              <Tooltip.Content>
                <p>Browse PDF and image tools</p>
              </Tooltip.Content>
            </Tooltip>
          </div>

          {/* Filename + page nav — sits in the middle on sm+, hidden on
              mobile (the dedicated nav row below carries page navigation). */}
          <div className="hidden min-w-0 items-center gap-2 sm:flex lg:gap-3">
            <Tooltip delay={300}>
              <span className="hidden max-w-24 cursor-default truncate text-sm font-medium text-[var(--color-foreground)] sm:inline lg:max-w-40">
                {fileName}
              </span>
              <Tooltip.Content>
                <p>{fileName}</p>
              </Tooltip.Content>
            </Tooltip>

            <Separator
              className="!h-4 hidden self-center sm:block"
              orientation="vertical"
            />

            {pageNav}
          </div>

          {/* Right: zoom (sm+ only) + save + theme. */}
          <div className="flex items-center gap-1">
            <div className="hidden sm:block">{zoomNav}</div>

            <Separator
              className="!h-4 hidden self-center sm:block"
              orientation="vertical"
            />
            <ButtonGroup isDisabled={!file} size="sm" variant="primary">
              <Tooltip delay={300}>
                <Button isDisabled={!canSave} onPress={onSaveClick}>
                  <HugeiconsIcon icon={SaveMoneyDollarIcon} size={14} />
                  <span className="hidden sm:inline">Save</span>
                </Button>
                <Tooltip.Content>
                  <p>{saveTooltip}</p>
                </Tooltip.Content>
              </Tooltip>
              <Dropdown>
                <Button isIconOnly aria-label="Export options">
                  <ButtonGroup.Separator />
                  <HugeiconsIcon icon={ArrowDown01Icon} size={14} />
                </Button>
                <Dropdown.Popover className="min-w-[200px]">
                  <Dropdown.Menu
                    aria-label="Export format"
                    onAction={handleExportAction}
                  >
                    {EXPORT_FORMATS.map((fmt) => (
                      <Dropdown.Item
                        key={fmt.id}
                        id={fmt.id}
                        textValue={`Export as ${fmt.label}`}
                      >
                        <Label>{fmt.label}</Label>
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            </ButtonGroup>

            <Separator
              className="!h-4 hidden self-center sm:block"
              orientation="vertical"
            />
            <ThemeToggle size="sm" variant="tertiary" />
          </div>
        </div>

        {/* Mobile-only navigation row: page + zoom side by side, centered. */}
        <div className="flex items-center justify-center gap-3 sm:hidden">
          {pageNav}
          <Separator className="!h-4 self-center" orientation="vertical" />
          {zoomNav}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Tool Bar — all editing tools as individual buttons
// ---------------------------------------------------------------------------

const TOOLS = [
  { icon: Cursor01Icon, id: "select", label: "Select" },
  { icon: PencilEdit01Icon, id: "editText", label: "Edit Text" },
  { icon: SignatureIcon, id: "signature", label: "Signature" },
  { icon: TextFontIcon, id: "text", label: "Text" },
  { icon: PaintBrush01Icon, id: "draw", label: "Draw" },
  { icon: HighlighterIcon, id: "highlight", label: "Highlight" },
  { icon: ShapesIcon, id: "shape", label: "Shapes" },
  { icon: EraserIcon, id: "eraser", label: "Eraser" },
  { icon: PaintBucketIcon, id: "whiteout", label: "Whiteout" },
  { icon: ViewOffIcon, id: "redact", label: "Redact" },
  { icon: Image01Icon, id: "image", label: "Image" },
  { icon: Stamp01Icon, id: "watermark", label: "Watermark" },
  { icon: BackgroundIcon, id: "backgroundImage", label: "Background" },
] as const;

type ToolsContentProps = {
  showLabels?: boolean;
  toolIconSize?: number;
};

export function ToolsContent({
  toolIconSize = 25,
  showLabels = true,
}: ToolsContentProps = {}) {
  const activeTool = usePdfEditorStore((s) => s.activeTool);
  const setActiveTool = usePdfEditorStore((s) => s.setActiveTool);

  const handleToolChange = (keys: Set<Key>) => {
    const key = Array.from(keys)[0] as ActiveTool | undefined;

    if (!key) return;

    setActiveTool(key);
  };

  return (
    <Toolbar aria-label="Drawing tools">
      <ToggleButtonGroup
        disallowEmptySelection
        selectedKeys={new Set([activeTool])}
        selectionMode="single"
        size="md"
        onSelectionChange={handleToolChange}
      >
        {TOOLS.map((tool, i) =>
          showLabels ? (
            <ToggleButton
              key={tool.id}
              aria-label={tool.label}
              className="h-auto flex-col gap-0.5 px-2.5 py-1.5"
              id={tool.id}
            >
              {i > 0 && <ToggleButtonGroup.Separator />}
              <HugeiconsIcon icon={tool.icon} size={toolIconSize} />
              <span className="text-[10px] leading-tight">{tool.label}</span>
            </ToggleButton>
          ) : (
            <Tooltip key={tool.id} delay={300}>
              <ToggleButton isIconOnly aria-label={tool.label} id={tool.id}>
                {i > 0 && <ToggleButtonGroup.Separator />}
                <HugeiconsIcon icon={tool.icon} size={toolIconSize} />
              </ToggleButton>
              <Tooltip.Content>
                <p>{tool.label}</p>
              </Tooltip.Content>
            </Tooltip>
          ),
        )}
      </ToggleButtonGroup>
    </Toolbar>
  );
}

function HistoryActions() {
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const historyByPage = usePdfEditorStore((s) => s.historyByPage);
  const historyIndexByPage = usePdfEditorStore((s) => s.historyIndexByPage);

  const history = historyByPage.get(currentPage) ?? [];
  const idx = historyIndexByPage.get(currentPage) ?? -1;
  const canUndo = idx > 0;
  const canRedo = idx < history.length - 1;

  return (
    <Toolbar aria-label="History actions">
      <ButtonGroup size="sm" variant="tertiary">
        <Tooltip delay={300}>
          <Button
            className="h-auto flex-col gap-0.5 px-2.5 py-1.5"
            isDisabled={!canUndo}
            onPress={() => window.dispatchEvent(new CustomEvent("editor:undo"))}
          >
            <HugeiconsIcon icon={UndoIcon} size={22} />
            <span className="text-[10px] leading-tight">Undo</span>
          </Button>
          <Tooltip.Content>
            <p>Undo</p>
          </Tooltip.Content>
        </Tooltip>
        <Tooltip delay={300}>
          <Button
            className="h-auto flex-col gap-0.5 px-2.5 py-1.5"
            isDisabled={!canRedo}
            onPress={() => window.dispatchEvent(new CustomEvent("editor:redo"))}
          >
            <HugeiconsIcon icon={RedoIcon} size={22} />
            <span className="text-[10px] leading-tight">Redo</span>
          </Button>
          <Tooltip.Content>
            <p>Redo</p>
          </Tooltip.Content>
        </Tooltip>
      </ButtonGroup>
    </Toolbar>
  );
}

export function EditorToolBar() {
  const pageCount = usePdfEditorStore((s) => s.pageCount);
  const pdfDocument = usePdfEditorStore((s) => s.pdfDocument);
  const setIsManagePagesOpen = usePdfEditorStore((s) => s.setIsManagePagesOpen);

  const canManagePages = !!pdfDocument && pageCount > 0;

  const handleOpenManagePages = async () => {
    const ok = await saveBeforeAction(
      "Saving your edits before opening Manage Pages.",
    );

    if (ok) setIsManagePagesOpen(true);
  };

  return (
    <div className="flex h-14 shrink-0 items-center justify-center gap-3 px-3">
      <HistoryActions />
      <Separator className="!h-6" orientation="vertical" />
      <ToolsContent />
      <Separator className="!h-6" orientation="vertical" />
      <Tooltip delay={300}>
        <Button
          className="h-auto flex-col gap-0.5 px-2.5 py-1.5"
          isDisabled={!canManagePages}
          size="sm"
          variant="tertiary"
          onPress={() => void handleOpenManagePages()}
        >
          <HugeiconsIcon icon={Layout03Icon} size={22} />
          <span className="text-[10px] leading-tight">Manage Pages</span>
        </Button>
        <Tooltip.Content>
          <p>Reorder and manage document pages</p>
        </Tooltip.Content>
      </Tooltip>
    </div>
  );
}
