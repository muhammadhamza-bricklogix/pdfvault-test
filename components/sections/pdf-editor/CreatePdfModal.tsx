"use client";

import type { Canvas as FabricCanvas } from "fabric";

import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Link01Icon,
  Unlink01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Button,
  ColorArea,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  Input,
  Label,
  Modal,
  NumberField,
  TextField,
  Tooltip,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DuplicateUploadModal } from "@/components/sections/dashboard/duplicate-upload-modal";
import { useUploadWithDuplicateCheck } from "@/lib/client/hooks/upload/use-upload-with-duplicate-check";
import { persistEditorDocument } from "@/lib/client/pdf-editor/persist-editor-document";
import { usePdfEditorStore } from "@/lib/client/stores";
import { ROUTES } from "@/lib/shared/constants/routes";
import { toast } from "@/lib/shared/utils/toast";

// ─── Types ───────────────────────────────────────────────────────────────────

type Unit = "cm" | "in" | "mm" | "pt";

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_PRESETS = [
  { heightPt: 792, id: "letter", label: "US Letter", widthPt: 612 },
  { heightPt: 1008, id: "legal", label: "US Legal", widthPt: 612 },
  { heightPt: 595, id: "a5", label: "A5", widthPt: 420 },
  { heightPt: 842, id: "a4", label: "A4", widthPt: 595 },
  { heightPt: 1191, id: "a3", label: "A3", widthPt: 842 },
  { heightPt: 1684, id: "a2", label: "A2", widthPt: 1191 },
  { heightPt: 2384, id: "a1", label: "A1", widthPt: 1684 },
  { heightPt: 3370, id: "a0", label: "A0", widthPt: 2384 },
] as const;

const PAGE_COLOR_SWATCHES = [
  { color: "#FFFFFF", label: "White" },
  { color: "#FFFDE7", label: "Cream" },
  { color: "#F3F4F6", label: "Light Gray" },
  { color: "#1F2937", label: "Dark" },
] as const;

const UNIT_STEP: Record<Unit, number> = { cm: 0.01, in: 0.01, mm: 0.1, pt: 1 };
const UNIT_PRECISION: Record<Unit, number> = { cm: 2, in: 2, mm: 1, pt: 0 };
const THUMB_MAX = 64;
const PAGE_COUNT_MAX = 50;

// ─── Conversion helpers ───────────────────────────────────────────────────────

function toPt(value: number, unit: Unit): number {
  switch (unit) {
    case "cm":
      return Math.round((value * 72) / 2.54);
    case "in":
      return Math.round(value * 72);
    case "mm":
      return Math.round((value * 72) / 25.4);
    case "pt":
      return Math.round(value);
  }
}

function fromPt(pt: number, unit: Unit): number {
  switch (unit) {
    case "cm": {
      const p = UNIT_PRECISION.cm;

      return Math.round(((pt * 2.54) / 72) * 10 ** p) / 10 ** p;
    }
    case "in": {
      const p = UNIT_PRECISION.in;

      return Math.round((pt / 72) * 10 ** p) / 10 ** p;
    }
    case "mm": {
      const p = UNIT_PRECISION.mm;

      return Math.round(((pt * 25.4) / 72) * 10 ** p) / 10 ** p;
    }
    case "pt":
      return pt;
  }
}

function formatDims(widthPt: number, heightPt: number, unit: Unit): string {
  const p = UNIT_PRECISION[unit];

  return `${fromPt(widthPt, unit).toFixed(p)} × ${fromPt(heightPt, unit).toFixed(p)} ${unit}`;
}

// ─── General helpers ─────────────────────────────────────────────────────────

function hexToRgb(hex: string): { b: number; g: number; r: number } {
  const c = hex.replace("#", "");

  return {
    b: parseInt(c.substring(4, 6), 16),
    g: parseInt(c.substring(2, 4), 16),
    r: parseInt(c.substring(0, 2), 16),
  };
}

function thumbSize(widthPt: number, heightPt: number) {
  const maxSide = Math.max(widthPt, heightPt);
  const scale = THUMB_MAX / maxSide;

  return {
    h: Math.max(2, Math.round(heightPt * scale)),
    w: Math.max(2, Math.round(widthPt * scale)),
  };
}

// ─── Form state ──────────────────────────────────────────────────────────────

type FormState = {
  documentName: string;
  heightPt: number;
  pageColor: string;
  pageCount: number;
  proportionsLocked: boolean;
  selectedPresetId: string | null;
  unit: Unit;
  widthPt: number;
};

function buildDefault(count: number): FormState {
  return {
    documentName: `Untitled-${count}`,
    heightPt: 792,
    pageColor: "#FFFFFF",
    pageCount: 1,
    proportionsLocked: false,
    selectedPresetId: "letter",
    unit: "in",
    widthPt: 612,
  };
}

// Module-level counter so names auto-increment across modal opens.
let openCount = 0;

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-semibold text-[var(--color-foreground)]">
      {children}
    </p>
  );
}

function PageColorSwatch({
  color,
  isSelected,
  label,
  onPress,
}: {
  color: string;
  isSelected: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Tooltip delay={300}>
      <button
        aria-label={label}
        aria-pressed={isSelected}
        className={`rounded-sm transition ${
          isSelected
            ? "ring-2 ring-[var(--color-accent)] ring-offset-2 ring-offset-default-100"
            : ""
        }`}
        type="button"
        onClick={onPress}
      >
        <ColorSwatch
          aria-label={label}
          color={color}
          colorName={label}
          shape="square"
          size="sm"
        />
      </button>
      <Tooltip.Content>
        <p>{label}</p>
      </Tooltip.Content>
    </Tooltip>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  fabricCanvas?: FabricCanvas | null;
  isOpen: boolean;
  onClose: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function CreatePdfModal({ fabricCanvas, isOpen, onClose }: Props) {
  const clearFile = usePdfEditorStore((s) => s.clearFile);
  const clearDocumentDirty = usePdfEditorStore((s) => s.clearDocumentDirty);
  const isSignedIn = usePdfEditorStore((s) => s.isSignedIn);
  const setCurrentDocument = usePdfEditorStore((s) => s.setCurrentDocument);
  const setFileInStore = usePdfEditorStore((s) => s.setFile);
  const router = useRouter();
  const { duplicate, start } = useUploadWithDuplicateCheck();

  const [form, setForm] = useState<FormState>(() => buildDefault(++openCount));
  const [isGenerating, setIsGenerating] = useState(false);
  const [unsavedPromptOpen, setUnsavedPromptOpen] = useState(false);
  const [unsavedAction, setUnsavedAction] = useState<
    null | "saving" | "discarding"
  >(null);

  // ── Derived values ────────────────────────────────────────────────────────

  const {
    documentName,
    heightPt,
    pageColor,
    pageCount,
    proportionsLocked,
    selectedPresetId,
    unit,
    widthPt,
  } = form;

  const orientation: "landscape" | "portrait" =
    widthPt <= heightPt ? "portrait" : "landscape";

  const displayW = fromPt(widthPt, unit);
  const displayH = fromPt(heightPt, unit);
  const step = UNIT_STEP[unit];
  const fractionDigits = UNIT_PRECISION[unit];
  const formatOptions: Intl.NumberFormatOptions = {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  };

  const patch = (updates: Partial<FormState>) =>
    setForm((prev) => ({ ...prev, ...updates }));

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handlePresetSelect = (preset: (typeof PAGE_PRESETS)[number]) => {
    // Preserve the current orientation when switching presets.
    if (orientation === "landscape") {
      patch({
        heightPt: preset.widthPt,
        selectedPresetId: preset.id,
        widthPt: preset.heightPt,
      });
    } else {
      patch({
        heightPt: preset.heightPt,
        selectedPresetId: preset.id,
        widthPt: preset.widthPt,
      });
    }
  };

  const handleOrientationChange = (next: "landscape" | "portrait") => {
    if (next !== orientation) {
      patch({ heightPt: widthPt, widthPt: heightPt });
    }
  };

  const handleWidthChange = (displayVal: number) => {
    if (!Number.isFinite(displayVal) || displayVal <= 0) return;

    const newW = toPt(displayVal, unit);
    const updates: Partial<FormState> = {
      selectedPresetId: null,
      widthPt: newW,
    };

    if (proportionsLocked && widthPt > 0) {
      updates.heightPt = Math.max(1, Math.round(newW * (heightPt / widthPt)));
    }

    patch(updates);
  };

  const handleHeightChange = (displayVal: number) => {
    if (!Number.isFinite(displayVal) || displayVal <= 0) return;

    const newH = toPt(displayVal, unit);
    const updates: Partial<FormState> = {
      heightPt: newH,
      selectedPresetId: null,
    };

    if (proportionsLocked && heightPt > 0) {
      updates.widthPt = Math.max(1, Math.round(newH * (widthPt / heightPt)));
    }

    patch(updates);
  };

  const generateNewDocument = async () => {
    const trimmed = documentName.trim() || `Untitled-${openCount}`;
    const fileName = trimmed.endsWith(".pdf") ? trimmed : `${trimmed}.pdf`;
    const clampedPages = Math.min(Math.max(1, pageCount), PAGE_COUNT_MAX);

    setIsGenerating(true);

    try {
      const { PDFDocument, rgb } = await import("pdf-lib");
      const pdfDoc = await PDFDocument.create();

      for (let i = 0; i < clampedPages; i++) {
        const page = pdfDoc.addPage([widthPt, heightPt]);

        if (pageColor !== "#FFFFFF") {
          const { b, g, r } = hexToRgb(pageColor);

          page.drawRectangle({
            borderWidth: 0,
            color: rgb(r / 255, g / 255, b / 255),
            height: heightPt,
            width: widthPt,
            x: 0,
            y: 0,
          });
        }
      }

      const bytes = await pdfDoc.save();
      const file = new File([bytes.buffer as ArrayBuffer], fileName, {
        type: "application/pdf",
      });

      // Mark this as a freshly created blank PDF so the text-edit hook can
      // skip the "No editable text found" notice — a blank doc trivially has
      // no text, and the toast just reads as noise on the Create-New flow.
      (file as File & { __createdBlank?: boolean }).__createdBlank = true;

      // Replace the editor immediately with the new blank doc, regardless of
      // sign-in state. Strip any `?id=…` first so the document loader doesn't
      // re-fetch the previously opened cloud doc once `clearFile` runs.
      router.replace(ROUTES.TOOLS.PDF_EDITOR, { scroll: false });
      clearFile();
      onClose();
      setTimeout(() => setFileInStore(file), 0);

      if (isSignedIn) {
        // Upload to the cloud in the background. When the new id is known,
        // associate it with the already-loaded file and sync the URL — the
        // loader skips re-fetching because the file+currentDocumentId match.
        void start({
          file,
          onOpen: (id) => {
            setCurrentDocument({ id, name: fileName });
            router.replace(`${ROUTES.TOOLS.PDF_EDITOR}?id=${id}`, {
              scroll: false,
            });
          },
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreate = async () => {
    // Gate creation on unsaved edits in the current document. Switching to a
    // blank PDF mid-edit would silently drop those changes.
    const hasUnsaved = usePdfEditorStore.getState().hasUnsavedChanges;

    if (hasUnsaved) {
      setUnsavedPromptOpen(true);

      return;
    }

    await generateNewDocument();
  };

  const handleSaveAndCreate = async () => {
    if (unsavedAction) return;
    setUnsavedAction("saving");

    const loadingKey = toast.loading({
      title: "Saving…",
      description: "Saving your current PDF before creating a new one.",
    });

    try {
      const result = await persistEditorDocument({ fabricCanvas });

      if (!result.ok && result.reason === "error") {
        toast.error({
          title: "Could not save",
          description:
            "We couldn't save your current PDF. Try again or choose Discard.",
        });

        return;
      }

      setUnsavedPromptOpen(false);
      await generateNewDocument();
    } finally {
      toast.close(loadingKey);
      setUnsavedAction(null);
    }
  };

  const handleDiscardAndCreate = async () => {
    if (unsavedAction) return;
    setUnsavedAction("discarding");

    try {
      clearDocumentDirty();
      setUnsavedPromptOpen(false);
      await generateNewDocument();
    } finally {
      setUnsavedAction(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <Modal.Container>
          <Modal.Dialog className="!w-[92vw] !max-w-[780px]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Create new PDF document</Modal.Heading>
            </Modal.Header>

            <Modal.Body className="overflow-hidden p-0">
              <div className="flex max-h-[min(520px,calc(85vh-12rem))] flex-col md:flex-row">
                {/* ── Left: preset grid ──────────────────────────────────── */}
                <div className="flex shrink-0 flex-col gap-3 overflow-y-auto p-5 md:w-[42%]">
                  <SectionHeading>Select page size</SectionHeading>

                  <div className="grid grid-cols-2 gap-3 pb-1">
                    {PAGE_PRESETS.map((preset) => {
                      const { h, w } = thumbSize(
                        preset.widthPt,
                        preset.heightPt,
                      );
                      const isSelected = selectedPresetId === preset.id;

                      return (
                        <button
                          key={preset.id}
                          aria-pressed={isSelected}
                          className={[
                            "flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition",
                            "hover:bg-default-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                            isSelected
                              ? "border-accent bg-accent/5 ring-2 ring-accent"
                              : "border-default-200",
                          ].join(" ")}
                          type="button"
                          onClick={() => handlePresetSelect(preset)}
                        >
                          {/* Proportional page thumbnail */}
                          <div
                            className="flex items-center justify-center"
                            style={{ height: THUMB_MAX, width: THUMB_MAX }}
                          >
                            <div
                              className="rounded-sm border border-default-300 bg-background shadow-sm"
                              style={{ height: h, width: w }}
                            />
                          </div>

                          <div>
                            <p className="text-sm font-medium leading-tight text-[var(--color-foreground)]">
                              {preset.label}
                            </p>
                            <p className="mt-0.5 text-xs text-default-500">
                              {formatDims(
                                preset.widthPt,
                                preset.heightPt,
                                unit,
                              )}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── Divider ────────────────────────────────────────────── */}
                <div className="hidden shrink-0 bg-default-200/70 md:block md:w-px" />

                {/* ── Right: options ─────────────────────────────────────── */}
                <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
                  {/* Document Name */}
                  <div className="space-y-1.5">
                    <SectionHeading>Document name</SectionHeading>
                    <TextField
                      value={documentName}
                      onChange={(v) => patch({ documentName: v })}
                    >
                      <Input placeholder="Untitled" />
                    </TextField>
                  </div>

                  {/* Customize size */}
                  <div className="space-y-3">
                    <SectionHeading>Customize size</SectionHeading>

                    {/* Unit selector */}
                    <div className="space-y-1.5">
                      <p className="text-xs text-default-500">Measurements</p>
                      <div className="flex gap-1">
                        {(["pt", "in", "mm", "cm"] as const).map((u) => (
                          <Button
                            key={u}
                            aria-pressed={unit === u}
                            size="sm"
                            variant={unit === u ? "secondary" : "ghost"}
                            onPress={() => patch({ unit: u })}
                          >
                            {u}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Width / Height with proportions lock */}
                    <div className="space-y-1.5">
                      <p className="text-xs text-default-500">Dimensions</p>
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <NumberField
                            aria-label="Width"
                            formatOptions={formatOptions}
                            minValue={step}
                            step={step}
                            value={displayW}
                            onChange={handleWidthChange}
                          >
                            <Label className="text-xs text-default-500">
                              Width
                            </Label>
                            <NumberField.Group>
                              <NumberField.DecrementButton>
                                <HugeiconsIcon
                                  icon={ArrowDown01Icon}
                                  size={14}
                                />
                              </NumberField.DecrementButton>
                              <NumberField.Input />
                              <NumberField.IncrementButton>
                                <HugeiconsIcon icon={ArrowUp01Icon} size={14} />
                              </NumberField.IncrementButton>
                            </NumberField.Group>
                          </NumberField>
                        </div>

                        <Tooltip delay={300}>
                          <Button
                            isIconOnly
                            aria-label={
                              proportionsLocked
                                ? "Unlock proportions"
                                : "Lock proportions"
                            }
                            aria-pressed={proportionsLocked}
                            className="mb-0.5 shrink-0"
                            size="sm"
                            variant={proportionsLocked ? "secondary" : "ghost"}
                            onPress={() =>
                              patch({ proportionsLocked: !proportionsLocked })
                            }
                          >
                            <HugeiconsIcon
                              icon={
                                proportionsLocked ? Link01Icon : Unlink01Icon
                              }
                              size={14}
                            />
                          </Button>
                          <Tooltip.Content>
                            <p>
                              {proportionsLocked
                                ? "Unlock proportions"
                                : "Lock proportions"}
                            </p>
                          </Tooltip.Content>
                        </Tooltip>

                        <div className="flex-1">
                          <NumberField
                            aria-label="Height"
                            formatOptions={formatOptions}
                            minValue={step}
                            step={step}
                            value={displayH}
                            onChange={handleHeightChange}
                          >
                            <Label className="text-xs text-default-500">
                              Height
                            </Label>
                            <NumberField.Group>
                              <NumberField.DecrementButton>
                                <HugeiconsIcon
                                  icon={ArrowDown01Icon}
                                  size={14}
                                />
                              </NumberField.DecrementButton>
                              <NumberField.Input />
                              <NumberField.IncrementButton>
                                <HugeiconsIcon icon={ArrowUp01Icon} size={14} />
                              </NumberField.IncrementButton>
                            </NumberField.Group>
                          </NumberField>
                        </div>
                      </div>
                    </div>

                    {/* Orientation */}
                    <div className="space-y-1.5">
                      <p className="text-xs text-default-500">Orientation</p>
                      <div className="flex gap-2">
                        <Button
                          aria-pressed={orientation === "portrait"}
                          size="sm"
                          variant={
                            orientation === "portrait" ? "secondary" : "ghost"
                          }
                          onPress={() => handleOrientationChange("portrait")}
                        >
                          Portrait
                        </Button>
                        <Button
                          aria-pressed={orientation === "landscape"}
                          size="sm"
                          variant={
                            orientation === "landscape" ? "secondary" : "ghost"
                          }
                          onPress={() => handleOrientationChange("landscape")}
                        >
                          Landscape
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Number of pages */}
                  <div className="space-y-1.5">
                    <SectionHeading>Number of pages</SectionHeading>
                    <p className="text-xs text-default-400">
                      Maximum {PAGE_COUNT_MAX} pages
                    </p>
                    <NumberField
                      aria-label="Number of pages"
                      maxValue={PAGE_COUNT_MAX}
                      minValue={1}
                      step={1}
                      value={pageCount}
                      onChange={(v) => {
                        if (Number.isFinite(v)) patch({ pageCount: v });
                      }}
                    >
                      <NumberField.Group className="w-28">
                        <NumberField.DecrementButton>
                          <HugeiconsIcon icon={ArrowDown01Icon} size={14} />
                        </NumberField.DecrementButton>
                        <NumberField.Input />
                        <NumberField.IncrementButton>
                          <HugeiconsIcon icon={ArrowUp01Icon} size={14} />
                        </NumberField.IncrementButton>
                      </NumberField.Group>
                    </NumberField>
                  </div>

                  {/* Page color */}
                  <div className="space-y-2">
                    <SectionHeading>Page color</SectionHeading>
                    <div className="flex flex-wrap items-center gap-2 p-1">
                      {PAGE_COLOR_SWATCHES.map((swatch) => (
                        <PageColorSwatch
                          key={swatch.color}
                          color={swatch.color}
                          isSelected={pageColor === swatch.color}
                          label={swatch.label}
                          onPress={() => patch({ pageColor: swatch.color })}
                        />
                      ))}

                      <ColorPicker
                        value={pageColor}
                        onChange={(color) => {
                          patch({
                            pageColor: color.toString("hex").toUpperCase(),
                          });
                        }}
                      >
                        <ColorPicker.Trigger>
                          <ColorSwatch
                            aria-label="Custom page color"
                            shape="square"
                            size="sm"
                          />
                        </ColorPicker.Trigger>
                        <ColorPicker.Popover>
                          <ColorArea
                            aria-label="Page color picker area"
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
                    </div>
                  </div>
                </div>
              </div>
            </Modal.Body>

            <Modal.Footer>
              <Button slot="close" variant="secondary">
                Cancel
              </Button>
              <Button
                isDisabled={isGenerating}
                onPress={() => void handleCreate()}
              >
                {isGenerating ? "Creating..." : "Create"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>

        <DuplicateUploadModal
          filename={duplicate?.filename ?? null}
          onIgnore={duplicate?.onIgnore ?? (() => undefined)}
          onOverwrite={duplicate?.onOverwrite ?? (() => undefined)}
        />
      </Modal.Backdrop>

      {/*
        Unsaved-changes prompt — kept as a SIBLING of the main backdrop so
        HeroUI doesn't nest two `Modal.Backdrop`s (which silently hides
        the inner one in some stacking contexts). When this opens we
        suppress further Create clicks behind it; closing it returns the
        user to the main Create dialog.
      */}
      <Modal.Backdrop
        isOpen={unsavedPromptOpen}
        onOpenChange={(open) => {
          if (!open && !unsavedAction) setUnsavedPromptOpen(false);
        }}
      >
        <Modal.Container>
          <Modal.Dialog className="!w-[92vw] !max-w-[440px]">
            <Modal.Header>
              <Modal.Heading>Unsaved changes</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className="text-sm text-default-700">
                Your current PDF has unsaved changes. Save them to your library
                before creating a new document, or discard to continue without
                saving.
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button
                isDisabled={unsavedAction !== null}
                variant="ghost"
                onPress={() => setUnsavedPromptOpen(false)}
              >
                Cancel
              </Button>
              <Button
                isDisabled={unsavedAction !== null}
                variant="secondary"
                onPress={() => void handleDiscardAndCreate()}
              >
                {unsavedAction === "discarding" ? "Discarding..." : "Discard"}
              </Button>
              <Button
                isDisabled={unsavedAction !== null || !isSignedIn}
                onPress={() => void handleSaveAndCreate()}
              >
                {unsavedAction === "saving" ? "Saving..." : "Save & Create"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}
