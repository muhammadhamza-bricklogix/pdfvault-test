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

// Background Color stays a direct button (not a Dropdown.Item) because it opens its own
// anchored Popover, and a popover trigger nested inside a Dropdown.Item doesn't work cleanly.
const PRIMARY_LEFT_TOOLS: ToolbarItem[] = [
  { icon: Add01Icon, id: "new-page", label: "New Page" },
  { icon: Delete02Icon, id: "delete", label: "Delete Pages" },
  { icon: ColorsIcon, id: "background-color", label: "Background Color" },
];

// Every other page action lives in this single "More actions" dropdown.
const MORE_ACTIONS_TOOLS: ToolbarItem[] = [
  { icon: Copy01Icon, id: "duplicate", label: "Duplicate" },
  { icon: RotateLeft01Icon, id: "rotate-left", label: "Rotate Left" },
  { icon: RotateRight01Icon, id: "rotate-right", label: "Rotate Right" },
  { icon: ThreeDScaleIcon, id: "resize", label: "Resize Page" },
  { icon: ArrowLeftRightIcon, id: "move", label: "Move" },
  { icon: ArrowLeft01Icon, id: "move-before", label: "Move Before" },
  { icon: ArrowRight01Icon, id: "move-after", label: "Move After" },
  { icon: FileImportIcon, id: "import", label: "Import Document" },
  { icon: UndoIcon, id: "undo", label: "Undo" },
  { icon: RedoIcon, id: "redo", label: "Redo" },
  { icon: GridIcon, id: "select-all", label: "Select All" },
  { icon: SquareIcon, id: "select-none", label: "Select None" },
  { icon: SearchMinusIcon, id: "zoom-out", label: "Zoom Out" },
  { icon: SearchAddIcon, id: "zoom-in", label: "Zoom In" },
];

// Icon-only square styling, used by BackgroundColorPickerControl's standalone trigger.
const TOOLBAR_BUTTON_CLASSES =
  "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors";

function toolbarButtonStateClasses(disabled: boolean) {
  // Dimmed opacity (not just a lighter text color) so disabled reads as clearly inactive.
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

function ManagePagesLabeledButton({
  disabled = false,
  icon,
  label,
  onPress,
}: ManagePagesToolbarButtonProps) {
  return (
    <Button
      isDisabled={disabled}
      size="sm"
      variant="tertiary"
      onPress={onPress}
    >
      <HugeiconsIcon icon={icon} size={16} />
      {label}
    </Button>
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
    // Not wrapped in a Tooltip: Popover.Trigger must be a direct child for React
    // Aria's DialogTrigger to wire up press/open state correctly.
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

  // Scroll a newly-added page into view (New Page, Duplicate, Import Document
  // all grow `draft.pages`); diffs the id set so it works regardless of where
  // in the list the new page landed.
  const prevPageIdsRef = useRef<Set<string>>(
    new Set(draft.pages.map((p) => p.id)),
  );
  // Guards against resetDraft() on open being mistaken for a newly-added page.
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
          // 95vw on phones (below sm) so the toolbar has room; sm: and up keeps 80vw.
          className="!box-border !flex-none !h-[80vh] !max-h-[80vh] !min-h-0 !w-[95vw] !max-w-[95vw] sm:!w-[80vw] sm:!max-w-[80vw]"
          scroll="inside"
          size="cover"
        >
          <Modal.Dialog className="flex !h-full !max-h-full !w-full !max-w-none flex-col overflow-hidden p-0 sm:!max-w-none">
            <Modal.CloseTrigger />

            {/* The primary tools scroll independently so the "⋯" trigger (entry point to
                every other action) stays outside that area and is never clipped or scrolled
                out of view. */}
            <div className="flex shrink-0 items-center gap-1 border-b border-default-200 bg-[var(--color-background)] py-2 pr-12 pl-3">
              <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                    <ManagePagesLabeledButton
                      key={tool.id}
                      disabled={disabled}
                      icon={tool.icon}
                      label={tool.label}
                      onPress={() => handleToolPress(tool.id)}
                    />
                  );
                })}
              </div>

              <Dropdown>
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
                    disabledKeys={MORE_ACTIONS_TOOLS.filter((tool) =>
                      isToolDisabled(tool.id),
                    ).map((tool) => tool.id)}
                    onAction={(key) => handleToolPress(String(key))}
                  >
                    {MORE_ACTIONS_TOOLS.map((tool) => (
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
              <Button variant="secondary" onPress={onClose}>
                Cancel
              </Button>
              <Button
                isDisabled={isSaving || pageTotal === 0}
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
