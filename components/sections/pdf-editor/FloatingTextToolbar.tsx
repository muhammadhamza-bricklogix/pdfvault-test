"use client";

import type { Canvas, IText } from "fabric";

import {
  TextBoldIcon,
  TextItalicIcon,
  TextUnderlineIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
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
} from "@heroui/react";
import { useEffect, useRef, useState } from "react";

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
  "Arial",
  "Times New Roman",
  "Courier New",
  "Georgia",
  "Verdana",
];

function getTextStyle(obj: IText): TextStyle {
  return {
    color: (obj.fill as string) ?? "#000000",
    fontFamily: obj.fontFamily ?? "Arial",
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
  const [style, setStyle] = useState<TextStyle>({
    color: "#000000",
    fontFamily: "Arial",
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

      setPosition({
        left: offsetX + bound.left,
        top: offsetY + bound.top - 48, // 48px above the object
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

  const applyStyle = (patch: Partial<TextStyle>) => {
    const obj = activeObjRef.current;

    if (!obj || !fabricCanvas) return;

    const next = { ...style, ...patch };

    setStyle(next);

    obj.set({
      fill: next.color,
      fontFamily: next.fontFamily,
      fontSize: next.fontSize,
      fontStyle: next.isItalic ? "italic" : "normal",
      fontWeight: next.isBold ? "bold" : "normal",
      underline: next.isUnderline,
    });
    fabricCanvas.renderAll();
  };

  if (!visible) return null;

  const textStyleKeys = new Set<string>();

  if (style.isBold) textStyleKeys.add("bold");
  if (style.isItalic) textStyleKeys.add("italic");
  if (style.isUnderline) textStyleKeys.add("underline");

  return (
    <div
      className="pointer-events-auto absolute z-50"
      style={{ left: position.left, top: Math.max(0, position.top) }}
    >
      <Toolbar isAttached aria-label="Text formatting">
        {/* Font family */}
        <Select
          aria-label="Font family"
          className="w-36"
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
          className="w-14 rounded border border-[var(--app-border)] bg-transparent px-2 py-1 text-sm"
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
            <HugeiconsIcon icon={TextBoldIcon} size={16} />
          </ToggleButton>
          <ToggleButton isIconOnly aria-label="Italic" id="italic">
            <ToggleButtonGroup.Separator />
            <HugeiconsIcon icon={TextItalicIcon} size={16} />
          </ToggleButton>
          <ToggleButton isIconOnly aria-label="Underline" id="underline">
            <ToggleButtonGroup.Separator />
            <HugeiconsIcon icon={TextUnderlineIcon} size={16} />
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
      </Toolbar>
    </div>
  );
}
