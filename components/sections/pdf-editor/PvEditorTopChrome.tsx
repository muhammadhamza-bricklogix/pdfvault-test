"use client";

import type { Key } from "@heroui/react";
import type { ActiveTool } from "@/lib/client/stores/pdf-editor-store";
import type { ComponentProps } from "react";

import {
  ArrowDown01Icon,
  BackgroundIcon,
  Comment01Icon,
  Copy01Icon,
  Cursor01Icon,
  Eraser01Icon,
  FileExportIcon,
  FileMinusIcon,
  HighlighterIcon,
  Image01Icon,
  Layers01Icon,
  Layout03Icon,
  Link01Icon,
  LockedIcon,
  PaintBrush01Icon,
  PaintBucketIcon,
  PencilEdit01Icon,
  RedoIcon,
  ShapesIcon,
  SignatureIcon,
  SplitIcon,
  Stamp01Icon,
  TextFontIcon,
  TextNumberSignIcon,
  UndoIcon,
  ViewOffIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Dropdown, Label, Tooltip } from "@heroui/react";
import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";

import { LanguageSwitcher } from "@/components/shared/navigation/language-switcher";
import { saveBeforeAction } from "@/lib/client/pdf-editor/save-before-action";
import { usePdfEditorStore } from "@/lib/client/stores";
import { ROUTES } from "@/lib/shared/constants/routes";
import { toast } from "@/lib/shared/utils/toast";

import { HamburgerMenu } from "./HamburgerMenu";

// ---------------------------------------------------------------------------
// Icon type alias (matches the hugeicons SVG type).
// ---------------------------------------------------------------------------

type IconGlyph = ComponentProps<typeof HugeiconsIcon>["icon"];

// ---------------------------------------------------------------------------
// Toolbar catalog — 21 tools split into 3 pill groups per Figma.
// ---------------------------------------------------------------------------

type ToolEntry =
  | { kind: "mode"; id: ActiveTool; label: string; icon: IconGlyph }
  | { kind: "action"; id: string; label: string; icon: IconGlyph };

const GROUP_A: ToolEntry[] = [
  { kind: "mode", id: "select", label: "Select", icon: Cursor01Icon },
  { kind: "mode", id: "editText", label: "Edit", icon: PencilEdit01Icon },
  { kind: "mode", id: "signature", label: "Sign", icon: SignatureIcon },
  { kind: "mode", id: "text", label: "Text", icon: TextFontIcon },
  { kind: "mode", id: "draw", label: "Draw", icon: PaintBrush01Icon },
  { kind: "mode", id: "highlight", label: "Highlight", icon: HighlighterIcon },
];

const GROUP_B: ToolEntry[] = [
  { kind: "mode", id: "shape", label: "Shapes", icon: ShapesIcon },
  { kind: "mode", id: "eraser", label: "Eraser", icon: Eraser01Icon },
  { kind: "mode", id: "whiteout", label: "Whiteout", icon: PaintBucketIcon },
  { kind: "mode", id: "redact", label: "Redact", icon: ViewOffIcon },
  { kind: "mode", id: "image", label: "Image", icon: Image01Icon },
  { kind: "mode", id: "watermark", label: "Watermark", icon: Stamp01Icon },
  {
    kind: "mode",
    id: "backgroundImage",
    label: "Background",
    icon: BackgroundIcon,
  },
];

const GROUP_C: ToolEntry[] = [
  { kind: "action", id: "compress", label: "Compress", icon: FileMinusIcon },
  { kind: "action", id: "secure", label: "Secure", icon: LockedIcon },
  { kind: "action", id: "merge", label: "Merge", icon: Copy01Icon },
  { kind: "action", id: "split", label: "Split", icon: SplitIcon },
  { kind: "action", id: "flatten", label: "Flatten", icon: Layers01Icon },
  { kind: "action", id: "extract", label: "Extract", icon: FileExportIcon },
  {
    kind: "action",
    id: "page-numbers",
    label: "Page No",
    icon: TextNumberSignIcon,
  },
  { kind: "action", id: "annotate", label: "Annotate", icon: Comment01Icon },
];

// Manage Pages — kept in its own pill group so the rotate/reorder/delete flow
// reads as a distinct document-structure action, not another single-page tool.
// Runs a saveBeforeAction guard locally (same guard the mobile BottomDock and
// legacy EditorToolBar use) so in-progress edits are flushed before the modal
// opens.
const GROUP_MANAGE: ToolEntry[] = [
  {
    kind: "action",
    id: "manage-pages",
    label: "Manage Pages",
    icon: Layout03Icon,
  },
];

// ---------------------------------------------------------------------------
// Actions Group — dispatches events / opens modals from the top toolbar.
//
// Modal-open handlers that live inside `HamburgerMenu` (Share, Split, Flatten,
// Annotate) are triggered via CustomEvents the menu now listens for. That
// avoids duplicating those states in two places while still letting the top
// chrome trigger them directly (per the Figma).
// ---------------------------------------------------------------------------

function fireEditorEvent(name: string) {
  window.dispatchEvent(new CustomEvent(name));
}

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
// Tool pill button (icon on top, small label under).
// ---------------------------------------------------------------------------

function ToolButton({
  icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: IconGlyph;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip delay={300}>
      <button
        aria-label={label}
        aria-pressed={active}
        className={`group flex h-auto min-w-[56px] cursor-pointer flex-col items-center gap-0.5 rounded-[10px] px-2 py-1.5 text-[10px] font-medium leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50 ${
          active
            ? "bg-default-200 text-[var(--color-foreground)]"
            : "text-default-600 hover:bg-default-100"
        }`}
        disabled={disabled}
        type="button"
        onClick={onClick}
      >
        <HugeiconsIcon
          className="text-[var(--color-foreground)]"
          icon={icon}
          size={20}
          strokeWidth={1.6}
        />
        <span>{label}</span>
      </button>
      <Tooltip.Content>
        <p>{label}</p>
      </Tooltip.Content>
    </Tooltip>
  );
}

function PillGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-[16px] border border-[var(--pv-hairline,rgb(235,235,235))] bg-white px-1.5 py-1.5 shadow-[0_2px_10px_-6px_rgba(0,0,0,0.15)]">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top App Bar — logo, doc title, undo/redo pill, Share, Download.
// ---------------------------------------------------------------------------

function TopAppBar() {
  const file = usePdfEditorStore((s) => s.file);
  const isSignedIn = usePdfEditorStore((s) => s.isSignedIn);
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const historyByPage = usePdfEditorStore((s) => s.historyByPage);
  const historyIndexByPage = usePdfEditorStore((s) => s.historyIndexByPage);

  const history = historyByPage.get(currentPage) ?? [];
  const idx = historyIndexByPage.get(currentPage) ?? -1;
  const canUndo = idx > 0;
  const canRedo = idx < history.length - 1;

  const fileName = file?.name ?? "Untitled.pdf";

  const canShare = !!file && isSignedIn;
  const canDownload = !!file;

  const handleExportAction = (key: Key) => {
    if (!canDownload) return;
    window.dispatchEvent(
      new CustomEvent("editor:export", { detail: { format: String(key) } }),
    );
  };

  return (
    <div className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--pv-hairline,rgb(235,235,235))] bg-white px-4">
      <HamburgerMenu />

      <Link
        aria-label="Home"
        className="flex shrink-0 items-center gap-2"
        href={ROUTES.PUBLIC.HOME}
      >
        <Image
          alt="PDFVault"
          className="h-[26px] w-auto object-contain"
          height={26}
          src="/landing/logo-with-text.png"
          width={104}
        />
      </Link>

      <span aria-hidden className="mx-1 h-6 w-px bg-default-200" />

      <span
        aria-label="Document"
        className="min-w-0 flex-1 truncate text-[14px] font-medium text-[var(--color-foreground)]"
      >
        {fileName}
      </span>

      <div className="ml-3 flex shrink-0 items-center gap-2 rounded-full border border-default-200 bg-white px-2 py-1.5">
        <Tooltip delay={300}>
          <button
            aria-label="Undo"
            className="flex cursor-pointer items-center justify-center rounded-full p-1 text-default-600 transition-colors hover:bg-default-100 hover:text-default-800 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!canUndo}
            type="button"
            onClick={() => fireEditorEvent("editor:undo")}
          >
            <HugeiconsIcon icon={UndoIcon} size={18} />
          </button>
          <Tooltip.Content>
            <p>Undo</p>
          </Tooltip.Content>
        </Tooltip>
        <span aria-hidden className="h-4 w-px bg-default-200" />
        <Tooltip delay={300}>
          <button
            aria-label="Redo"
            className="flex cursor-pointer items-center justify-center rounded-full p-1 text-default-600 transition-colors hover:bg-default-100 hover:text-default-800 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!canRedo}
            type="button"
            onClick={() => fireEditorEvent("editor:redo")}
          >
            <HugeiconsIcon icon={RedoIcon} size={18} />
          </button>
          <Tooltip.Content>
            <p>Redo</p>
          </Tooltip.Content>
        </Tooltip>
      </div>

      <LanguageSwitcher />

      <button
        aria-label="Share via link"
        className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-default-200 bg-white px-4 text-[13px] font-medium text-[var(--color-foreground)] transition-colors hover:bg-default-100 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!canShare}
        type="button"
        onClick={() => fireEditorEvent("editor:open-share")}
      >
        <HugeiconsIcon icon={Link01Icon} size={14} />
        Share via link
      </button>

      <Dropdown>
        <Button
          aria-label="Download"
          className="!h-9 !cursor-pointer !gap-2 !rounded-full !bg-[var(--color-accent)] !px-4 !text-[13px] !font-semibold !text-white hover:!opacity-90 disabled:!opacity-50"
          isDisabled={!canDownload}
        >
          Download
          <HugeiconsIcon icon={ArrowDown01Icon} size={12} />
        </Button>
        <Dropdown.Popover className="min-w-[180px]">
          <Dropdown.Menu
            aria-label="Download format"
            onAction={handleExportAction}
          >
            {EXPORT_FORMATS.map((format) => (
              <Dropdown.Item
                key={format.id}
                id={format.id}
                textValue={format.label}
              >
                <Label>{format.label}</Label>
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tool Toolbar Row — 3 floating pill groups.
// ---------------------------------------------------------------------------

function ToolToolbar() {
  const activeTool = usePdfEditorStore((s) => s.activeTool);
  const setActiveTool = usePdfEditorStore((s) => s.setActiveTool);
  const setIsCompressModalOpen = usePdfEditorStore(
    (s) => s.setIsCompressModalOpen,
  );
  const setIsPasswordModalOpen = usePdfEditorStore(
    (s) => s.setIsPasswordModalOpen,
  );
  const setIsPageNumbersModalOpen = usePdfEditorStore(
    (s) => s.setIsPageNumbersModalOpen,
  );
  const setIsManagePagesOpen = usePdfEditorStore((s) => s.setIsManagePagesOpen);
  const file = usePdfEditorStore((s) => s.file);
  const pdfDocument = usePdfEditorStore((s) => s.pdfDocument);
  const pageCount = usePdfEditorStore((s) => s.pageCount);

  const disabled = !file;
  const canManagePages = !!pdfDocument && pageCount > 0;

  const isActionDisabled = (id: string): boolean => {
    if (id === "manage-pages") return !canManagePages;

    return disabled;
  };

  const handleAction = (id: string) => {
    if (id === "manage-pages") {
      // Same save-before-action guard as EditorToolBar / BottomDock so
      // in-progress edits get flushed before the modal opens.
      void (async () => {
        const ok = await saveBeforeAction(
          "Saving your edits before opening Manage Pages.",
        );

        if (ok) setIsManagePagesOpen(true);
      })();

      return;
    }

    if (disabled) {
      toast.info({
        title: "Open a PDF first",
        description: "Upload a PDF to use this action.",
      });

      return;
    }

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
        toast.info({
          title: "Merge coming soon",
          description:
            "Merging multiple PDFs isn't wired up in this editor yet — use the Dashboard tools.",
        });
        break;
      case "split":
        fireEditorEvent("editor:open-split");
        break;
      case "flatten":
        fireEditorEvent("editor:open-flatten");
        break;
      case "extract":
        fireEditorEvent("editor:extract-images");
        break;
      case "annotate":
        fireEditorEvent("editor:open-annotations");
        break;
    }
  };

  const groups = useMemo(() => [GROUP_A, GROUP_B, GROUP_C, GROUP_MANAGE], []);

  return (
    <div className="flex shrink-0 items-center justify-center gap-3 overflow-x-auto bg-[var(--pv-canvas,#f5f5f7)] px-3 py-3">
      {groups.map((group, i) => (
        <PillGroup key={i}>
          {group.map((tool) => {
            if (tool.kind === "mode") {
              const active = activeTool === tool.id;

              return (
                <ToolButton
                  key={tool.id}
                  active={active}
                  disabled={disabled}
                  icon={tool.icon}
                  label={tool.label}
                  onClick={() => setActiveTool(tool.id)}
                />
              );
            }

            return (
              <ToolButton
                key={tool.id}
                disabled={isActionDisabled(tool.id)}
                icon={tool.icon}
                label={tool.label}
                onClick={() => handleAction(tool.id)}
              />
            );
          })}
        </PillGroup>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public: single chrome component (kept for mobile / consumers that want both).
// ---------------------------------------------------------------------------

export function PvEditorTopChrome() {
  return (
    <>
      <TopAppBar />
      <ToolToolbar />
    </>
  );
}

export { TopAppBar, ToolToolbar };
