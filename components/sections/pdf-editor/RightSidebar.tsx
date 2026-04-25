"use client";

import type { Canvas as FabricCanvas } from "fabric";

import { useCallback, useEffect, useState } from "react";
import {
  ColorArea,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  Label,
  Separator,
  Slider,
} from "@heroui/react";

type SelectedObjectProps = {
  fill: string;
  height: number;
  left: number;
  opacity: number;
  stroke: string;
  strokeWidth: number;
  top: number;
  width: number;
};

type RightSidebarProps = {
  fabricCanvas: FabricCanvas | null;
};

export function RightSidebar({ fabricCanvas }: RightSidebarProps) {
  const [selectedProps, setSelectedProps] =
    useState<SelectedObjectProps | null>(null);

  const syncProps = useCallback(() => {
    if (!fabricCanvas) {
      setSelectedProps(null);

      return;
    }

    const obj = fabricCanvas.getActiveObject();

    if (!obj) {
      setSelectedProps(null);

      return;
    }

    setSelectedProps({
      fill: typeof obj.fill === "string" ? obj.fill : "",
      height: Math.round((obj.height ?? 0) * (obj.scaleY ?? 1)),
      left: Math.round(obj.left ?? 0),
      opacity: Math.round((obj.opacity ?? 1) * 100),
      stroke: typeof obj.stroke === "string" ? obj.stroke : "",
      strokeWidth: obj.strokeWidth ?? 1,
      top: Math.round(obj.top ?? 0),
      width: Math.round((obj.width ?? 0) * (obj.scaleX ?? 1)),
    });
  }, [fabricCanvas]);

  useEffect(() => {
    if (!fabricCanvas) return;

    const onSelect = () => syncProps();
    const onClear = () => setSelectedProps(null);

    fabricCanvas.on("selection:created", onSelect);
    fabricCanvas.on("selection:updated", onSelect);
    fabricCanvas.on("selection:cleared", onClear);
    fabricCanvas.on("object:modified", onSelect);
    fabricCanvas.on("object:moving", onSelect);
    fabricCanvas.on("object:scaling", onSelect);

    return () => {
      fabricCanvas.off("selection:created", onSelect);
      fabricCanvas.off("selection:updated", onSelect);
      fabricCanvas.off("selection:cleared", onClear);
      fabricCanvas.off("object:modified", onSelect);
      fabricCanvas.off("object:moving", onSelect);
      fabricCanvas.off("object:scaling", onSelect);
    };
  }, [fabricCanvas, syncProps]);

  const updateProp = (key: string, value: number | string) => {
    const obj = fabricCanvas?.getActiveObject();

    if (!obj || !fabricCanvas) return;

    if (key === "width") {
      const baseWidth = obj.width ?? 1;

      obj.set("scaleX", (value as number) / baseWidth);
    } else if (key === "height") {
      const baseHeight = obj.height ?? 1;

      obj.set("scaleY", (value as number) / baseHeight);
    } else if (key === "opacity") {
      obj.set("opacity", (value as number) / 100);
    } else {
      obj.set(key as keyof typeof obj, value);
    }

    obj.setCoords();
    fabricCanvas.renderAll();
    syncProps();
  };

  return (
    <aside className="flex w-64 shrink-0 flex-col border-l border-[var(--app-border)] bg-[var(--color-background)]">
      <div className="border-b border-[var(--app-border)] px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">
          Properties
        </h3>
      </div>

      {!selectedProps ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-center text-xs text-[var(--app-muted)]">
            Select an object to edit its properties
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 overflow-y-auto p-3">
          {/* Fill Color */}
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-[var(--app-muted)]">
              Fill
            </span>
            <ColorPicker
              value={selectedProps.fill || "#000000"}
              onChange={(color) => updateProp("fill", color.toString("hex"))}
            >
              <ColorPicker.Trigger className="gap-2">
                <ColorSwatch size="sm" />
                <span className="text-xs">{selectedProps.fill || "none"}</span>
              </ColorPicker.Trigger>
              <ColorPicker.Popover>
                <ColorArea
                  aria-label="Fill color area"
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

          {/* Stroke Color */}
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-[var(--app-muted)]">
              Stroke
            </span>
            <div className="flex items-center gap-2">
              <ColorPicker
                value={selectedProps.stroke || "#000000"}
                onChange={(color) =>
                  updateProp("stroke", color.toString("hex"))
                }
              >
                <ColorPicker.Trigger className="gap-2">
                  <ColorSwatch size="sm" />
                </ColorPicker.Trigger>
                <ColorPicker.Popover>
                  <ColorArea
                    aria-label="Stroke color area"
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
              <input
                aria-label="Stroke width"
                className="h-7 w-14 rounded border border-[var(--app-border)] bg-transparent px-2 text-xs text-[var(--color-foreground)]"
                min={0}
                type="number"
                value={selectedProps.strokeWidth}
                onChange={(e) =>
                  updateProp("strokeWidth", Number(e.target.value))
                }
              />
              <span className="text-xs text-[var(--app-muted)]">px</span>
            </div>
          </div>

          <Separator />

          {/* Opacity */}
          <div className="space-y-1.5">
            <Slider
              aria-label="Opacity"
              maxValue={100}
              minValue={0}
              value={selectedProps.opacity}
              onChange={(val) => updateProp("opacity", val as number)}
            >
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-[var(--app-muted)]">
                  Opacity
                </Label>
                <Slider.Output className="text-xs text-[var(--app-muted)]" />
              </div>
              <Slider.Track>
                <Slider.Fill />
                <Slider.Thumb />
              </Slider.Track>
            </Slider>
          </div>

          <Separator />

          {/* Position */}
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-[var(--app-muted)]">
              Position
            </span>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--app-muted)]">X</span>
                <input
                  aria-label="X position"
                  className="h-7 w-full rounded border border-[var(--app-border)] bg-transparent px-2 text-xs text-[var(--color-foreground)]"
                  type="number"
                  value={selectedProps.left}
                  onChange={(e) => updateProp("left", Number(e.target.value))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--app-muted)]">Y</span>
                <input
                  aria-label="Y position"
                  className="h-7 w-full rounded border border-[var(--app-border)] bg-transparent px-2 text-xs text-[var(--color-foreground)]"
                  type="number"
                  value={selectedProps.top}
                  onChange={(e) => updateProp("top", Number(e.target.value))}
                />
              </label>
            </div>
          </div>

          {/* Size */}
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-[var(--app-muted)]">
              Size
            </span>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--app-muted)]">W</span>
                <input
                  aria-label="Width"
                  className="h-7 w-full rounded border border-[var(--app-border)] bg-transparent px-2 text-xs text-[var(--color-foreground)]"
                  min={1}
                  type="number"
                  value={selectedProps.width}
                  onChange={(e) => updateProp("width", Number(e.target.value))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--app-muted)]">H</span>
                <input
                  aria-label="Height"
                  className="h-7 w-full rounded border border-[var(--app-border)] bg-transparent px-2 text-xs text-[var(--color-foreground)]"
                  min={1}
                  type="number"
                  value={selectedProps.height}
                  onChange={(e) => updateProp("height", Number(e.target.value))}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
