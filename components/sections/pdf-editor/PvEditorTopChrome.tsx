"use client";

import type { ActiveTool } from "@/lib/client/stores/pdf-editor-store";
import type { ComponentProps } from "react";

import {
  ArrowLeft01Icon,
  Tick01Icon,
  BackgroundIcon,
  PrinterIcon,
  Comment01Icon,
  Search01Icon,
  Copy01Icon,
  Cursor01Icon,
  EraserIcon,
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
import { Button, Tooltip } from "@heroui/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { LanguageSwitcher } from "@/components/shared/navigation/language-switcher";
import { TourHelpButton } from "@/components/shared/product-tour/tour-help-button";
import { requestPaywall } from "@/lib/client/hooks/billing/paywall-bus";
import { useIsEntitled } from "@/lib/client/hooks/billing/use-is-entitled";
import { useRenameDocumentMutation } from "@/lib/client/query/mutations/documents.mutation";
import { usePdfSearchStore } from "@/lib/client/stores/pdf-search-store";
import { saveBeforeAction } from "@/lib/client/pdf-editor/save-before-action";
import { usePdfEditorStore } from "@/lib/client/stores";
import { ROUTES } from "@/lib/shared/constants/routes";
import { toast } from "@/lib/shared/utils/toast";

import { ExportFormatModal } from "./ExportFormatModal";
import { HamburgerMenu } from "./HamburgerMenu";
import { SaveStatusChip } from "./SaveStatusChip";

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
  { kind: "mode", id: "eraser", label: "Eraser", icon: EraserIcon },
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
            ? "bg-[var(--color-accent)]/12 text-[var(--color-accent)] ring-1 ring-inset ring-[var(--color-accent)]/40"
            : "text-default-600 hover:bg-default-100"
        }`}
        disabled={disabled}
        type="button"
        onClick={onClick}
      >
        <HugeiconsIcon
          className={
            active
              ? "text-[var(--color-accent)]"
              : "text-[var(--color-foreground)]"
          }
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

function PillGroup({
  children,
  dataTour,
}: {
  children: React.ReactNode;
  dataTour?: string;
}) {
  return (
    <div
      className="flex shrink-0 items-center gap-1 rounded-[16px] border border-[var(--pv-hairline,rgb(235,235,235))] bg-white px-1.5 py-1.5 shadow-[0_2px_10px_-6px_rgba(0,0,0,0.15)]"
      data-tour={dataTour}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top App Bar — logo, doc title, undo/redo pill, Share, Download.
// ---------------------------------------------------------------------------

function TopAppBar() {
  const file = usePdfEditorStore((s) => s.file);
  const setFile = usePdfEditorStore((s) => s.setFile);
  const isSignedIn = usePdfEditorStore((s) => s.isSignedIn);
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const currentDocumentId = usePdfEditorStore((s) => s.currentDocumentId);
  const historyByPage = usePdfEditorStore((s) => s.historyByPage);
  const historyIndexByPage = usePdfEditorStore((s) => s.historyIndexByPage);
  const router = useRouter();
  const renameDoc = useRenameDocumentMutation();

  const history = historyByPage.get(currentPage) ?? [];
  const idx = historyIndexByPage.get(currentPage) ?? -1;
  const canUndo = idx > 0;
  const canRedo = idx < history.length - 1;

  const fileName = file?.name ?? "Untitled.pdf";

  const entitled = useIsEntitled();
  const canShare = !!file && isSignedIn;
  const canDownload = !!file;
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Editable filename — Canva-style inline edit. Uncontrolled input
  // keyed on `fileName` so external renames (post-save, restore-version)
  // reset the input without needing a setState-in-effect sync. Display
  // strips `.pdf` because the extension is redundant in an editor that
  // only handles PDFs — commit re-appends it before saving.
  const nameInputRef = useRef<HTMLInputElement>(null);
  const displayName = fileName.replace(/\.pdf$/i, "");

  // Clear the store BEFORE navigating so re-entry via any path — bare
  // `/pdf-editor`, tool tile, or a landing-page drop that creates a new
  // doc — doesn't render the previous PDF while the new load is in flight.
  // Reported 2026-08-18.
  const handleBack = () => {
    usePdfEditorStore.getState().clearFile();
    router.push(isSignedIn ? ROUTES.APP.DASHBOARD : ROUTES.PUBLIC.HOME);
  };

  const commitRename = () => {
    if (!file || !nameInputRef.current) return;
    const trimmed = nameInputRef.current.value.trim();

    if (!trimmed) {
      nameInputRef.current.value = displayName;

      return;
    }
    const withExt = /\.[^./\\]+$/.test(trimmed) ? trimmed : `${trimmed}.pdf`;

    if (withExt === file.name) {
      nameInputRef.current.value = displayName;

      return;
    }
    const renamed = new File([file], withExt, {
      lastModified: file.lastModified,
      type: file.type,
    });

    setFile(renamed);

    if (currentDocumentId) {
      renameDoc.mutate({ filename: withExt, id: currentDocumentId });
    }
  };

  const {
    isOpen: isSearchOpen,
    open: openSearch,
    close: closeSearch,
  } = usePdfSearchStore();

  const handlePrint = async () => {
    if (!file) return;
    if (!entitled) {
      const outcome = await requestPaywall();

      if (outcome !== "success") return;
    }
    window.dispatchEvent(
      new CustomEvent("editor:export", {
        detail: { format: "pdf", print: true },
      }),
    );
  };

  return (
    <div className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--pv-hairline,rgb(235,235,235))] bg-white px-4 py-2">
      <Tooltip delay={300}>
        <button
          aria-label="Back to dashboard"
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-default-600 transition-colors hover:bg-default-100 hover:text-default-800"
          type="button"
          onClick={handleBack}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={18} />
        </button>
        <Tooltip.Content>
          <p>Back to dashboard</p>
        </Tooltip.Content>
      </Tooltip>

      <HamburgerMenu />

      <Link
        aria-label="Home"
        className="flex shrink-0 items-center gap-2"
        href={ROUTES.PUBLIC.HOME}
      >
        <Image
          alt="PDFVault"
          className="h-[32px] w-auto object-contain"
          height={32}
          src="/landing/logo-with-text.png"
          width={128}
        />
      </Link>

      <span aria-hidden className="mx-1 h-6 w-px bg-default-200" />

      <input
        key={fileName}
        ref={nameInputRef}
        aria-label="Document name"
        className="min-w-0 flex-1 truncate rounded-md border border-transparent bg-transparent px-2 py-1 text-[14px] font-medium text-[var(--color-foreground)] outline-none transition-colors hover:border-default-200 focus:border-[#f12c23] focus:bg-white"
        defaultValue={displayName}
        disabled={!file}
        title="Click to rename"
        type="text"
        onBlur={commitRename}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            nameInputRef.current?.blur();
          } else if (e.key === "Escape") {
            if (nameInputRef.current) nameInputRef.current.value = displayName;
            nameInputRef.current?.blur();
          }
        }}
      />

      <SaveStatusChip />

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

      <TourHelpButton tour="editor" variant="chrome" />

      {/* Search — PDF-wide text search with highlight + navigation. */}
      <Tooltip delay={300}>
        <button
          aria-label="Search in PDF"
          aria-pressed={isSearchOpen}
          className={`inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 ${
            isSearchOpen
              ? "border-[#f12c23] bg-red-50 text-[#f12c23]"
              : "border-default-200 bg-white text-[var(--color-foreground)] hover:bg-default-100"
          }`}
          disabled={!file}
          type="button"
          onClick={() => (isSearchOpen ? closeSearch() : openSearch())}
        >
          <HugeiconsIcon icon={Search01Icon} size={14} />
          <span className="hidden sm:inline">Search</span>
        </button>
        <Tooltip.Content>
          <p>Search in PDF</p>
        </Tooltip.Content>
      </Tooltip>

      {/* Print — paid users only; builds the final edited PDF then opens
          the browser print dialog via a hidden iframe. */}
      <Tooltip delay={300}>
        <button
          aria-label="Print"
          className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-default-200 bg-white px-3 text-[13px] font-medium text-[var(--color-foreground)] transition-colors hover:bg-default-100 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
          disabled={!file}
          type="button"
          onClick={() => void handlePrint()}
        >
          <HugeiconsIcon icon={PrinterIcon} size={14} />
          <span className="hidden sm:inline">Print</span>
        </button>
        <Tooltip.Content>
          <p>Print</p>
        </Tooltip.Content>
      </Tooltip>

      {/* Share — icon-only on <sm so the top bar breathes at 375px. */}
      <button
        aria-label="Share via link"
        className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-default-200 bg-white px-3 text-[13px] font-medium text-[var(--color-foreground)] transition-colors hover:bg-default-100 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
        data-tour="editor-share"
        disabled={!canShare}
        type="button"
        onClick={() => fireEditorEvent("editor:open-share")}
      >
        <HugeiconsIcon icon={Link01Icon} size={14} />
        <span className="hidden sm:inline">Share via link</span>
      </button>

      <Button
        aria-label="Download"
        className="!h-9 !cursor-pointer !gap-2 !rounded-full !bg-[#f12c23] !px-3 !text-[13px] !font-semibold !text-white hover:!opacity-90 disabled:!opacity-50 sm:!px-4"
        data-tour="editor-download"
        isDisabled={!canDownload}
        onPress={() => setIsExportModalOpen(true)}
      >
        <HugeiconsIcon className="text-white" icon={Tick01Icon} size={15} />

        <span className="hidden sm:inline">Done</span>
      </Button>

      <ExportFormatModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />
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
        fireEditorEvent("editor:open-merge");
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

  const groups = useMemo(
    () =>
      [
        { entries: GROUP_A, dataTour: "editor-tools-a" },
        { entries: GROUP_B, dataTour: "editor-tools-b" },
        { entries: GROUP_C, dataTour: "editor-tools-c" },
        { entries: GROUP_MANAGE, dataTour: undefined as string | undefined },
      ] as const,
    [],
  );

  return (
    // Scroll container uses the `mx-auto w-fit` pattern (not
    // `justify-center`) so an overflowing pill row can be panned all
    // the way to both edges. `justify-center` on an overflow-auto
    // container traps the user at the centre and clips the leftmost
    // tools — same iOS Safari trap documented for `PdfViewerCanvas.tsx`
    // (2026-06-10 (e) in the skill log).
    <div className="shrink-0 overflow-x-auto bg-[var(--pv-canvas,#f5f5f7)] px-3 py-3">
      <div className="mx-auto flex w-fit items-center gap-3">
        {groups.map((group, i) => (
          <PillGroup key={i} dataTour={group.dataTour}>
            {group.entries.map((tool) => {
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
