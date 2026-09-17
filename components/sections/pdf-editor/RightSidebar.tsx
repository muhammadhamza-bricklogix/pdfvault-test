"use client";

import type { Canvas as FabricCanvas } from "fabric";
import type { ShapeType } from "@/lib/client/stores/pdf-editor-store";

import {
  ArrowDown01Icon,
  ArrowDownRight01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  CircleIcon,
  LinerIcon,
  SquareIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Button,
  ColorArea,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  Label,
  NumberField,
  Slider,
  Surface,
  Tooltip,
} from "@heroui/react";
import { useCallback, useEffect, useState } from "react";

import { useIsMobile } from "@/lib/client/hooks/use-is-mobile";
import { usePdfEditorStore } from "@/lib/client/stores";

import { BackgroundImagePropertiesContent } from "./BackgroundImagePropertiesContent";
import { HighlightPropertiesContent } from "./HighlightPropertiesContent";
import {
  applyShapeFill,
  applyShapeStroke,
  applyShapeStrokeWidth,
  getShapeFill,
  getShapeStroke,
  getShapeStrokeWidth,
  isShapeObject,
  type ShapeFabricObject,
} from "./shape-object-utils";
import { WatermarkPropertiesContent } from "./WatermarkPropertiesContent";

type SelectedObjectProps = {
  fill: string;
  height: number;
  isShape: boolean;
  left: number;
  linkUrl: string;
  opacity: number;
  stroke: string;
  strokeWidth: number;
  top: number;
  width: number;
};

type Orientation = "horizontal" | "vertical";

type ShapePropertiesVariant = "floating" | "inline" | "strip";

type ShapePropertiesContentProps = {
  fabricCanvas: FabricCanvas | null;
  orientation?: Orientation;
  variant?: ShapePropertiesVariant;
};

type RightSidebarProps = {
  fabricCanvas: FabricCanvas | null;
};

const SHAPE_OPTIONS = [
  { icon: SquareIcon, label: "Rectangle", value: "rect" },
  { icon: CircleIcon, label: "Ellipse", value: "ellipse" },
  { icon: LinerIcon, label: "Line", value: "line" },
  { icon: ArrowDownRight01Icon, label: "Arrow", value: "arrow" },
] as const;

const TRANSPARENT_FILL = "transparent";

const FILL_SWATCHES = [
  { color: TRANSPARENT_FILL, label: "Transparent" },
  { color: "#FFFFFF", label: "White" },
  { color: "#FCA5A5", label: "Red" },
  { color: "#86EFAC", label: "Green" },
  { color: "#A5B4FC", label: "Blue" },
] as const;

const STROKE_SWATCHES = [
  { color: "#000000", label: "Black" },
  { color: "#EF4444", label: "Red" },
  { color: "#22C55E", label: "Green" },
  { color: "#2563EB", label: "Blue" },
] as const;

const STROKE_WIDTHS = [1, 2, 4, 0] as const;

function Section({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="space-y-2.5">
      <h3 className="text-sm font-medium text-[var(--color-foreground)]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function DimensionField({
  axis,
  label,
  minValue,
  onChange,
  step,
  value,
}: {
  /**
   * "x" → decrement is ← (move left), increment is → (move right).
   * "y" → decrement is ↑ (move up — Fabric `top` decreases upward),
   *       increment is ↓ (move down).
   * undefined → default ↑/↓ for size-style fields (W/H).
   */
  axis?: "x" | "y";
  label: string;
  minValue?: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}) {
  const decrementIcon =
    axis === "x"
      ? ArrowLeft01Icon
      : axis === "y"
        ? ArrowUp01Icon
        : ArrowDown01Icon;
  const incrementIcon =
    axis === "x"
      ? ArrowRight01Icon
      : axis === "y"
        ? ArrowDown01Icon
        : ArrowUp01Icon;

  return (
    <NumberField
      aria-label={label}
      className={"w-full p-0.5"}
      minValue={minValue}
      step={step}
      value={value}
      onChange={(next) => {
        if (Number.isFinite(next)) onChange(next);
      }}
    >
      <Label className="text-xs text-default-500">{label}</Label>
      <NumberField.Group className="w-full min-w-0">
        <NumberField.DecrementButton className="px-1 min-w-5 shrink-0">
          <HugeiconsIcon icon={decrementIcon} size={14} />
        </NumberField.DecrementButton>
        <NumberField.Input className="px-1 text-center text-xs min-w-0 w-full" />
        <NumberField.IncrementButton className="px-1 min-w-5 shrink-0">
          <HugeiconsIcon icon={incrementIcon} size={14} />
        </NumberField.IncrementButton>
      </NumberField.Group>
    </NumberField>
  );
}

function SwatchButton({
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
          color={color === "transparent" ? "rgba(0, 0, 0, 0)" : color}
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

export function ShapePropertiesContent({
  fabricCanvas,
  orientation = "vertical",
  variant = "inline",
}: ShapePropertiesContentProps) {
  const activeShapeType = usePdfEditorStore((s) => s.activeShapeType);
  const activeTool = usePdfEditorStore((s) => s.activeTool);
  const shapeFill = usePdfEditorStore((s) => s.shapeFill);
  const shapeStroke = usePdfEditorStore((s) => s.shapeStroke);
  const shapeStrokeWidth = usePdfEditorStore((s) => s.shapeStrokeWidth);
  const setActiveShapeType = usePdfEditorStore((s) => s.setActiveShapeType);
  const setActiveTool = usePdfEditorStore((s) => s.setActiveTool);
  const setShapeFill = usePdfEditorStore((s) => s.setShapeFill);
  const setShapeStroke = usePdfEditorStore((s) => s.setShapeStroke);
  const setShapeStrokeWidth = usePdfEditorStore((s) => s.setShapeStrokeWidth);
  const isMobile = useIsMobile();
  // Touch targets are big and imprecise compared to a mouse — moving an
  // annotation 1px per tap means a user has to tap the arrow ~50 times to
  // shift it a noticeable amount. Bump the step on mobile so each tap is
  // ~one finger-tip's worth of movement; keep desktop at 1 for precision.
  const positionStep = isMobile ? 10 : 1;
  const [selectedProps, setSelectedProps] =
    useState<SelectedObjectProps | null>(null);

  const computeProps = useCallback((): SelectedObjectProps | null => {
    if (!fabricCanvas) return null;
    const obj = fabricCanvas.getActiveObject();

    if (!obj) return null;
    const shapeObject = isShapeObject(obj) ? obj : null;

    return {
      fill: shapeObject
        ? getShapeFill(shapeObject)
        : typeof obj.fill === "string"
          ? obj.fill
          : "transparent",
      height: Math.round((obj.height ?? 0) * (obj.scaleY ?? 1)),
      isShape: !!shapeObject,
      left: Math.round(obj.left ?? 0),
      linkUrl: (obj as ShapeFabricObject).linkUrl ?? "",
      opacity: Math.round((obj.opacity ?? 1) * 100),
      stroke: shapeObject ? getShapeStroke(shapeObject) : "#000000",
      strokeWidth: shapeObject ? getShapeStrokeWidth(shapeObject) : 1,
      top: Math.round(obj.top ?? 0),
      width: Math.round((obj.width ?? 0) * (obj.scaleX ?? 1)),
    };
  }, [fabricCanvas]);

  // Layer 2: shallow-equal guard — skip setState if all fields unchanged
  const commitProps = useCallback((next: SelectedObjectProps | null) => {
    setSelectedProps((prev) => {
      if (prev === next) return prev;
      if (prev === null || next === null) return next;
      if (
        prev.fill === next.fill &&
        prev.height === next.height &&
        prev.isShape === next.isShape &&
        prev.left === next.left &&
        prev.linkUrl === next.linkUrl &&
        prev.opacity === next.opacity &&
        prev.stroke === next.stroke &&
        prev.strokeWidth === next.strokeWidth &&
        prev.top === next.top &&
        prev.width === next.width
      ) {
        return prev;
      }

      return next;
    });
  }, []);

  const syncProps = useCallback(() => {
    commitProps(computeProps());
  }, [commitProps, computeProps]);

  useEffect(() => {
    if (!fabricCanvas) return;

    // Layer 1: rAF throttle for high-frequency drag/scale events.
    // Without this, object:moving fires every mousemove (~120/s), each
    // triggering setState → full subtree re-render → CPU spike + GC churn.
    let rafId: number | null = null;
    const scheduleSync = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        commitProps(computeProps());
      });
    };
    const onClear = () => commitProps(null);

    fabricCanvas.on("selection:created", syncProps);
    fabricCanvas.on("selection:updated", syncProps);
    fabricCanvas.on("selection:cleared", onClear);
    fabricCanvas.on("object:modified", syncProps);
    fabricCanvas.on("object:moving", scheduleSync);
    fabricCanvas.on("object:scaling", scheduleSync);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      fabricCanvas.off("selection:created", syncProps);
      fabricCanvas.off("selection:updated", syncProps);
      fabricCanvas.off("selection:cleared", onClear);
      fabricCanvas.off("object:modified", syncProps);
      fabricCanvas.off("object:moving", scheduleSync);
      fabricCanvas.off("object:scaling", scheduleSync);
    };
  }, [fabricCanvas, syncProps, commitProps, computeProps]);

  const getSelectedShape = () => {
    const obj = fabricCanvas?.getActiveObject();

    return isShapeObject(obj) ? obj : null;
  };

  const applyToSelectedObject = (patch: Record<string, number | string>) => {
    const obj = fabricCanvas?.getActiveObject();

    if (!obj || !fabricCanvas) return;

    for (const [key, value] of Object.entries(patch)) {
      if (key === "width") {
        obj.set("scaleX", (value as number) / (obj.width ?? 1));
      } else if (key === "height") {
        obj.set("scaleY", (value as number) / (obj.height ?? 1));
      } else if (key === "opacity") {
        obj.set("opacity", (value as number) / 100);
      } else {
        obj.set(key as keyof typeof obj, value);
      }
    }

    obj.setCoords();
    fabricCanvas.renderAll();
    syncProps();
  };

  const commitShapeChange = (change: (object: ShapeFabricObject) => void) => {
    const shape = getSelectedShape();

    if (!shape || !fabricCanvas) return false;

    change(shape);
    shape.setCoords();
    fabricCanvas.renderAll();
    syncProps();

    return true;
  };

  const setFill = (fill: string) => {
    if (!commitShapeChange((object) => applyShapeFill(object, fill))) {
      setShapeFill(fill);
    }
  };

  const setStroke = (stroke: string) => {
    if (!commitShapeChange((object) => applyShapeStroke(object, stroke))) {
      setShapeStroke(stroke);
    }
  };

  const setStrokeWidth = (strokeWidth: number) => {
    if (
      !commitShapeChange((object) => applyShapeStrokeWidth(object, strokeWidth))
    ) {
      setShapeStrokeWidth(strokeWidth);
    }
  };

  const setShape = (shapeType: ShapeType) => {
    setActiveShapeType(shapeType);
    setActiveTool("shape");
  };

  const hasSelectedShape = !!selectedProps?.isShape;
  const showShapePanel = activeTool === "shape" || hasSelectedShape;
  const currentFill = hasSelectedShape ? selectedProps.fill : shapeFill;
  const currentStroke = hasSelectedShape ? selectedProps.stroke : shapeStroke;
  const currentStrokeWidth = hasSelectedShape
    ? selectedProps.strokeWidth
    : shapeStrokeWidth;

  if (!showShapePanel && !selectedProps) {
    return null;
  }

  const isHorizontal = orientation === "horizontal";
  // `touch-pan-x` on the horizontal (mobile) branch — only caller is
  // BottomDock's shape-properties strip. Same fix as the tool-tabs and
  // thumbnails strips: without a scoped touch-action, vertical drags
  // started on this strip walk up the DOM and pan the PDF viewer above.
  const containerClass = isHorizontal
    ? "flex min-w-0 max-w-full touch-pan-x flex-row items-start gap-6 overflow-x-auto overflow-y-hidden px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    : "flex max-h-[calc(100vh-10rem)] min-w-0 max-w-full flex-col gap-4 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
  const sectionWrapperClass = isHorizontal ? "shrink-0" : "";
  const dividerClass = isHorizontal
    ? "h-12 w-px shrink-0 self-center bg-default-200/70"
    : "h-5 w-1 bg-default-200/70";

  const body = (
    <div className={containerClass}>
      {showShapePanel && (
        <>
          <div className={sectionWrapperClass}>
            <Section title="Shape">
              <div className="flex flex-wrap gap-2">
                {SHAPE_OPTIONS.map((shape) => (
                  <Tooltip key={shape.value} delay={300}>
                    <Button
                      isIconOnly
                      aria-label={shape.label}
                      size="sm"
                      variant={
                        activeShapeType === shape.value ? "secondary" : "ghost"
                      }
                      onPress={() => setShape(shape.value)}
                    >
                      <HugeiconsIcon icon={shape.icon} size={16} />
                    </Button>
                    <Tooltip.Content>
                      <p>{shape.label}</p>
                    </Tooltip.Content>
                  </Tooltip>
                ))}
              </div>
            </Section>
          </div>

          <div className={sectionWrapperClass}>
            <Section title="Background">
              <div className="flex flex-wrap items-center gap-2 p-1">
                {FILL_SWATCHES.map((swatch) => (
                  <SwatchButton
                    key={swatch.color}
                    color={swatch.color}
                    isSelected={currentFill === swatch.color}
                    label={swatch.label}
                    onPress={() => setFill(swatch.color)}
                  />
                ))}
                <ColorPicker
                  value={
                    currentFill === TRANSPARENT_FILL ? "#FFFFFF" : currentFill
                  }
                  onChange={(color) => setFill(color.toString("hex"))}
                >
                  <ColorPicker.Trigger>
                    <ColorSwatch
                      aria-label="Custom background color"
                      shape="square"
                      size="sm"
                    />
                  </ColorPicker.Trigger>
                  <ColorPicker.Popover>
                    <ColorArea
                      aria-label="Background color area"
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
            </Section>
          </div>

          <div className={sectionWrapperClass}>
            <Section title="Stroke">
              <div className="flex flex-wrap items-center gap-2 p-1">
                {STROKE_SWATCHES.map((swatch) => (
                  <SwatchButton
                    key={swatch.color}
                    color={swatch.color}
                    isSelected={currentStroke === swatch.color}
                    label={swatch.label}
                    onPress={() => setStroke(swatch.color)}
                  />
                ))}
                <ColorPicker
                  value={currentStroke || "#000000"}
                  onChange={(color) => setStroke(color.toString("hex"))}
                >
                  <ColorPicker.Trigger>
                    <ColorSwatch
                      aria-label="Custom stroke color"
                      shape="square"
                      size="sm"
                    />
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
              </div>
            </Section>
          </div>

          <div className={sectionWrapperClass}>
            <Section title="Stroke thickness">
              <div className="flex flex-wrap gap-2">
                {STROKE_WIDTHS.map((width) => {
                  const label = width === 0 ? "No stroke" : `${width}px stroke`;

                  return (
                    <Tooltip key={width} delay={300}>
                      <Button
                        isIconOnly
                        aria-label={label}
                        size="sm"
                        variant={
                          currentStrokeWidth === width ? "secondary" : "ghost"
                        }
                        onPress={() => setStrokeWidth(width)}
                      >
                        <span
                          className="block w-4 rounded-full bg-[var(--color-foreground)]"
                          style={{
                            height: width === 0 ? 1 : Math.max(width, 1),
                          }}
                        />
                        {width === 0 && (
                          <span className="absolute h-5 w-px rotate-45 bg-danger" />
                        )}
                      </Button>
                      <Tooltip.Content>
                        <p>{label}</p>
                      </Tooltip.Content>
                    </Tooltip>
                  );
                })}
              </div>
            </Section>
          </div>
        </>
      )}

      {selectedProps && (
        <>
          <div className={dividerClass} />

          {variant !== "strip" && (
            <div className={sectionWrapperClass}>
              <Section title="Opacity">
                <Slider
                  aria-label="Opacity"
                  className={isHorizontal ? "w-40 p-1" : "p-1"}
                  maxValue={100}
                  minValue={0}
                  value={selectedProps.opacity}
                  onChange={(value) =>
                    applyToSelectedObject({ opacity: value as number })
                  }
                >
                  <Label className="text-xs text-default-500">Value</Label>
                  <Slider.Output className="text-xs text-default-500" />
                  <Slider.Track>
                    <Slider.Fill />
                    <Slider.Thumb />
                  </Slider.Track>
                </Slider>
              </Section>
            </div>
          )}

          <div className={sectionWrapperClass}>
            <Section title="Position">
              {/* Horizontal strip (mobile bottom dock): stack X over Y in
                  a single column. Two NumberFields side-by-side in the
                  ~160px the strip allotted per section were squeezed
                  below HeroUI's group minimum, causing the increment
                  buttons to visually bleed into the next field. Vertical
                  stack at `w-32` keeps each field at full readable width
                  while staying compact horizontally. Desktop right rail
                  keeps the 2-col grid since the sidebar is wide enough. */}
              <div
                className={
                  isHorizontal
                    ? "flex w-32 flex-col gap-2"
                    : "grid grid-cols-2 gap-2"
                }
              >
                <DimensionField
                  axis="x"
                  label="X"
                  step={positionStep}
                  value={selectedProps.left}
                  onChange={(left) => applyToSelectedObject({ left })}
                />
                <DimensionField
                  axis="y"
                  label="Y"
                  step={positionStep}
                  value={selectedProps.top}
                  onChange={(top) => applyToSelectedObject({ top })}
                />
              </div>
            </Section>
          </div>

          <div className={sectionWrapperClass}>
            <Section title="Size">
              <div
                className={
                  isHorizontal
                    ? "flex w-32 flex-col gap-2"
                    : "grid grid-cols-2 gap-2"
                }
              >
                <DimensionField
                  label="W"
                  minValue={1}
                  value={selectedProps.width}
                  onChange={(width) => applyToSelectedObject({ width })}
                />
                <DimensionField
                  label="H"
                  minValue={1}
                  value={selectedProps.height}
                  onChange={(height) => applyToSelectedObject({ height })}
                />
              </div>
            </Section>
          </div>
        </>
      )}
    </div>
  );

  if (variant === "floating") {
    // Only show the floating panel when a shape tool is active or a shape
    // object is selected. Text/image selections have their own toolbars
    // (FloatingTextToolbar, etc.) and must not trigger this panel.
    if (!showShapePanel) return null;

    // Panel visibility is `activeTool === "shape" || hasSelectedShape`.
    // Just flipping `activeTool` back to "select" leaves the panel up
    // when a shape is still selected (X button appears to do nothing).
    // Discard the active object too so both branches of the visibility
    // gate turn off and `selectedProps` clears on the resulting
    // `selection:cleared` event.
    const handleFloatingClose = () => {
      if (fabricCanvas) {
        fabricCanvas.discardActiveObject();
        fabricCanvas.requestRenderAll();
      }
      usePdfEditorStore.getState().setActiveTool("select");
    };

    return (
      <>
        <aside className="pointer-events-auto absolute right-5 top-5 z-20 max-w-[min(20rem,calc(100vw-2.5rem))]">
          <Surface
            className="relative w-fit max-w-full rounded-xl p-4 pr-8 shadow-xl ring-1 ring-default-200/70"
            variant="default"
          >
            <FloatingPanelCloseButton onPress={handleFloatingClose} />
            {body}
          </Surface>
        </aside>
      </>
    );
  }

  if (variant === "strip") {
    // Only show the strip for actual shape objects. Text, images, and other
    // canvas objects have their own toolbars (FloatingTextToolbar etc.) and
    // don't need the horizontal strip cluttering the mobile dock.
    if (!showShapePanel) return null;

    return (
      <div className="border-b border-default-200/70 bg-default-50/70 px-3 py-2">
        {body}
      </div>
    );
  }

  return body;
}

function FloatingPanelCloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Button
      isIconOnly
      aria-label="Close panel"
      className="!absolute !right-2 !top-2 !size-7 !min-w-0 !rounded-full !p-0 text-default-500 hover:!bg-default-100 hover:!text-default-800"
      variant="tertiary"
      onPress={onPress}
    >
      <HugeiconsIcon icon={Cancel01Icon} size={14} />
    </Button>
  );
}

export function RightSidebar({ fabricCanvas }: RightSidebarProps) {
  const activeTool = usePdfEditorStore((s) => s.activeTool);
  const setActiveTool = usePdfEditorStore((s) => s.setActiveTool);

  const closePanel = () => setActiveTool("select");

  if (activeTool === "watermark") {
    return (
      <aside className="pointer-events-auto absolute right-5 top-5 z-20 max-w-[min(20rem,calc(100vw-2.5rem))]">
        <Surface
          className="relative w-fit max-w-full rounded-xl p-4 pr-8 shadow-xl ring-1 ring-default-200/70"
          variant="default"
        >
          <FloatingPanelCloseButton onPress={closePanel} />
          <WatermarkPropertiesContent />
        </Surface>
      </aside>
    );
  }

  if (activeTool === "backgroundImage") {
    return (
      <aside className="pointer-events-auto absolute right-5 top-5 z-20 max-w-[min(20rem,calc(100vw-2.5rem))]">
        <Surface
          className="relative w-fit max-w-full rounded-xl p-4 pr-8 shadow-xl ring-1 ring-default-200/70"
          variant="default"
        >
          <FloatingPanelCloseButton onPress={closePanel} />
          <BackgroundImagePropertiesContent />
        </Surface>
      </aside>
    );
  }

  if (activeTool === "highlight") {
    return (
      <aside className="pointer-events-auto absolute right-5 top-5 z-20 max-w-[min(20rem,calc(100vw-2.5rem))]">
        <Surface
          className="relative w-fit max-w-full rounded-xl p-4 pr-8 shadow-xl ring-1 ring-default-200/70"
          variant="default"
        >
          <FloatingPanelCloseButton onPress={closePanel} />
          <HighlightPropertiesContent />
        </Surface>
      </aside>
    );
  }

  return (
    <ShapePropertiesContent
      fabricCanvas={fabricCanvas}
      orientation="vertical"
      variant="floating"
    />
  );
}
