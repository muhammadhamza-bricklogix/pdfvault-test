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
  ColorPicker,
  ColorSlider,
  Label,
  Modal,
  NumberField,
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

const LEFT_TOOLS: ToolbarItem[] = [
  { icon: Add01Icon, id: "new-page", label: "New Page" },
  { icon: Delete02Icon, id: "delete", label: "Delete Pages" },
  { icon: Copy01Icon, id: "duplicate", label: "Duplicate" },
  { icon: RotateLeft01Icon, id: "rotate-left", label: "Rotate Left" },
  { icon: RotateRight01Icon, id: "rotate-right", label: "Rotate Right" },
  { icon: ThreeDScaleIcon, id: "resize", label: "Resize Page" },
  { icon: ColorsIcon, id: "background-color", label: "Background Color" },
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

const TOOLBAR_BUTTON_CLASSES =
  "flex shrink-0 flex-col items-center gap-1 rounded-md px-2 py-1.5 text-[11px] transition-colors";

function toolbarButtonStateClasses(disabled: boolean) {
  return disabled
    ? "cursor-not-allowed text-default-300"
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
        className={`${TOOLBAR_BUTTON_CLASSES} ${toolbarButtonStateClasses(disabled)}`}
        disabled={disabled}
        type="button"
        onClick={onPress}
      >
        <HugeiconsIcon icon={icon} size={18} />
        <span className="whitespace-nowrap leading-tight">{label}</span>
      </button>
      <Tooltip.Content>
        <p>{label}</p>
      </Tooltip.Content>
    </Tooltip>
  );
}

// Visual-only variant used inside a parent that is already a button (e.g.
// HeroUI's `ColorPicker.Trigger`). Renders a span so we don't create the
// invalid `<button>` inside `<button>` DOM that triggers a React hydration
// error.
type ManagePagesToolbarButtonContentProps = {
  ariaLabel?: string;
  disabled?: boolean;
  icon: ToolbarItem["icon"];
  label: string;
};

function ManagePagesToolbarButtonContent({
  ariaLabel,
  disabled = false,
  icon,
  label,
}: ManagePagesToolbarButtonContentProps) {
  return (
    <Tooltip delay={300}>
      <span
        aria-label={ariaLabel ?? label}
        className={`${TOOLBAR_BUTTON_CLASSES} ${toolbarButtonStateClasses(disabled)}`}
        data-disabled={disabled || undefined}
        role="presentation"
      >
        <HugeiconsIcon icon={icon} size={18} />
        <span className="whitespace-nowrap leading-tight">{label}</span>
      </span>
      <Tooltip.Content>
        <p>{label}</p>
      </Tooltip.Content>
    </Tooltip>
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

  const pageTotal = draft.pages.length;
  const hasSelection = draft.selectedCount > 0;
  const canDelete = hasSelection && pageTotal - draft.selectedCount >= 1;
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

            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-default-200 bg-[var(--color-background)] px-3 py-2">
              <div className="flex flex-wrap items-center gap-0.5">
                {LEFT_TOOLS.map((tool) => {
                  const disabled = isToolDisabled(tool.id);

                  if (tool.id === "background-color") {
                    return (
                      <ColorPicker
                        key={tool.id}
                        onChange={(color) =>
                          draft.setSelectedBackgroundColor(
                            color.toString("hex"),
                          )
                        }
                      >
                        <ColorPicker.Trigger
                          aria-label="Page background color"
                          isDisabled={disabled}
                        >
                          <ManagePagesToolbarButtonContent
                            ariaLabel="Page background color"
                            disabled={disabled}
                            icon={tool.icon}
                            label={tool.label}
                          />
                        </ColorPicker.Trigger>
                        <ColorPicker.Popover>
                          <ColorArea
                            aria-label="Page background color"
                            className="max-w-full"
                            colorSpace="hsb"
                            xChannel="saturation"
                            yChannel="brightness"
                          >
                            <ColorArea.Thumb />
                          </ColorArea>
                          <ColorSlider
                            channel="hue"
                            className="gap-1 px-1"
                            colorSpace="hsb"
                          >
                            <ColorSlider.Track>
                              <ColorSlider.Thumb />
                            </ColorSlider.Track>
                          </ColorSlider>
                        </ColorPicker.Popover>
                      </ColorPicker>
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
              </div>

              <div className="flex flex-wrap items-center gap-0.5">
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
              <div className="flex flex-col gap-2">
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
