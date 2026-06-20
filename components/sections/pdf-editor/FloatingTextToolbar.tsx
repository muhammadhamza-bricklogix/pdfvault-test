"use client";

import type { Canvas, IText } from "fabric";

import {
  Delete02Icon,
  TextBoldIcon,
  TextItalicIcon,
  TextUnderlineIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Button,
  ColorArea,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  Label,
  ListBox,
  Select,
  Separator,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
} from "@heroui/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const TOOLBAR_GAP = 12;

type TextStyle = {
  color: string;
  fontFamily: string;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
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
];

function getTextStyle(obj: IText): TextStyle {
  return {
    color: (obj.fill as string) ?? "#000000",
    fontFamily: obj.fontFamily ?? "Helvetica",
    fontSize: obj.fontSize ?? 16,
    isBold: obj.fontWeight === "bold",
    isItalic: obj.fontStyle === "italic",
    isUnderline: !!obj.underline,
  };
}

export function FloatingTextToolbar({
  canvasContainerRef,
  fabricCanvas,
}: FloatingTextToolbarProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [anchor, setAnchor] = useState({
    boundBottom: 0,
    boundTop: 0,
    left: 0,
  });
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<TextStyle>({
    color: "#000000",
    fontFamily: "Helvetica",
    fontSize: 16,
    isBold: false,
    isItalic: false,
    isUnderline: false,
  });

  const activeObjRef = useRef<IText | null>(null);

  useEffect(() => {
    if (!fabricCanvas) return;

    const showToolbar = () => {
      const obj = fabricCanvas.getActiveObject();

      if (!obj || obj.type !== "i-text") {
        setVisible(false);
        activeObjRef.current = null;

        return;
      }

      const textObj = obj as IText;

      activeObjRef.current = textObj;
      setStyle(getTextStyle(textObj));

      // Position above the object's bounding rect
      const bound = textObj.getBoundingRect();
      const container = canvasContainerRef.current;
      const containerRect = container?.getBoundingClientRect();
      const canvasRect = fabricCanvas
        .getElement()
        .parentElement?.getBoundingClientRect();

      const offsetX = canvasRect
        ? canvasRect.left - (containerRect?.left ?? 0)
        : 0;
      const offsetY = canvasRect
        ? canvasRect.top - (containerRect?.top ?? 0)
        : 0;

      setAnchor({
        boundBottom: offsetY + bound.top + bound.height,
        boundTop: offsetY + bound.top,
        left: offsetX + bound.left,
      });
      setVisible(true);
    };

    const hideToolbar = () => {
      setVisible(false);
      activeObjRef.current = null;
    };

    fabricCanvas.on("selection:created", showToolbar);
    fabricCanvas.on("selection:updated", showToolbar);
    fabricCanvas.on("selection:cleared", hideToolbar);
    fabricCanvas.on("object:moving", showToolbar);

    return () => {
      fabricCanvas.off("selection:created", showToolbar);
      fabricCanvas.off("selection:updated", showToolbar);
      fabricCanvas.off("selection:cleared", hideToolbar);
      fabricCanvas.off("object:moving", showToolbar);
    };
  }, [canvasContainerRef, fabricCanvas]);

  useLayoutEffect(() => {
    if (!visible) return;
    const el = toolbarRef.current;

    if (!el) return;

    const height = el.offsetHeight || 36;
    const aboveTop = anchor.boundTop - height - TOOLBAR_GAP;
    const top = aboveTop >= 0 ? aboveTop : anchor.boundBottom + TOOLBAR_GAP;

    setPosition({ left: anchor.left, top });
  }, [anchor, visible]);

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
      underline: next.isUnderline,
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
      iText.setSelectionStyles!(fabricPatch);
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

  if (!visible) return null;

  const textStyleKeys = new Set<string>();

  if (style.isBold) textStyleKeys.add("bold");
  if (style.isItalic) textStyleKeys.add("italic");
  if (style.isUnderline) textStyleKeys.add("underline");

  return (
    <div
      ref={toolbarRef}
      className="pointer-events-auto absolute z-50"
      style={{ left: position.left, top: Math.max(0, position.top) }}
    >
      <Toolbar isAttached aria-label="Text formatting" className="py-0.5">
        {/* Font family */}
        <Select
          aria-label="Font family"
          className="w-32"
          selectedKey={style.fontFamily}
          onSelectionChange={(key) => applyStyle({ fontFamily: key as string })}
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

        <Separator />

        {/* Font size */}
        <input
          aria-label="Font size"
          className="h-7 w-12 rounded border border-default-200 bg-transparent px-1.5 text-xs"
          max={200}
          min={6}
          type="number"
          value={style.fontSize}
          onChange={(e) => applyStyle({ fontSize: Number(e.target.value) })}
        />

        <Separator />

        {/* Bold / Italic / Underline */}
        <ToggleButtonGroup
          selectedKeys={textStyleKeys}
          selectionMode="multiple"
          size="sm"
          onSelectionChange={(keys) => {
            applyStyle({
              isBold: (keys as Set<string>).has("bold"),
              isItalic: (keys as Set<string>).has("italic"),
              isUnderline: (keys as Set<string>).has("underline"),
            });
          }}
        >
          <ToggleButton isIconOnly aria-label="Bold" id="bold">
            <HugeiconsIcon icon={TextBoldIcon} size={14} />
          </ToggleButton>
          <ToggleButton isIconOnly aria-label="Italic" id="italic">
            <ToggleButtonGroup.Separator />
            <HugeiconsIcon icon={TextItalicIcon} size={14} />
          </ToggleButton>
          <ToggleButton isIconOnly aria-label="Underline" id="underline">
            <ToggleButtonGroup.Separator />
            <HugeiconsIcon icon={TextUnderlineIcon} size={14} />
          </ToggleButton>
        </ToggleButtonGroup>

        <Separator />

        {/* Text color */}
        <ColorPicker
          value={style.color}
          onChange={(color) => applyStyle({ color: color.toString("hex") })}
        >
          <ColorPicker.Trigger>
            <ColorSwatch size="sm" />
            <Label className="sr-only">Text color</Label>
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
            <ColorSlider channel="hue" className="gap-1 px-1" colorSpace="hsb">
              <ColorSlider.Track>
                <ColorSlider.Thumb />
              </ColorSlider.Track>
            </ColorSlider>
          </ColorPicker.Popover>
        </ColorPicker>

        <Separator />

        {/* Delete the currently-selected IText (annotation, signature
            stamp, user-added text, page number, etc.). Keyboard
            Delete/Backspace also works via PdfViewerCanvas, but a
            visible button is required on mobile where there is no
            keyboard and on desktop for discoverability. Pressing this
            removes the object, clears the active selection so the
            toolbar hides itself, and re-renders the canvas. */}
        <Tooltip>
          <Button
            isIconOnly
            aria-label="Delete"
            className="text-danger"
            size="sm"
            variant="ghost"
            onPress={() => {
              const fc = fabricCanvas;
              const obj = activeObjRef.current;

              if (!fc || !obj) return;
              fc.remove(obj);
              fc.discardActiveObject();
              fc.requestRenderAll();
            }}
          >
            <HugeiconsIcon icon={Delete02Icon} size={14} />
          </Button>
          <Tooltip.Content>
            <p>Delete</p>
          </Tooltip.Content>
        </Tooltip>
      </Toolbar>
    </div>
  );
}
