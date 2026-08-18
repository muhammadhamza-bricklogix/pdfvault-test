"use client";

import type { Canvas, IText } from "fabric";

import {
  Cancel01Icon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  TextBoldIcon,
  TextItalicIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ColorArea,
  ColorPicker,
  ColorSlider,
  Label,
  ListBox,
  Select,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import { useEffect, useRef, useState } from "react";

import { useIsMobile } from "@/lib/client/hooks/use-is-mobile";

type TextAlign = "left" | "center" | "right";

type TextStyle = {
  color: string;
  fontFamily: string;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  textAlign: TextAlign;
};

type FloatingTextToolbarProps = {
  canvasContainerRef: React.RefObject<HTMLDivElement | null>;
  fabricCanvas: Canvas | null;
};

const FONT_FAMILIES = [
  "Helvetica",
  "Times New Roman",
  "Courier New",
  "Georgia",
  "Verdana",
  "Arial",
  "Trebuchet MS",
];

// Standard font-size presets. Extracted text can have arbitrary sizes
// (e.g. 11.3, 13.7) — the current value is spliced into the list if
// missing so the Select shows the true current size.
const FONT_SIZE_PRESETS = [
  8, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72, 96,
];

// 10-swatch palette + free-form ColorPicker for anything else. Grid is
// 5 across × 2 tall — matches the visual weight of the other rows in
// the panel and keeps the panel narrow.
const COLOR_SWATCHES: readonly string[] = [
  "#000000",
  "#FFFFFF",
  "#EF4444",
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#6B7280",
  "#7C2D12",
] as const;

function normaliseTextAlign(value: string | undefined): TextAlign {
  if (value === "center" || value === "right") return value;

  return "left";
}

function getTextStyle(obj: IText): TextStyle {
  return {
    color: (obj.fill as string) ?? "#000000",
    fontFamily: obj.fontFamily ?? "Helvetica",
    fontSize: obj.fontSize ?? 16,
    isBold: obj.fontWeight === "bold",
    isItalic: obj.fontStyle === "italic",
    textAlign: normaliseTextAlign(obj.textAlign),
  };
}

export function FloatingTextToolbar({
  fabricCanvas,
}: FloatingTextToolbarProps) {
  const isMobile = useIsMobile();
  const [visible, setVisible] = useState(false);
  const [style, setStyle] = useState<TextStyle>({
    color: "#000000",
    fontFamily: "Helvetica",
    fontSize: 16,
    isBold: false,
    isItalic: false,
    textAlign: "left",
  });

  const activeObjRef = useRef<IText | null>(null);

  useEffect(() => {
    if (!fabricCanvas) return;

    const showToolbar = () => {
      const obj = fabricCanvas.getActiveObject();

      // Fabric's Textbox reports type "textbox"; IText reports "i-text";
      // extracted source text (created by useEditTextMode) is Textbox.
      // Match both so the panel opens for annotations, signatures, page
      // numbers, and extracted text.
      const isTextTarget =
        !!obj && (obj.type === "i-text" || obj.type === "textbox");

      if (!isTextTarget) {
        setVisible(false);
        activeObjRef.current = null;

        return;
      }

      const textObj = obj as IText;

      activeObjRef.current = textObj;
      setStyle(getTextStyle(textObj));
      setVisible(true);
    };

    const hideToolbar = () => {
      setVisible(false);
      activeObjRef.current = null;
    };

    fabricCanvas.on("selection:created", showToolbar);
    fabricCanvas.on("selection:updated", showToolbar);
    fabricCanvas.on("selection:cleared", hideToolbar);

    return () => {
      fabricCanvas.off("selection:created", showToolbar);
      fabricCanvas.off("selection:updated", showToolbar);
      fabricCanvas.off("selection:cleared", hideToolbar);
    };
  }, [fabricCanvas]);

  const applyStyle = (patch: Partial<TextStyle>) => {
    const obj = activeObjRef.current;

    if (!obj || !fabricCanvas) return;

    const next = { ...style, ...patch };

    setStyle(next);

    const fabricPatch: Record<string, unknown> = {
      fill: next.color,
      fontFamily: next.fontFamily,
      fontSize: next.fontSize,
      fontStyle: next.isItalic ? "italic" : "normal",
      fontWeight: next.isBold ? "bold" : "normal",
      textAlign: next.textAlign,
    };

    // IText supports per-character styles which silently override
    // object-level set() — apply to selection range when actively editing,
    // and clear stale per-char fills/fonts otherwise so the change sticks.
    const iText = obj as IText & {
      isEditing?: boolean;
      selectionEnd?: number;
      selectionStart?: number;
      setSelectionStyles?: (styles: Record<string, unknown>) => void;
      styles?: Record<string, Record<string, Record<string, unknown>>>;
    };
    const hasRangeSelection =
      iText.isEditing === true &&
      typeof iText.selectionStart === "number" &&
      typeof iText.selectionEnd === "number" &&
      iText.selectionStart !== iText.selectionEnd &&
      typeof iText.setSelectionStyles === "function";

    if (hasRangeSelection) {
      // Per-character props (fill / fontFamily / fontSize / fontStyle /
      // fontWeight) only. textAlign is a paragraph-level prop, so apply
      // it on the object regardless.
      const { textAlign: _textAlign, ...perChar } = fabricPatch;

      iText.setSelectionStyles!(perChar);
      obj.set({ textAlign: next.textAlign });
    } else {
      obj.set(fabricPatch);

      // Strip any per-character entries for the keys we just changed.
      if (iText.styles) {
        const keys = Object.keys(fabricPatch);

        for (const line of Object.values(iText.styles)) {
          for (const charStyle of Object.values(line)) {
            const css = charStyle as Record<string, unknown>;

            for (const k of keys) {
              delete css[k];
            }
          }
        }
      }
    }

    fabricCanvas.renderAll();
  };

  const close = () => {
    if (!fabricCanvas) return;
    fabricCanvas.discardActiveObject();
    fabricCanvas.requestRenderAll();
  };

  if (!visible) return null;

  const textStyleKeys = new Set<string>();

  if (style.isBold) textStyleKeys.add("bold");
  if (style.isItalic) textStyleKeys.add("italic");

  // Font-size preset list, with the current value spliced in front when
  // it isn't a preset (pdf.js often extracts sizes like 11.3 or 13.7).
  const currentSize = Math.round(style.fontSize * 10) / 10;
  const sizeItems = FONT_SIZE_PRESETS.some(
    (s) => Math.round(s * 10) === Math.round(currentSize * 10),
  )
    ? FONT_SIZE_PRESETS
    : [currentSize, ...FONT_SIZE_PRESETS];
  const selectedSizeKey = String(currentSize);

  return (
    <aside
      aria-label="Text formatting"
      className={
        isMobile
          ? "pointer-events-auto fixed inset-x-0 bottom-[72px] z-50 flex flex-col gap-3 border-t border-default-200 bg-white p-4 shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.15)]"
          : "pointer-events-auto fixed right-4 top-1/2 z-50 flex w-[188px] -translate-y-1/2 flex-col gap-4 rounded-2xl border border-default-200 bg-white p-4 shadow-[0_8px_24px_rgba(16,24,40,0.08)]"
      }
      role="region"
    >
      {/* Close button */}
      <button
        aria-label="Close text formatting"
        className="absolute right-3 top-3 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-default-400 transition-colors hover:bg-default-100 hover:text-default-700"
        type="button"
        onClick={close}
      >
        <HugeiconsIcon icon={Cancel01Icon} size={16} />
      </button>
      {/* On mobile: horizontal scrollable row; on desktop: vertical column */}
      <div className={isMobile ? "flex items-start gap-4 overflow-x-auto pr-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "flex flex-col gap-4"}>

      {/* Font family */}
      <div className="flex shrink-0 flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-default-500">
          Font
        </span>
        <Select
          aria-label="Font family"
          className="w-full"
          selectedKey={style.fontFamily}
          onSelectionChange={(key) => applyStyle({ fontFamily: String(key) })}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {FONT_FAMILIES.map((f) => (
                <ListBox.Item key={f} id={f} textValue={f}>
                  {f}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      {/* Font size */}
      <div className="flex shrink-0 flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-default-500">
          Size
        </span>
        <Select
          aria-label="Font size"
          className="w-full"
          selectedKey={selectedSizeKey}
          onSelectionChange={(key) => {
            const next = Number(key);

            if (!Number.isFinite(next) || next <= 0) return;
            applyStyle({ fontSize: next });
          }}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {sizeItems.map((s) => {
                const key = String(s);

                return (
                  <ListBox.Item key={key} id={key} textValue={key}>
                    {s}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                );
              })}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      {/* Bold + Italic */}
      <div className="flex shrink-0 flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-default-500">
          Style
        </span>
        <ToggleButtonGroup
          aria-label="Text style"
          selectedKeys={textStyleKeys}
          selectionMode="multiple"
          size="sm"
          onSelectionChange={(keys) => {
            const set = keys as Set<string>;

            applyStyle({
              isBold: set.has("bold"),
              isItalic: set.has("italic"),
            });
          }}
        >
          <ToggleButton isIconOnly aria-label="Bold" id="bold">
            <HugeiconsIcon icon={TextBoldIcon} size={16} />
          </ToggleButton>
          <ToggleButton isIconOnly aria-label="Italic" id="italic">
            <HugeiconsIcon icon={TextItalicIcon} size={16} />
          </ToggleButton>
        </ToggleButtonGroup>
      </div>

      {/* Alignment */}
      <div className="flex shrink-0 flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-default-500">
          Alignment
        </span>
        <ToggleButtonGroup
          aria-label="Text alignment"
          selectedKeys={new Set([style.textAlign])}
          selectionMode="single"
          size="sm"
          onSelectionChange={(keys) => {
            const set = keys as Set<string>;
            const next = set.values().next().value;

            if (next === "left" || next === "center" || next === "right") {
              applyStyle({ textAlign: next });
            }
          }}
        >
          <ToggleButton isIconOnly aria-label="Align left" id="left">
            <HugeiconsIcon icon={TextAlignLeftIcon} size={16} />
          </ToggleButton>
          <ToggleButton isIconOnly aria-label="Align center" id="center">
            <HugeiconsIcon icon={TextAlignCenterIcon} size={16} />
          </ToggleButton>
          <ToggleButton isIconOnly aria-label="Align right" id="right">
            <HugeiconsIcon icon={TextAlignRightIcon} size={16} />
          </ToggleButton>
        </ToggleButtonGroup>
      </div>

      {/* Color palette + custom picker */}
      <div className="flex shrink-0 flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-default-500">
          Color
        </span>
        <div className="grid grid-cols-5 gap-1.5">
          {COLOR_SWATCHES.map((hex) => {
            const isActive = style.color.toLowerCase() === hex.toLowerCase();

            return (
              <button
                key={hex}
                aria-label={`Set color ${hex}`}
                aria-pressed={isActive}
                className={`h-7 w-7 cursor-pointer rounded-md border transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  isActive
                    ? "border-primary shadow-[0_0_0_2px_var(--heroui-primary-200)]"
                    : "border-default-200"
                }`}
                style={{ backgroundColor: hex }}
                type="button"
                onClick={() => applyStyle({ color: hex })}
              />
            );
          })}
          <ColorPicker
            value={style.color}
            onChange={(color) => applyStyle({ color: color.toString("hex") })}
          >
            <ColorPicker.Trigger>
              <button
                aria-label="More colors"
                className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-md border border-default-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                style={{
                  background:
                    "conic-gradient(from 0deg, #ef4444, #f59e0b, #10b981, #3b82f6, #8b5cf6, #ec4899, #ef4444)",
                }}
                type="button"
              />
              <Label className="sr-only">More colors</Label>
            </ColorPicker.Trigger>
            <ColorPicker.Popover>
              <ColorArea
                aria-label="Color area"
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
    </aside>
  );
}
