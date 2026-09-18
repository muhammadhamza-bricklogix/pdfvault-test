"use client";

import type { ManagePagesDraftSnapshot } from "@/lib/client/hooks/pdf-editor/manage-pages-types";

import {
  Add01Icon,
  ArrowLeft01Icon,
  ArrowLeftRightIcon,
  ArrowRight01Icon,
  ColorsIcon,
  Copy01Icon,
  Delete02Icon,
  FileImportIcon,
  GridIcon,
  More01Icon,
  RedoIcon,
  RotateLeft01Icon,
  RotateRight01Icon,
  ThreeDScaleIcon,
  SearchAddIcon,
  SearchMinusIcon,
  SquareIcon,
  UndoIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Button,
  ColorArea,
  ColorSlider,
  Dropdown,
  Label,
  Modal,
  NumberField,
  Popover,
  Separator,
  Tooltip,
} from "@heroui/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useManagePagesDraft } from "@/lib/client/hooks/pdf-editor/use-manage-pages-draft";
import { usePdfEditorStore } from "@/lib/client/stores";

import { PageResizeDialog } from "./PageResizeDialog";
import { SortablePageList } from "./ThumbnailSidebar";

type ManagePagesModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (snapshot: ManagePagesDraftSnapshot) => void | Promise<void>;
};

type ToolbarItem = {
  icon: typeof Add01Icon;
  id: string;
  label: string;
};

// Review item #9 ("Manage Pages UI Confusion" — mobile UX pass): the
// original flat LEFT_TOOLS list crammed all 11 page-actions into one
// row with no hierarchy. Split into the handful used constantly
// (kept as direct buttons) and the rest (moved into the "More
// actions" dropdown below, PDF-Guru-style, per the user's explicit
// choice of that option over a plain re-grouping).
//
// New Page / Delete Pages are the two most fundamental actions in any
// page manager. Background Color stays a direct button too, but for a
// structural reason, not a frequency one: it opens its OWN anchored
// `Popover` with a live color picker (see `BackgroundColorPickerControl`
// below) — nesting an anchored popover trigger inside a Dropdown.Item
// doesn't work cleanly (the parent menu closes and unmounts the trigger
// before the child popover can attach to it), so it has to stay a
// standalone control either way.
const PRIMARY_LEFT_TOOLS: ToolbarItem[] = [
  { icon: Add01Icon, id: "new-page", label: "New Page" },
  { icon: Delete02Icon, id: "delete", label: "Delete Pages" },
  { icon: ColorsIcon, id: "background-color", label: "Background Color" },
];

// Everything else: all fire a plain action or open their own dialog
// (Resize Page, Move) — both compatible with a menu item, unlike
// Background Color's anchored popover above.
const OVERFLOW_LEFT_TOOLS: ToolbarItem[] = [
  { icon: Copy01Icon, id: "duplicate", label: "Duplicate" },
  { icon: RotateLeft01Icon, id: "rotate-left", label: "Rotate Left" },
  { icon: RotateRight01Icon, id: "rotate-right", label: "Rotate Right" },
  { icon: ThreeDScaleIcon, id: "resize", label: "Resize Page" },
  { icon: ArrowLeftRightIcon, id: "move", label: "Move" },
  { icon: ArrowLeft01Icon, id: "move-before", label: "Move Before" },
  { icon: ArrowRight01Icon, id: "move-after", label: "Move After" },
  { icon: FileImportIcon, id: "import", label: "Import Document" },
];

const RIGHT_TOOLS: ToolbarItem[] = [
  { icon: UndoIcon, id: "undo", label: "Undo" },
  { icon: RedoIcon, id: "redo", label: "Redo" },
  { icon: GridIcon, id: "select-all", label: "Select All" },
  { icon: SquareIcon, id: "select-none", label: "Select None" },
  { icon: SearchMinusIcon, id: "zoom-out", label: "Zoom Out" },
  { icon: SearchAddIcon, id: "zoom-in", label: "Zoom In" },
];

// Review item #9 follow-up (2026-09-18): the original icon-above-label
// stacked buttons were wide enough that the toolbar wrapped into 4
// separate, disjointed rows on a narrow modal — including the new
// "More actions" trigger landing alone on its own row with no visible
// label at all. Switched every button here to a compact, icon-only
// square (tooltip carries the label, same pattern EditorTopBar.tsx /
// PvEditorTopChrome.tsx / BottomDock.tsx already use for their
// toolbars) so the whole bar reads as one clean row instead of a
// stack of mismatched pills.
const TOOLBAR_BUTTON_CLASSES =
  "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors";

function toolbarButtonStateClasses(disabled: boolean) {
  // Review item #11 ("Manage Pages Tools Appear Active Without Page
  // Selection"): `isToolDisabled()` below was already correctly
  // preventing clicks via the native `disabled` attribute — the actual
  // gap was purely visual. `text-default-300` alone (a slightly lighter
  // icon color, no opacity change) reads as "still basically normal" at
  // a glance, especially at icon-only size — not clearly "disabled",
  // which is exactly the "tools appear tappable" confusion reported.
  // Switched to the same base color as the enabled state PLUS
  // `opacity-40`, matching the disabled treatment already used for
  // icon buttons elsewhere in this editor (e.g. Undo/Redo in
  // `PvEditorTopChrome.tsx`) — a dimmed, unmistakably-inactive look
  // instead of a subtly-different text shade.
  return disabled
    ? "cursor-not-allowed text-default-600 opacity-40"
    : "cursor-pointer text-default-600 hover:bg-default-100";
}

type ManagePagesToolbarButtonProps = {
  disabled?: boolean;
  icon: ToolbarItem["icon"];
  label: string;
  onPress?: () => void;
};

function ManagePagesToolbarButton({
  disabled = false,
  icon,
  label,
  onPress,
}: ManagePagesToolbarButtonProps) {
  return (
    <Tooltip delay={300}>
      <button
        aria-label={label}
        className={`${TOOLBAR_BUTTON_CLASSES} ${toolbarButtonStateClasses(disabled)}`}
        disabled={disabled}
        type="button"
        onClick={onPress}
      >
        <HugeiconsIcon icon={icon} size={18} />
      </button>
      <Tooltip.Content>
        <p>{label}</p>
      </Tooltip.Content>
    </Tooltip>
  );
}

/**
 * Background-color picker for selected pages.
 *
 * Why this wraps `ColorPicker` instead of using its `onChange` directly:
 * the underlying draft reducer pushes a new history entry on EVERY
 * `applyChange` call, and `ColorPicker`'s `onChange` fires per
 * drag-tick of the hue slider / SB area. Wiring the draft directly
 * means hundreds of history entries per pick and "Undo" rolling back
 * one micro-step at a time instead of one user action.
 *
 * Fix: hold the in-flight color in LOCAL state while the popover is
 * open. Only call `onApply` once when the user presses Apply — that's
 * the single history-pushing event the Undo button can roll back.
 * Cancel discards the local state without ever touching the draft.
 * (QA report 2026-06-16.)
 */
type BackgroundColorPickerControlProps = {
  isDisabled: boolean;
  /** Hex string the user committed. Called once per Apply press. */
  onApply: (color: string) => void;
  icon: ToolbarItem["icon"];
  label: string;
};

function BackgroundColorPickerControl({
  isDisabled,
  onApply,
  icon,
  label,
}: BackgroundColorPickerControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Initial pick — neutral mid-grey. The user can drag immediately;
  // local state means the draft isn't touched until Apply.
  const [draftColor, setDraftColor] = useState<string>("#808080");

  // Reset draft on every (re)open so a previously cancelled session
  // doesn't leak forward.
  const handleOpenChange = (open: boolean): void => {
    setIsOpen(open);
    if (open) setDraftColor("#808080");
  };

  const handleApply = (): void => {
    onApply(draftColor);
    setIsOpen(false);
  };

  // Warn when the picked colour is very dark. The export pipeline blends
  // page content on top of the colour with `BlendMode.Multiply`, so
  // near-black backgrounds wipe every glyph and vector to black on
  // export (QA feedback 2026-07-29 item 84). We render an inline warning
  // rather than block, since a small user set of pages (title pages,
  // spacer sheets) legitimately want a dark bg.
  const isVeryDark = (() => {
    const hex = draftColor.replace(/^#/, "");

    if (hex.length !== 6) return false;
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    // Rec. 709 relative luminance.
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    return l < 0.15;
  })();

  // Switched away from `ColorPicker` + `ColorPicker.Popover` because
  // RAC's `ColorPicker` doesn't expose top-level `isOpen` and the
  // `Trigger` couldn't drive the controlled popover state (clicks
  // didn't open the menu — QA-reported 2026-06-16). The regular
  // `<Popover>` follows the controlled pattern used in
  // `identity-popover.tsx` and gives us full open-state control plus
  // Apply / Cancel.
  // When disabled, render the button-styled visual without the
  // Popover so taps don't open an empty colour picker against
  // nothing-selected pages.
  if (isDisabled) {
    return (
      <Tooltip delay={300}>
        <span
          aria-disabled
          aria-label={label}
          className={`${TOOLBAR_BUTTON_CLASSES} ${toolbarButtonStateClasses(true)}`}
          role="button"
        >
          <HugeiconsIcon icon={icon} size={18} />
        </span>
        <Tooltip.Content>
          <p>{label}</p>
        </Tooltip.Content>
      </Tooltip>
    );
  }

  return (
    // NOT wrapping `Popover.Trigger` in a `Tooltip` here (unlike the
    // other icon-only buttons above) — `Popover` is built on React
    // Aria's `DialogTrigger`, which expects its trigger as a direct
    // child to wire up press/open state; this exact control already
    // has documented history of that wiring breaking (see the
    // 2026-06-16 QA note above re: `ColorPicker`'s Trigger not driving
    // open state). `aria-label` alone still gives it an accessible
    // name; not worth the regression risk for a hover tooltip.
    <Popover isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Popover.Trigger
        aria-label={label}
        className={`${TOOLBAR_BUTTON_CLASSES} ${toolbarButtonStateClasses(false)}`}
      >
        <HugeiconsIcon icon={icon} size={18} />
      </Popover.Trigger>
      <Popover.Content offset={8} placement="bottom">
        <Popover.Dialog className="!min-w-[260px] !p-3">
          <div className="flex flex-col gap-3">
            <ColorArea
              aria-label={label}
              className="max-w-full"
              colorSpace="hsb"
              value={draftColor}
              xChannel="saturation"
              yChannel="brightness"
              onChange={(color) => setDraftColor(color.toString("hex"))}
            >
              <ColorArea.Thumb />
            </ColorArea>
            <ColorSlider
              channel="hue"
              className="gap-1 px-1"
              colorSpace="hsb"
              value={draftColor}
              onChange={(color) => setDraftColor(color.toString("hex"))}
            >
              <ColorSlider.Track>
                <ColorSlider.Thumb />
              </ColorSlider.Track>
            </ColorSlider>
            <div className="flex items-center justify-between gap-2 pt-1">
              <span
                aria-hidden
                className="h-6 w-12 rounded border border-default-300"
                style={{ backgroundColor: draftColor }}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() => setIsOpen(false)}
                >
                  Cancel
                </Button>
                <Button size="sm" onPress={handleApply}>
                  Apply
                </Button>
              </div>
            </div>
            {isVeryDark && (
              <p className="text-[11px] leading-tight text-amber-700">
                Very dark colour — page text and vectors may be hard to read
                after apply. Consider a mid tone instead.
              </p>
            )}
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

export function ManagePagesModal({
  isOpen,
  onClose,
  onSave,
}: ManagePagesModalProps) {
  const pageCount = usePdfEditorStore((s) => s.pageCount);
  const storePageOrder = usePdfEditorStore((s) => s.pageOrder);

  const [gridZoom, setGridZoom] = useState(0.32);
  const [isResizeOpen, setIsResizeOpen] = useState(false);
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [moveTargetPage, setMoveTargetPage] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const draft = useManagePagesDraft({
    isOpen,
    pageCount,
    pageOrder: storePageOrder,
  });

  useEffect(() => {
    if (isOpen) draft.resetDraft();
  }, [draft.resetDraft, isOpen, pageCount, storePageOrder]);

  // Scroll to a newly-added page (New Page, Duplicate, Import Document —
  // anything that grows `draft.pages`) so the user sees it land instead
  // of it silently appearing off-screen in a long grid (review item #10,
  // "Added Pages Not Automatically Visible"). Diffs the id set on every
  // `draft.pages` change rather than hooking each individual action, so
  // it works uniformly regardless of which action added the page or
  // where in the list it landed (New Page can insert mid-list, right
  // after each selected page — not just at the end).
  const prevPageIdsRef = useRef<Set<string>>(
    new Set(draft.pages.map((p) => p.id)),
  );
  // `resetDraft()` above repopulates `draft.pages` from scratch every
  // time the modal opens — without this guard, that reset would look
  // identical to "a page was added" on every single open (all-new ids
  // vs. whatever `prevPageIdsRef` last held from before it was closed)
  // and jump-scroll the grid on open for no reason. Set on the open
  // transition, consumed (and cleared) by the very next pages-diff run
  // below — regardless of how many renders it takes `draft.pages` to
  // settle to its post-reset value.
  const suppressNextScrollRef = useRef(false);

  useEffect(() => {
    if (isOpen) suppressNextScrollRef.current = true;
  }, [isOpen]);

  useEffect(() => {
    const currentIds = draft.pages.map((p) => p.id);

    if (suppressNextScrollRef.current) {
      suppressNextScrollRef.current = false;
      prevPageIdsRef.current = new Set(currentIds);

      return;
    }

    const newId = currentIds.find((id) => !prevPageIdsRef.current.has(id));

    if (newId) {
      // rAF: wait one frame so the new thumbnail has actually painted
      // before we ask the browser to scroll to it.
      requestAnimationFrame(() => {
        document
          .querySelector(`[data-page-id="${CSS.escape(newId)}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }

    prevPageIdsRef.current = new Set(currentIds);
  }, [draft.pages]);

  const pageTotal = draft.pages.length;
  const hasSelection = draft.selectedCount > 0;
  // Delete is enabled whenever a page is selected. If the selection covers
  // every page, `deleteSelected()` itself blocks the mutation and surfaces
  // a "Cannot delete all pages" toast — see `use-manage-pages-draft.ts`.
  // Previously this ANDed on `pageTotal - selectedCount >= 1`, which left
  // the Delete button greyed after Select All, so the click produced no
  // visible response (QA 2026-09-06). Letting the click reach the draft
  // hook is what surfaces the feedback the user was missing.
  const canDelete = hasSelection;
  const canZoomOut = gridZoom > 0.2;
  const canZoomIn = gridZoom < 0.5;

  // Position of the selected block, used to disable the single-step move
  // buttons once the block has reached the first / last slot.
  const selectedIdSet = new Set(draft.selectedIds);
  const firstSelectedIndex = draft.pages.findIndex((p) =>
    selectedIdSet.has(p.id),
  );
  let lastSelectedIndex = -1;

  for (let i = draft.pages.length - 1; i >= 0; i -= 1) {
    if (selectedIdSet.has(draft.pages[i].id)) {
      lastSelectedIndex = i;
      break;
    }
  }
  const canMoveBefore = hasSelection && firstSelectedIndex > 0;
  const canMoveAfter =
    hasSelection && lastSelectedIndex >= 0 && lastSelectedIndex < pageTotal - 1;

  const handleToolPress = useCallback(
    (toolId: string) => {
      switch (toolId) {
        case "new-page":
          draft.addBlankPage();
          break;
        case "delete":
          draft.deleteSelected();
          break;
        case "duplicate":
          draft.duplicateSelected();
          break;
        case "rotate-left":
          draft.rotateSelected(-90);
          break;
        case "rotate-right":
          draft.rotateSelected(90);
          break;
        case "resize":
          setIsResizeOpen(true);
          break;
        case "move":
          // Default the prompt to the selected page's current position.
          setMoveTargetPage(
            firstSelectedIndex >= 0 ? firstSelectedIndex + 1 : 1,
          );
          setIsMoveOpen(true);
          break;
        case "move-before":
          draft.moveSelectedByStep(-1);
          break;
        case "move-after":
          draft.moveSelectedByStep(1);
          break;
        case "import":
          importInputRef.current?.click();
          break;
        case "undo":
          draft.undo();
          break;
        case "redo":
          draft.redo();
          break;
        case "select-all":
          draft.selectAll();
          break;
        case "select-none":
          draft.selectNone();
          break;
        case "zoom-out":
          setGridZoom((z) => Math.max(0.2, z - 0.06));
          break;
        case "zoom-in":
          setGridZoom((z) => Math.min(0.5, z + 0.06));
          break;
        default:
          break;
      }
    },
    [draft, firstSelectedIndex],
  );

  const isToolDisabled = (toolId: string) => {
    switch (toolId) {
      case "new-page":
        return false;
      case "delete":
        return !canDelete;
      case "background-color":
      case "duplicate":
      case "resize":
      case "rotate-left":
      case "rotate-right":
        return !hasSelection;
      case "move":
        return !hasSelection;
      case "move-before":
        return !canMoveBefore;
      case "move-after":
        return !canMoveAfter;
      case "import":
        return false;
      case "undo":
        return !draft.canUndo;
      case "redo":
        return !draft.canRedo;
      case "select-all":
        return pageTotal === 0;
      case "select-none":
        return !hasSelection;
      case "zoom-out":
        return !canZoomOut;
      case "zoom-in":
        return !canZoomIn;
      default:
        return true;
    }
  };

  const handleImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    e.target.value = "";

    if (!file) return;

    await draft.importPdf(file);
  };

  const handleConfirmMove = () => {
    // "before" semantics with targetPage = N lands the selected page at page N.
    draft.moveSelected(moveTargetPage, "before");
    setIsMoveOpen(false);
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      await onSave(draft.getSnapshot());
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <input
        ref={importInputRef}
        accept="application/pdf"
        className="hidden"
        type="file"
        onChange={handleImportChange}
      />

      <Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <Modal.Container
          className="!box-border !flex-none !h-[80vh] !max-h-[80vh] !min-h-0 !w-[80vw] !max-w-[80vw] sm:!w-[80vw]"
          scroll="inside"
          size="cover"
        >
          <Modal.Dialog className="flex !h-full !max-h-full !w-full !max-w-none flex-col overflow-hidden p-0 sm:!max-w-none">
            <Modal.CloseTrigger />

            {/* `flex-nowrap` + `overflow-x-auto` (not `flex-wrap`) — with
                icon-only buttons this whole bar comfortably fits on one
                line on any reasonable width, and on the rare very-narrow
                phone it scrolls as a single row instead of breaking into
                the multi-row stack review item #9 originally flagged. */}
            {/* `gap-3` (not `justify-between`) — with an explicit
                <Separator> now marking the page-actions/view-actions
                boundary, `justify-between` would just stretch empty space
                on either side of that separator instead of grouping
                everything into one tidy row. */}
            <div className="flex shrink-0 flex-nowrap items-center gap-3 overflow-x-auto border-b border-default-200 bg-[var(--color-background)] px-3 py-2 pr-12 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex flex-nowrap items-center gap-1">
                {PRIMARY_LEFT_TOOLS.map((tool) => {
                  const disabled = isToolDisabled(tool.id);

                  if (tool.id === "background-color") {
                    return (
                      <BackgroundColorPickerControl
                        key={tool.id}
                        icon={tool.icon}
                        isDisabled={disabled}
                        label={tool.label}
                        onApply={(color) =>
                          draft.setSelectedBackgroundColor(color)
                        }
                      />
                    );
                  }

                  return (
                    <ManagePagesToolbarButton
                      key={tool.id}
                      disabled={disabled}
                      icon={tool.icon}
                      label={tool.label}
                      onPress={() => handleToolPress(tool.id)}
                    />
                  );
                })}

                <Dropdown>
                  {/* HeroUI's own `Button` (not a plain <button>) as the
                      trigger — every other `Dropdown` in this codebase
                      (HamburgerMenu.tsx, language-switcher.tsx) uses it
                      this way; deviating to a native element here is
                      unproven for this exact trigger wiring and not worth
                      the risk for a cosmetic hover-shade tweak. `ghost`
                      variant is transparent at rest (matching this bar's
                      other buttons) with a `--color-default-hover` hover,
                      close enough to `hover:bg-default-100` to read as
                      consistent without touching untested trigger plumbing. */}
                  <Button
                    isIconOnly
                    aria-label="More page actions"
                    size="sm"
                    variant="ghost"
                  >
                    <HugeiconsIcon icon={More01Icon} size={18} />
                  </Button>
                  <Dropdown.Popover placement="bottom start">
                    <Dropdown.Menu
                      aria-label="More page actions"
                      disabledKeys={OVERFLOW_LEFT_TOOLS.filter((tool) =>
                        isToolDisabled(tool.id),
                      ).map((tool) => tool.id)}
                      onAction={(key) => handleToolPress(String(key))}
                    >
                      {OVERFLOW_LEFT_TOOLS.map((tool) => (
                        <Dropdown.Item
                          key={tool.id}
                          id={tool.id}
                          textValue={tool.label}
                        >
                          <HugeiconsIcon icon={tool.icon} size={16} />
                          <Label>{tool.label}</Label>
                        </Dropdown.Item>
                      ))}
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown>
              </div>

              <Separator className="!h-6 shrink-0" orientation="vertical" />

              <div className="flex flex-nowrap items-center gap-1">
                {RIGHT_TOOLS.map((tool) => (
                  <ManagePagesToolbarButton
                    key={tool.id}
                    disabled={isToolDisabled(tool.id)}
                    icon={tool.icon}
                    label={tool.label}
                    onPress={() => handleToolPress(tool.id)}
                  />
                ))}
              </div>
            </div>

            <Modal.Body className="min-h-0 flex-1 overflow-y-auto bg-default-100 p-6">
              {pageTotal > 0 ? (
                <SortablePageList
                  dragWholeCard
                  className="flex flex-wrap content-start gap-6"
                  draftPages={draft.pages}
                  importedPdfs={draft.importedPdfs}
                  layout="grid"
                  selectedIds={draft.selectedIds}
                  thumbnailZoom={gridZoom}
                  onReorderPages={draft.reorder}
                  onToggleSelect={draft.toggleSelect}
                />
              ) : (
                <p className="text-sm text-default-500">No pages to manage.</p>
              )}
            </Modal.Body>

            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-default-200 bg-[var(--color-background)] px-4 py-3">
              <Button size="sm" variant="tertiary" onPress={onClose}>
                Cancel
              </Button>
              <Button
                className="min-w-24"
                isDisabled={isSaving || pageTotal === 0}
                size="sm"
                variant="primary"
                onPress={handleSave}
              >
                {isSaving ? "Saving…" : "Save"}
              </Button>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <Modal.Backdrop
        isOpen={isMoveOpen}
        onOpenChange={(open) => {
          if (!open) setIsMoveOpen(false);
        }}
      >
        <Modal.Container className="max-w-sm">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Move to page</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="gap-4">
              {/* `p-1` on the field wrapper insets the NumberField 4px on
                  both x and y axes so its focus ring / hover border don't
                  get shaved by Modal.Dialog's ~24px rounded corners. Same
                  pattern as the Rename Document modal. */}
              <div className="flex flex-col gap-2 p-1">
                <Label htmlFor="move-target-page">Target page number</Label>
                <NumberField
                  id="move-target-page"
                  maxValue={pageTotal}
                  minValue={1}
                  value={moveTargetPage}
                  onChange={(next) => {
                    if (typeof next === "number" && Number.isFinite(next)) {
                      setMoveTargetPage(next);
                    }
                  }}
                >
                  <NumberField.Group>
                    <NumberField.DecrementButton />
                    <NumberField.Input />
                    <NumberField.IncrementButton />
                  </NumberField.Group>
                </NumberField>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onPress={() => setIsMoveOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onPress={handleConfirmMove}>
                Move
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <PageResizeDialog
        isOpen={isResizeOpen}
        selectedCount={draft.selectedCount}
        onApply={(preset) => {
          draft.resizeSelected(preset.widthPt, preset.heightPt);
        }}
        onClose={() => setIsResizeOpen(false)}
      />
    </>
  );
}
