"use client";

import type { Key } from "@heroui/react";
import type { ActiveTool } from "@/lib/client/stores/pdf-editor-store";

import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowUp01Icon,
  BackgroundIcon,
  Cursor01Icon,
  DashboardSpeed01Icon,
  DownloadIcon,
  EraserIcon,
  HighlighterIcon,
  Image01Icon,
  Layout03Icon,
  NoteIcon,
  PaintBrush01Icon,
  PaintBucketIcon,
  PencilEdit01Icon,
  PrinterIcon,
  RedoIcon,
  FloppyDiskIcon,
  Search01Icon,
  Share01Icon,
  ShapesIcon,
  SignatureIcon,
  Stamp01Icon,
  TextFontIcon,
  Tick01Icon,
  UndoIcon,
  ViewOffIcon,
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
import { useEffect, useRef, useState } from "react";

import { ThemeToggle } from "@/components/ui/theme/theme-toggle";
import { dispatchSignInPrompt } from "@/components/shared/sign-in-prompt-modal";
import { useRenameDocumentMutation } from "@/lib/client/query/mutations/documents.mutation";
import { saveBeforeAction } from "@/lib/client/pdf-editor/save-before-action";
import { snapshotPendingEditorFile } from "@/lib/client/upload/pending-editor-file";
import { ROUTES } from "@/lib/shared/constants/routes";
import { usePdfEditorStore } from "@/lib/client/stores";

import { ExportFormatModal } from "./ExportFormatModal";
import { HamburgerMenu } from "./HamburgerMenu";
import { SaveStatusChip } from "./SaveStatusChip";
import { ToolsModal } from "./ToolsModal";

const ZOOM_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

// ---------------------------------------------------------------------------
// Info Bar — filename, page navigation, zoom, save
// ---------------------------------------------------------------------------

export function EditorInfoBar() {
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const file = usePdfEditorStore((s) => s.file);
  const setFile = usePdfEditorStore((s) => s.setFile);
  const isSignedIn = usePdfEditorStore((s) => s.isSignedIn);
  const pageCount = usePdfEditorStore((s) => s.pageCount);
  const zoom = usePdfEditorStore((s) => s.zoom);
  const currentDocumentId = usePdfEditorStore((s) => s.currentDocumentId);
  const setCurrentPage = usePdfEditorStore((s) => s.setCurrentPage);
  const setIsFindReplaceOpen = usePdfEditorStore((s) => s.setIsFindReplaceOpen);
  const setZoom = usePdfEditorStore((s) => s.setZoom);
  const historyByPage = usePdfEditorStore((s) => s.historyByPage);
  const historyIndexByPage = usePdfEditorStore((s) => s.historyIndexByPage);

  const mobileHistory = historyByPage.get(currentPage) ?? [];
  const mobileHistoryIdx = historyIndexByPage.get(currentPage) ?? -1;
  const canUndo = mobileHistoryIdx > 0;
  const canRedo = mobileHistoryIdx < mobileHistory.length - 1;

  const renameDoc = useRenameDocumentMutation();
  const [isToolsModalOpen, setIsToolsModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isThumbsOpen, setIsThumbsOpen] = useState(false);

  useEffect(() => {
    const toggle = () => setIsThumbsOpen((prev) => !prev);

    window.addEventListener("editor:toggle-thumbs", toggle);

    return () => window.removeEventListener("editor:toggle-thumbs", toggle);
  }, []);

  const zoomOut = () => {
    const prev = ZOOM_PRESETS.filter((z) => z < zoom).at(-1);

    if (prev !== undefined) setZoom(prev);
  };

  const zoomIn = () => {
    const next = ZOOM_PRESETS.find((z) => z > zoom);

    if (next !== undefined) setZoom(next);
  };

  const fileName = file?.name ?? "PDF Editor";
  // Uncontrolled input keyed on `fileName` so external renames reset
  // it without a setState-in-effect anti-pattern. Display strips `.pdf`
  // — commit re-appends it before saving.
  const nameInputRef = useRef<HTMLInputElement>(null);
  const displayName = fileName.replace(/\.pdf$/i, "");

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
      // Persist the file + any per-page Fabric edits to IDB before the
      // full-page sign-in redirect so the hydrator can restore the exact
      // state the user was in after they authenticate.
      void snapshotPendingEditorFile().catch(() => undefined);

      dispatchSignInPrompt({
        title: "Sign in to save",
        description:
          "Create an account and we'll bring you right back to save your document where you left off.",
        confirmLabel: "Sign in & continue",
        // Explicit clean return URL so the hydrator's ?fresh=1 / ?tool=
        // guards don't accidentally wipe the IDB file we just saved.
        redirectUrl: ROUTES.TOOLS.PDF_EDITOR,
      });

      return;
    }
    window.dispatchEvent(new CustomEvent("editor:save"));
  };

  // PRD §7.2: Back arrow returns the user to their dashboard (or the
  // landing page if the app itself hasn't authenticated them yet, so a
  // signed-out visitor exploring the editor isn't bounced through a
  // sign-in dead-end just for pressing Back).
  //
  // Clear the store BEFORE navigating so re-entry via any path — bare
  // `/pdf-editor`, tool tile, a landing-page drop that creates a new doc —
  // doesn't render the previous PDF while the new load is in flight.
  // Reported 2026-08-18: "open PDF, edit, go back, open another PDF still
  // shows the previous PDF".
  const handleBack = () => {
    // Save-then-navigate mirrors the Hamburger's "My PDFs" flow so a
    // user pressing Back with unsaved edits (text, watermark, signature,
    // drawings, etc.) doesn't lose them. The listener in
    // `useEditorNavigationSave` handles the "no file / signed out / no
    // unsaved changes" fast paths, so this is safe for every state.
    // `clearFileAfter: true` preserves the 2026-08-18 fix — clearing
    // the store before re-entry stops the previous PDF flashing on the
    // next editor load.
    window.dispatchEvent(
      new CustomEvent("editor:navigate-after-save", {
        detail: {
          url: isSignedIn ? ROUTES.APP.DASHBOARD : ROUTES.PUBLIC.HOME,
          clearFileAfter: true,
        },
      }),
    );
  };

  // PRD §7.3: Print / Download / Done all open the same format modal.
  // Behavioral parity across the trio matches the reference; the modal
  // itself is what dispatches editor:export with the chosen format.
  const openExportModal = () => {
    if (!file) return;
    setIsExportModalOpen(true);
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
      <ExportFormatModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />
      {/*
        Mobile (<sm) gets a two-row layout: action bar on row 1, page + zoom
        nav on row 2. The single-row variant crammed five button groups into
        ~320px on narrow phones and QA reported the next-page `›` and zoom
        `−` controls overlapping / clipping at the section boundary, making
        them un-tappable. Splitting nav onto its own centered row gives both
        groups full reach without sacrificing the desktop layout.
      */}
      <div className="flex flex-col gap-1 px-2 py-1 sm:min-h-10 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-2 sm:gap-y-1 sm:py-1 lg:px-3">
        {/* Action row: left actions + right save/theme. Doubles as the only
            row on sm+ where the page nav sits between them. */}
        <div className="flex items-center justify-between gap-2 sm:flex-1">
          <div className="flex items-center gap-1">
            {/* Back + Hamburger — desktop only */}
            <div className="hidden sm:flex sm:items-center sm:gap-1">
              <Tooltip delay={300}>
                <Button
                  aria-label="Back to dashboard"
                  size="sm"
                  variant="tertiary"
                  onPress={handleBack}
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
                </Button>
                <Tooltip.Content>
                  <p>Back to dashboard</p>
                </Tooltip.Content>
              </Tooltip>
              <HamburgerMenu />
            </div>

            {/* Undo + Redo — mobile only */}
            <div className="flex items-center gap-1 sm:hidden">
              <Button
                aria-label="Undo"
                isDisabled={!canUndo}
                size="sm"
                variant="tertiary"
                onPress={() =>
                  window.dispatchEvent(new CustomEvent("editor:undo"))
                }
              >
                <HugeiconsIcon icon={UndoIcon} size={16} />
              </Button>
              <Button
                aria-label="Redo"
                isDisabled={!canRedo}
                size="sm"
                variant="tertiary"
                onPress={() =>
                  window.dispatchEvent(new CustomEvent("editor:redo"))
                }
              >
                <HugeiconsIcon icon={RedoIcon} size={16} />
              </Button>
            </div>

            <Tooltip delay={300}>
              <Button
                aria-label="Browse all tools"
                size="sm"
                variant="tertiary"
                onPress={() => setIsToolsModalOpen(true)}
              >
                <HugeiconsIcon icon={DashboardSpeed01Icon} size={16} />
              </Button>
              <Tooltip.Content>
                <p>Browse PDF and image tools</p>
              </Tooltip.Content>
            </Tooltip>
          </div>

          {/* Filename + page nav — sits in the middle on sm+, hidden on
              mobile (the dedicated nav row below carries page navigation).
              Filename itself is hidden below md so the row doesn't get
              squeezed between save/tools/zoom on tablets. */}
          <div className="hidden min-w-0 items-center gap-2 sm:flex lg:gap-3">
            <input
              key={fileName}
              ref={nameInputRef}
              aria-label="Document name"
              className="hidden max-w-24 truncate rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-[var(--color-foreground)] outline-none transition-colors hover:border-default-200 focus:border-[#f12c23] focus:bg-white md:inline-block lg:max-w-40"
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
                  if (nameInputRef.current)
                    nameInputRef.current.value = displayName;
                  nameInputRef.current?.blur();
                }
              }}
            />

            <SaveStatusChip />

            <Separator
              className="!h-4 hidden self-center md:block"
              orientation="vertical"
            />

            {pageNav}
          </div>

          {/* Right: zoom (sm+ only) + save + export trio + theme. */}
          <div className="flex items-center gap-1">
            <div className="hidden sm:block">{zoomNav}</div>

            <Separator
              className="!h-4 hidden self-center sm:block"
              orientation="vertical"
            />

            {/* Save button — HIDDEN for now per product decision. Restore
                by removing the surrounding `{false && (…)}` wrapper. */}
            {false && (
              <Tooltip delay={300}>
                <Button
                  aria-label="Save"
                  isDisabled={!canSave}
                  size="sm"
                  variant="tertiary"
                  onPress={onSaveClick}
                >
                  <HugeiconsIcon icon={FloppyDiskIcon} size={16} />
                </Button>
                <Tooltip.Content>
                  <p>{saveTooltip}</p>
                </Tooltip.Content>
              </Tooltip>
            )}

            <Separator
              className="!h-4 hidden self-center sm:block"
              orientation="vertical"
            />

            {/* Export controls — Search / Print / Download / Share / Done.
                Search opens Find & Replace. Print/Download/Share/Done
                open the shared format-selection modal. */}
            <Tooltip delay={300}>
              <Button
                aria-label="Search"
                isDisabled={!file}
                size="sm"
                variant="tertiary"
                onPress={() => setIsFindReplaceOpen(true)}
              >
                <HugeiconsIcon icon={Search01Icon} size={16} />
              </Button>
              <Tooltip.Content>
                <p>Find &amp; Replace</p>
              </Tooltip.Content>
            </Tooltip>
            <Tooltip delay={300}>
              <Button
                aria-label="Print"
                isDisabled={!file}
                size="sm"
                variant="tertiary"
                onPress={openExportModal}
              >
                <HugeiconsIcon icon={PrinterIcon} size={16} />
              </Button>
              <Tooltip.Content>
                <p>Print</p>
              </Tooltip.Content>
            </Tooltip>
            <Tooltip delay={300}>
              <Button
                aria-label="Download"
                isDisabled={!file}
                size="sm"
                variant="tertiary"
                onPress={openExportModal}
              >
                <HugeiconsIcon icon={DownloadIcon} size={16} />
              </Button>
              <Tooltip.Content>
                <p>Download</p>
              </Tooltip.Content>
            </Tooltip>
            <Button
              aria-label="Share"
              isDisabled={!file}
              size="sm"
              variant="secondary"
              onPress={openExportModal}
            >
              <HugeiconsIcon icon={Share01Icon} size={14} />
              <span className="ml-1 hidden sm:inline">Share</span>
            </Button>
            <Button
              aria-label="Done"
              isDisabled={!file}
              size="sm"
              variant="primary"
              onPress={openExportModal}
            >
              <HugeiconsIcon icon={Tick01Icon} size={14} />
              <span className="ml-1 hidden sm:inline">Done</span>
            </Button>

            <Separator
              className="!h-4 hidden self-center sm:block"
              orientation="vertical"
            />
            <ThemeToggle size="sm" variant="tertiary" />
          </div>
        </div>

        {/* Second row: pages thumbnail toggle — mobile only */}
        {pageCount > 1 && (
          <div className="flex items-center justify-center border-t border-default-100 pt-1 sm:hidden">
            <Button
              aria-expanded={isThumbsOpen}
              aria-label={isThumbsOpen ? "Hide pages" : "Show pages"}
              size="sm"
              variant={isThumbsOpen ? "secondary" : "tertiary"}
              onPress={() =>
                window.dispatchEvent(new CustomEvent("editor:toggle-thumbs"))
              }
            >
              <HugeiconsIcon icon={NoteIcon} size={16} />
              <HugeiconsIcon
                icon={isThumbsOpen ? ArrowDown01Icon : ArrowUp01Icon}
                size={14}
              />
            </Button>
          </div>
        )}
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
  { icon: TextFontIcon, id: "text", label: "Add Text" },
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
    <div className="flex min-h-14 shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-2 px-3 py-2">
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
