"use client";

import type { Canvas as FabricCanvas } from "fabric";
import type { ShapeType } from "@/lib/client/stores/pdf-editor-store";

import {
  ArrowDown01Icon,
  ArrowDownRight01Icon,
  ArrowUp01Icon,
  CircleIcon,
  LayerBringForwardIcon,
  LayerBringToFrontIcon,
  LayerSendBackwardIcon,
  LayerSendToBackIcon,
  LinerIcon,
  Link01Icon,
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

import { usePdfEditorStore } from "@/lib/client/stores";

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
import { ShapeLinkModal } from "./ShapeLinkModal";

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

type LayerAction = "back" | "backward" | "forward" | "front";

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
  label,
  minValue,
  onChange,
  value,
}: {
  label: string;
  minValue?: number;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <NumberField
      aria-label={label}
      className={"w-full p-0.5"}
      minValue={minValue}
      value={value}
      onChange={(next) => {
        if (Number.isFinite(next)) onChange(next);
      }}
    >
      <Label className="text-xs text-default-500">{label}</Label>
      <NumberField.Group>
        <NumberField.DecrementButton>
          <HugeiconsIcon icon={ArrowDown01Icon} size={16} />
        </NumberField.DecrementButton>
        <NumberField.Input />
        <NumberField.IncrementButton>
          <HugeiconsIcon icon={ArrowUp01Icon} size={16} />
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
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
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

    const shapeObject = isShapeObject(obj) ? obj : null;

    setSelectedProps({
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

  useEffect(() => {
    const openLinkModal = () => {
      if (fabricCanvas?.getActiveObject()) {
        setIsLinkModalOpen(true);
      }
    };

    window.addEventListener("editor:open-shape-link", openLinkModal);

    return () => {
      window.removeEventListener("editor:open-shape-link", openLinkModal);
    };
  }, [fabricCanvas]);

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

  const moveLayer = (action: LayerAction) => {
    const shape = getSelectedShape();

    if (!shape || !fabricCanvas) return;
    const actions = {
      back: () => fabricCanvas.sendObjectToBack(shape),
      backward: () => fabricCanvas.sendObjectBackwards(shape),
      forward: () => fabricCanvas.bringObjectForward(shape),
      front: () => fabricCanvas.bringObjectToFront(shape),
    };

    actions[action]();
    fabricCanvas.setActiveObject(shape);
    fabricCanvas.renderAll();
    syncProps();
  };

  const hasSelectedShape = !!selectedProps?.isShape;
  const showShapePanel = activeTool === "shape" || hasSelectedShape;
  const currentFill = hasSelectedShape ? selectedProps.fill : shapeFill;
  const currentStroke = hasSelectedShape ? selectedProps.stroke : shapeStroke;
  const currentStrokeWidth = hasSelectedShape
    ? selectedProps.strokeWidth
    : shapeStrokeWidth;

  const saveLink = (value: string) => {
    applyToSelectedObject({ linkUrl: value });
  };

  if (!showShapePanel && !selectedProps) {
    return null;
  }

  const isHorizontal = orientation === "horizontal";
  const containerClass = isHorizontal
    ? "flex min-w-0 max-w-full flex-row items-start gap-6 overflow-x-auto overflow-y-hidden px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                {STROKE_WIDTHS.map((width) => (
                  <Button
                    key={width}
                    isIconOnly
                    aria-label={width === 0 ? "No stroke" : `${width}px stroke`}
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
                ))}
              </div>
            </Section>
          </div>

          <div className={sectionWrapperClass}>
            <Section title="Link">
              <div className="flex items-center justify-between gap-2">
                <HugeiconsIcon
                  className="text-default-500"
                  icon={Link01Icon}
                  size={16}
                />
                <Button
                  isDisabled={!selectedProps}
                  size="sm"
                  variant={selectedProps?.linkUrl ? "secondary" : "ghost"}
                  onPress={() => setIsLinkModalOpen(true)}
                >
                  {selectedProps?.linkUrl ? "Edit" : "Add"}
                  <span className="text-base leading-none">+</span>
                </Button>
              </div>
            </Section>
          </div>

          <div className={sectionWrapperClass}>
            <Section title="Layers">
              <div className="flex flex-wrap gap-2">
                <Tooltip delay={300}>
                  <Button
                    isIconOnly
                    aria-label="Send to back"
                    isDisabled={!hasSelectedShape}
                    size="sm"
                    variant="ghost"
                    onPress={() => moveLayer("back")}
                  >
                    <HugeiconsIcon icon={LayerSendToBackIcon} size={16} />
                  </Button>
                  <Tooltip.Content>
                    <p>Send to back</p>
                  </Tooltip.Content>
                </Tooltip>
                <Tooltip delay={300}>
                  <Button
                    isIconOnly
                    aria-label="Send backward"
                    isDisabled={!hasSelectedShape}
                    size="sm"
                    variant="ghost"
                    onPress={() => moveLayer("backward")}
                  >
                    <HugeiconsIcon icon={LayerSendBackwardIcon} size={16} />
                  </Button>
                  <Tooltip.Content>
                    <p>Send backward</p>
                  </Tooltip.Content>
                </Tooltip>
                <Tooltip delay={300}>
                  <Button
                    isIconOnly
                    aria-label="Bring forward"
                    isDisabled={!hasSelectedShape}
                    size="sm"
                    variant="ghost"
                    onPress={() => moveLayer("forward")}
                  >
                    <HugeiconsIcon icon={LayerBringForwardIcon} size={16} />
                  </Button>
                  <Tooltip.Content>
                    <p>Bring forward</p>
                  </Tooltip.Content>
                </Tooltip>
                <Tooltip delay={300}>
                  <Button
                    isIconOnly
                    aria-label="Bring to front"
                    isDisabled={!hasSelectedShape}
                    size="sm"
                    variant="ghost"
                    onPress={() => moveLayer("front")}
                  >
                    <HugeiconsIcon icon={LayerBringToFrontIcon} size={16} />
                  </Button>
                  <Tooltip.Content>
                    <p>Bring to front</p>
                  </Tooltip.Content>
                </Tooltip>
              </div>
            </Section>
          </div>
        </>
      )}

      {selectedProps && (
        <>
          <div className={dividerClass} />

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

          <div className={sectionWrapperClass}>
            <Section title="Position">
              <div
                className={
                  isHorizontal ? "flex w-40 gap-2" : "grid grid-cols-2 gap-2"
                }
              >
                <DimensionField
                  label="X"
                  value={selectedProps.left}
                  onChange={(left) => applyToSelectedObject({ left })}
                />
                <DimensionField
                  label="Y"
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
                  isHorizontal ? "flex w-40 gap-2" : "grid grid-cols-2 gap-2"
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

  const shapeLinkModal = (
    <ShapeLinkModal
      initialValue={selectedProps?.linkUrl ?? ""}
      isOpen={isLinkModalOpen}
      onClose={() => setIsLinkModalOpen(false)}
      onSave={saveLink}
    />
  );

  if (variant === "floating") {
    return (
      <>
        <aside className="pointer-events-auto absolute right-5 top-5 z-20 max-w-[min(20rem,calc(100vw-2.5rem))]">
          <Surface
            className="w-fit max-w-full rounded-xl p-4 shadow-xl ring-1 ring-default-200/70"
            variant="default"
          >
            {body}
          </Surface>
        </aside>
        {shapeLinkModal}
      </>
    );
  }

  if (variant === "strip") {
    return (
      <>
        <div className="border-b border-default-200/70 bg-default-50/70 px-3 py-2">
          {body}
        </div>
        {shapeLinkModal}
      </>
    );
  }

  return (
    <>
      {body}
      {shapeLinkModal}
    </>
  );
}

export function RightSidebar({ fabricCanvas }: RightSidebarProps) {
  return (
    <ShapePropertiesContent
      fabricCanvas={fabricCanvas}
      orientation="vertical"
      variant="floating"
    />
  );
}
