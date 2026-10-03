"use client";

import type { Key } from "@heroui/react";
import type { ActiveTool } from "@/lib/client/stores/pdf-editor-store";

import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowUp01Icon,
  BackgroundIcon,
  Cursor01Icon,
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
  SearchAddIcon,
  SearchMinusIcon,
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
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ThemeToggle } from "@/components/ui/theme/theme-toggle";
import { dispatchAuthModal } from "@/components/shared/auth-modal";
import { useRenameDocumentMutation } from "@/lib/client/query/mutations/documents.mutation";
import { saveBeforeAction } from "@/lib/client/pdf-editor/save-before-action";
import { snapshotPendingEditorFile } from "@/lib/client/upload/pending-editor-file";
import {
  parseLocalePrefix,
  stripLocalePrefix,
} from "@/lib/shared/constants/locale-map";
import { ROUTES } from "@/lib/shared/constants/routes";
import { stripPdfExtension } from "@/lib/shared/schemas/documents/rename.schema";
import { toast } from "@/lib/shared/utils/toast";
import { usePdfEditorStore } from "@/lib/client/stores";

import { EditableFilenameField } from "./EditableFilenameField";
import { ExportFormatModal } from "./ExportFormatModal";
import { HamburgerMenu } from "./HamburgerMenu";

const ZOOM_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

// ---------------------------------------------------------------
// Info Bar — filename, page navigation, zoom, save
// ---------------------------------------------------------------

export function EditorInfoBar() {
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const file = usePdfEditorStore((s) => s.file);
  const setFile = usePdfEditorStore((s) => s.setFile);
  const setCurrentDocument = usePdfEditorStore((s) => s.setCurrentDocument);
  const isSignedIn = usePdfEditorStore((s) => s.isSignedIn);
  const pageCount = usePdfEditorStore((s) => s.pageCount);
  const zoom = usePdfEditorStore((s) => s.zoom);
  const currentDocumentId = usePdfEditorStore((s) => s.currentDocumentId);
  const setCurrentPage = usePdfEditorStore((s) => s.setCurrentPage);
  const setIsFindReplaceOpen = usePdfEditorStore((s) => s.setIsFindReplaceOpen);
  const setZoom = usePdfEditorStore((s) => s.setZoom);
  // Scalar-boolean selectors so the mobile top bar doesn't re-render
  // on every brush stroke (QA 2026-09-15). Same rationale as
  // `HistoryActions` below — see that block's comment.
  const canUndo = usePdfEditorStore(
    (s) => (s.historyIndexByPage.get(s.currentPage) ?? -1) > 0,
  );
  const canRedo = usePdfEditorStore((s) => {
    const idx = s.historyIndexByPage.get(s.currentPage) ?? -1;
    const len = s.historyByPage.get(s.currentPage)?.length ?? 0;

    return idx < len - 1;
  });

  const renameDoc = useRenameDocumentMutation();

  // Hide the HamburgerMenu on the W-9 routes (`/w-9-form` and
  // `/forms/w-9/edit`). Both routes reuse `PdfEditorShell` so the menu
  // would otherwise render; the W-9 flow has its own dedicated Back and
  // Download interceptors and doesn't want the pdf-editor menu items
  // (Create New / Open File / My PDFs / Version History) surfacing.
  // Back button stays visible.
  const pathname = usePathname();
  const isW9Route = useMemo(() => isTaxFormEditorRoute(pathname), [pathname]);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSavingBeforeExport, setIsSavingBeforeExport] = useState(false);
  const [isThumbsOpen, setIsThumbsOpen] = useState(false);

  useEffect(() => {
    const toggle = () => setIsThumbsOpen((prev) => !prev);

    window.addEventListener("editor:toggle-thumbs", toggle);

    return () => window.removeEventListener("editor:toggle-thumbs", toggle);
  }, []);

  // Welcome-email arrival — mirror of PvEditorTopChrome. Derived
  // open-state (`isOpen={isExportModalOpen || pendingOpenExportModal}`
  // below) + close handler that clears both flags. See the sibling
  // block in PvEditorTopChrome + `pendingOpenExportModal` docstring
  // in pdf-editor-store for full rationale (React 19's
  // `react-hooks/set-state-in-effect` rule + hydrator/chrome mount race).
  const pendingOpenExportModal = usePdfEditorStore(
    (s) => s.pendingOpenExportModal,
  );
  const setPendingOpenExportModal = usePdfEditorStore(
    (s) => s.setPendingOpenExportModal,
  );

  const zoomOut = () => {
    const prev = ZOOM_PRESETS.filter((z) => z < zoom).at(-1);

    if (prev !== undefined) setZoom(prev);
  };

  const zoomIn = () => {
    const next = ZOOM_PRESETS.find((z) => z > zoom);

    if (next !== undefined) setZoom(next);
  };

  const fileName = file?.name ?? "PDF Editor";
  // Display name strips `.pdf` because the extension is redundant in
  // an editor that only handles PDFs — commit re-appends it before
  // saving. Input state is fully owned by <EditableFilenameField/>.
  const displayName = fileName.replace(/\.pdf$/i, "");

  // Called from EditableFilenameField with the trimmed new name.
  // Empty guard runs inside the component so we only see non-empty
  // values here.
  const commitRename = (trimmed: string) => {
    if (!file) return;

    const withExt = `${stripPdfExtension(trimmed).trim()}.pdf`;

    if (withExt === file.name) return;

    const renamed = new File([file], withExt, {
      lastModified: file.lastModified,
      type: file.type,
    });

    setFile(renamed);

    if (currentDocumentId) {
      // Keep the store's document name in step with the File. The desktop
      // top bar and both library-save helpers read `currentDocumentName`
      // FIRST, so leaving it stale makes the next save re-upload under the
      // old name and the backend renames the row straight back.
      setCurrentDocument({ id: currentDocumentId, name: withExt });
      renameDoc.mutate({ filename: withExt, id: currentDocumentId });
    }
  };

  // Enable Save whenever a file is open. Signed-out users get bounced into
  // the sign-in flow (with a redirect back to `/pdf-composer`) instead of
  // hitting a silently-disabled button — that was confusing users into
  // thinking Save was broken.
  const canSave = !!file;
  const canShare = !!file && isSignedIn;
  const saveTooltip = !file
    ? "Open a PDF to save"
    : !isSignedIn
      ? "Login to save to your library"
      : "Save";
  const onSaveClick = () => {
    if (!isSignedIn) {
      // Persist the file + any per-page Fabric edits to IDB before the
      // full-page sign-in redirect so the hydrator can restore the exact
      // state the user was in after they authenticate.
      void snapshotPendingEditorFile().catch(() => undefined);

      // AuthModal (2026-08-28 unify). Clean return URL — no ?fresh=1
      // / ?tool= so the hydrator's guards don't wipe the IDB file we
      // just snapshotted. Cards' finalize does `window.location.assign`
      // (item #15).
      // Preserve URL locale in the finalize redirect — otherwise the
      // post-signup `window.location.assign` (auth chain #15) lands on
      // bare `/pdf-composer` from any `/{locale}/pdf-composer`.
      dispatchAuthModal({
        mode: "signup",
        redirectUrl: (() => {
          const parsed = parseLocalePrefix(pathname ?? "/");

          return parsed
            ? `/${parsed.locale}${ROUTES.TOOLS.PDF_EDITOR}`
            : ROUTES.TOOLS.PDF_EDITOR;
        })(),
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
  //
  // QA 2026-09-07: save the current edits to cloud FIRST, then open the
  // modal. Guarantees the cloud has the latest baked bytes before the
  // subsequent Download click runs. Signed-out users skip the save (the
  // export flow itself routes them through email-first signin).
  const openExportModal = () => {
    if (!file) return;
    if (!isSignedIn) {
      setIsExportModalOpen(true);

      return;
    }
    setIsSavingBeforeExport(true);
    const toastKey = toast.loading({
      title: "Saving your edits",
      description: "Hold on — we'll open the download options once saved.",
    });

    window.dispatchEvent(
      new CustomEvent("editor:save-before-action", {
        detail: {
          force: true,
          skipReset: true,
          onComplete: () => {
            toast.close(toastKey);
            setIsSavingBeforeExport(false);
            setIsExportModalOpen(true);
          },
        },
      }),
    );
  };

  const openShareModal = () => {
    if (!canShare) return;

    window.dispatchEvent(new CustomEvent("editor:open-share"));
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
      <ExportFormatModal
        isOpen={isExportModalOpen || pendingOpenExportModal}
        onClose={() => {
          setIsExportModalOpen(false);
          setPendingOpenExportModal(false);
        }}
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
        <div className="flex items-center justify-between gap-2 max-sm:gap-1 sm:flex-1 max-sm:[&_.button]:!size-8 max-sm:[&_.button]:!min-w-8">
          <div className="flex items-center gap-0.5 sm:gap-1">
            {/* Back - desktop/tablet only in this legacy responsive bar. */}
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
            </div>

            {/* Back — mobile only */}
            <Button
              aria-label="Back to dashboard"
              className="sm:hidden"
              size="sm"
              variant="tertiary"
              onPress={handleBack}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
            </Button>

            {/*
              Same menu as desktop, next to Back like the desktop top bar.
              HamburgerMenu gates its visible trigger on `isSignedIn`, but
              remains mounted for guests so editor bridge listeners keep
              working.
            */}
            {isW9Route ? null : <HamburgerMenu />}

            {/* Zoom first, matching the desktop top bar order. */}
            <div className="flex items-center gap-0.5 sm:hidden">
              <Tooltip delay={300}>
                <Button
                  aria-label="Zoom out"
                  isDisabled={zoom <= ZOOM_PRESETS[0]}
                  size="sm"
                  variant="tertiary"
                  onPress={zoomOut}
                >
                  <HugeiconsIcon icon={SearchMinusIcon} size={16} />
                </Button>
                <Tooltip.Content>
                  <p>Zoom out</p>
                </Tooltip.Content>
              </Tooltip>
              <Tooltip delay={300}>
                <Button
                  aria-label="Zoom in"
                  isDisabled={zoom >= ZOOM_PRESETS[ZOOM_PRESETS.length - 1]}
                  size="sm"
                  variant="tertiary"
                  onPress={zoomIn}
                >
                  <HugeiconsIcon icon={SearchAddIcon} size={16} />
                </Button>
                <Tooltip.Content>
                  <p>Zoom in</p>
                </Tooltip.Content>
              </Tooltip>
            </div>

            {/* Undo + Redo — mobile only */}
            <div className="flex items-center gap-0.5 sm:hidden">
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
          </div>

          {/* Filename + page nav — sits in the middle on sm+, hidden on
              mobile (the dedicated nav row below carries page navigation).
              Filename itself is hidden below md so the row doesn't get
              squeezed between save/tools/zoom on tablets. */}
          <div className="hidden min-w-0 items-center gap-2 sm:flex lg:gap-3">
            {/* QA 2026-09-08: filename input wrapped in a persistently-
                bordered container + pencil icon adornment so the edit
                affordance is visible without hovering. Matches the
                PvEditorTopChrome treatment. */}
            <div className="hidden md:inline-flex">
              <EditableFilenameField
                ariaLabel="Document name"
                className="max-w-24 lg:max-w-40"
                disabled={!file}
                fontSizeClass="text-sm"
                value={displayName}
                onCommit={commitRename}
              />
            </div>

            {/* QA 2026-09-08: SaveStatusChip removed per product decision.
                See PvEditorTopChrome for the same removal + full rationale. */}

            <Separator
              className="!h-4 hidden self-center md:block"
              orientation="vertical"
            />

            {pageNav}
          </div>

          {/* Right: zoom (sm+ only) + save + export trio + theme. */}
          <div className="flex items-center gap-0.5 sm:gap-1">
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

            {/* Export controls — Search / Print / Share / Done.
                Search toggles the search bar (same as desktop). Print/Done
                open the format modal. */}
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
            <Button
              aria-label="Share"
              isDisabled={!canShare}
              size="sm"
              variant="secondary"
              onPress={openShareModal}
            >
              <HugeiconsIcon icon={Share01Icon} size={14} />
              <span className="ml-1 hidden sm:inline">Share</span>
            </Button>
            <Button
              aria-label="Finish and Download"
              isDisabled={!file || isSavingBeforeExport}
              size="sm"
              variant="primary"
              onPress={openExportModal}
            >
              <HugeiconsIcon icon={Tick01Icon} size={14} />
              <span className="ml-1 hidden sm:inline">
                {isSavingBeforeExport ? "Saving…" : "Finish & Download"}
              </span>
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

// Exported so BottomDock.tsx (mobile) can build its own grouped pill layout from this same tool list.
export const TOOLS = [
  { icon: Cursor01Icon, id: "select", label: "Select" },
  { icon: PencilEdit01Icon, id: "editText", label: "Edit" },
  { icon: SignatureIcon, id: "signature", label: "Sign" },
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

    // See `PvEditorTopChrome.tsx` for the desktop counterpart + reasoning.
    // Only user toolbar clicks fire this; programmatic `setActiveTool`
    // calls stay silent so newly-added objects (image tool, etc.) keep
    // their selection.
    window.dispatchEvent(new CustomEvent("editor:toolbar-tool-picked"));
    setActiveTool(key);
  };

  return (
    <Toolbar aria-label="Drawing tools">
      <ToggleButtonGroup
        disallowEmptySelection
        // isDetached separates buttons into individual pills instead of one continuous bar.
        // HeroUI's default radius (rounded-3xl) still needs an explicit rounded-md override
        // below on each ToggleButton to match ACTION_TOOLS' shape.
        isDetached
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
              className="h-auto flex-col gap-0.5 rounded-md px-2.5 py-1.5"
              id={tool.id}
            >
              {i > 0 && <ToggleButtonGroup.Separator />}
              <HugeiconsIcon icon={tool.icon} size={toolIconSize} />
              <span className="text-[10px] leading-tight">{tool.label}</span>
            </ToggleButton>
          ) : (
            <Tooltip key={tool.id} delay={300}>
              <ToggleButton
                isIconOnly
                aria-label={tool.label}
                className="rounded-md"
                id={tool.id}
              >
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
  // Scalar-boolean selectors (QA 2026-09-15). Reading the full
  // `historyByPage` / `historyIndexByPage` Maps subscribes this
  // component to every Map-recreate — every `pushHistory` fires a new
  // Map, so the toolbar re-rendered on every brush stroke / typed
  // character. Rapid-input tools (draw, eraser, edit-text) then
  // toggled `disabled={!canUndo}` mid-pointerdown, and React Aria's
  // `usePress` cancels the press when `disabled` flips → the user's
  // Undo / Redo click was silently dropped ("dead click"). Deriving
  // the two booleans inline keeps Zustand's shallow equality check on
  // primitives, so the component only re-renders when the boolean
  // actually changes.
  const canUndo = usePdfEditorStore(
    (s) => (s.historyIndexByPage.get(s.currentPage) ?? -1) > 0,
  );
  const canRedo = usePdfEditorStore((s) => {
    const idx = s.historyIndexByPage.get(s.currentPage) ?? -1;
    const len = s.historyByPage.get(s.currentPage)?.length ?? 0;

    return idx < len - 1;
  });

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
  const isSignedIn = usePdfEditorStore((s) => s.isSignedIn);
  const setIsManagePagesOpen = usePdfEditorStore((s) => s.setIsManagePagesOpen);

  const canManagePages = !!pdfDocument && pageCount > 0;

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
