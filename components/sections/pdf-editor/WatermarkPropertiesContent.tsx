"use client";

import type { Key } from "@heroui/react";
import type { WatermarkPosition } from "@/lib/client/stores/pdf-editor-store";

import { ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Button,
  ColorArea,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  Input,
  Label,
  NumberField,
  Slider,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import { useCallback, useRef } from "react";

import { compressImageDataUrl } from "@/lib/client/pdf-editor/compress-image-data-url";
import { usePdfEditorStore } from "@/lib/client/stores";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FONT_OPTIONS = [
  { label: "Helvetica", value: "Helvetica" },
  { label: "Times New Roman", value: "Times-Roman" },
  { label: "Courier", value: "Courier" },
] as const;

const POSITION_OPTIONS = [
  { label: "Center", value: "center" },
  { label: "Top", value: "top" },
  { label: "Bottom", value: "bottom" },
  { label: "Tiled", value: "tiled" },
] as const;

const ROTATION_PRESETS = [
  { label: "0", value: 0 },
  { label: "-45", value: -45 },
  { label: "45", value: 45 },
] as const;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function WatermarkPropertiesContent({
  scrollContainer = true,
}: {
  scrollContainer?: boolean;
}) {
  const config = usePdfEditorStore((s) => s.watermarkConfig);
  const setConfig = usePdfEditorStore((s) => s.setWatermarkConfig);

  const imageInputRef = useRef<HTMLInputElement>(null);

  const clearImage = useCallback(() => {
    setConfig({ imageData: null });
  }, [setConfig]);

  const clearText = useCallback(() => {
    setConfig({ text: "" });
  }, [setConfig]);

  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];

      // Reset early so the same file can be re-selected after an error.
      e.target.value = "";

      if (!file) return;

      // Validate MIME from magic bytes? Accept attr already restricts the
      // picker, but a forced .png rename could slip through — for now we
      // trust `accept`. Reject anything that isn't png/jpeg by extension too.
      const isAllowedType =
        file.type === "image/png" || file.type === "image/jpeg";

      if (!isAllowedType) {
        toast.error({
          title: "Unsupported image",
          description: "Watermark images must be PNG or JPEG.",
        });

        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        toast.error({
          title: "Image too large",
          description: "Watermark images must be 2 MB or smaller.",
        });

        return;
      }

      // Compress client-side so the resulting data URL fits inside the
      // ~800 KB editorState soft cap. Without this a >600 KB source
      // PNG blows past the cap once combined with the rest of the
      // envelope, `buildEditorStateJson` trims `imageData` before
      // uploading, and on reload the live preview has no image bytes
      // → user reports "watermark image gone." PNG-source keeps
      // transparency (typical for watermarks) so we preserve PNG format.
      void (async () => {
        try {
          const dataUrl = await compressImageDataUrl(file, {
            maxDim: 1200,
            jpegQuality: 0.9,
          });

          // Save the image bytes AND make sure the watermark is enabled +
          // type-switched to "image", so users who upload before flipping
          // the toggles still get a visible watermark on save/export.
          // Row 74/80: text watermark default rotation is -45° (slanted
          // "CONFIDENTIAL" across the page — standard print convention).
          // Image watermarks (logos, stamps) read best upright, and
          // inheriting the -45° default when switching to image means
          // the uploaded logo slants over whatever the user inserted —
          // perceived as "the watermark rotated unexpectedly." Reset
          // rotation to 0 at image upload. The Rotation controls below
          // still let users dial in a non-zero angle after upload.
          setConfig({
            enabled: true,
            imageData: dataUrl,
            rotation: 0,
            type: "image",
          });
        } catch (err) {
          logger.captureError(err, "watermark.compress", {
            filename: file.name,
            size: file.size,
          });
          toast.error({
            title: "Upload failed",
            description: "Could not read the selected image. Try another file.",
          });
        }
      })();
    },
    [setConfig],
  );

  return (
    <div
      className={
        scrollContainer
          ? // Row 115/121: `pb-6` keeps the custom-range Input from
            // clipping against the scroll container's bottom edge when
            // "Range" is picked. Without it the input corners sat on
            // the modal's inside bottom border and the scrollbar
            // couldn't scroll past them.
            "flex max-h-[calc(100dvh-11rem)] min-w-48 max-w-full flex-col gap-4 overflow-y-auto overflow-x-hidden px-3 pb-6 sm:px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "flex min-w-48 max-w-full flex-col gap-4 overflow-x-hidden px-3 pb-4 sm:px-4"
      }
    >
      {/* Enable / Disable */}
      <Switch
        isSelected={config.enabled}
        size="sm"
        onChange={() => setConfig({ enabled: !config.enabled })}
      >
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Switch.Content>
          <Label className="text-sm font-medium">Watermark</Label>
        </Switch.Content>
      </Switch>

      {/* Type toggle */}
      <Section title="Type">
        <ToggleButtonGroup
          disallowEmptySelection
          selectedKeys={new Set([config.type])}
          selectionMode="single"
          size="sm"
          onSelectionChange={(keys: Set<Key>) => {
            const key = Array.from(keys)[0] as "image" | "text" | undefined;

            if (key) setConfig({ type: key });
          }}
        >
          <ToggleButton id="text">Text</ToggleButton>
          <ToggleButtonGroup.Separator />
          <ToggleButton id="image">Image</ToggleButton>
        </ToggleButtonGroup>
      </Section>

      {/* Text config */}
      {config.type === "text" && (
        <>
          <Section title="Text">
            <div className="flex flex-col gap-2">
              <Input
                aria-label="Watermark text"
                className="text-sm"
                placeholder="e.g. CONFIDENTIAL"
                value={config.text}
                // Auto-enable on first edit so users who type a watermark
                // without flipping the Switch still get it baked at save time.
                onChange={(e) =>
                  setConfig({ enabled: true, text: e.target.value })
                }
              />
              {config.text && (
                <div className="flex justify-end px-1 py-0.5">
                  <Button size="sm" variant="ghost" onPress={clearText}>
                    Remove
                  </Button>
                </div>
              )}
            </div>
          </Section>

          <Section title="Font">
            <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <ToggleButtonGroup
                disallowEmptySelection
                selectedKeys={new Set([config.fontFamily])}
                selectionMode="single"
                size="sm"
                onSelectionChange={(keys: Set<Key>) => {
                  const key = Array.from(keys)[0] as string | undefined;

                  if (key) setConfig({ fontFamily: key });
                }}
              >
                {FONT_OPTIONS.map((opt, i) => (
                  <ToggleButton key={opt.value} id={opt.value}>
                    {i > 0 && <ToggleButtonGroup.Separator />}
                    {opt.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </div>
          </Section>

          <Section title="Font Size">
            <div className="flex flex-col gap-2">
              <Slider
                aria-label="Font size slider"
                className="p-1"
                maxValue={200}
                minValue={8}
                step={1}
                value={config.fontSize}
                onChange={(value) => setConfig({ fontSize: value as number })}
              >
                <Slider.Output className="text-xs text-default-500" />
                <Slider.Track>
                  <Slider.Fill />
                  <Slider.Thumb />
                </Slider.Track>
              </Slider>
              <NumberField
                aria-label="Font size"
                className="w-full"
                maxValue={200}
                minValue={8}
                value={config.fontSize}
                onChange={(val) => {
                  if (Number.isFinite(val)) setConfig({ fontSize: val });
                }}
              >
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
            </div>
          </Section>

          <Section title="Color">
            <ColorPicker
              value={config.color}
              onChange={(color) => setConfig({ color: color.toString("hex") })}
            >
              <ColorPicker.Trigger>
                <ColorSwatch
                  aria-label="Watermark text color"
                  shape="square"
                  size="sm"
                />
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
          </Section>
        </>
      )}

      {/* Image config */}
      {config.type === "image" && (
        <Section title="Image">
          <input
            ref={imageInputRef}
            accept="image/png,image/jpeg"
            className="hidden"
            type="file"
            onChange={handleImageUpload}
          />
          <div className="flex flex-col gap-2">
            {config.imageData && (
              /* eslint-disable-next-line @next/next/no-img-element -- data URL thumbnail, not optimizable */
              <img
                alt="Watermark preview"
                className="max-h-16 max-w-full rounded border border-default-200 object-contain"
                src={config.imageData}
              />
            )}
            <div className="flex gap-2 px-1 py-0.5">
              <Button
                className="mx-1 my-1 flex-1"
                size="sm"
                variant="ghost"
                onPress={() => imageInputRef.current?.click()}
              >
                {config.imageData ? "Change Image" : "Upload Image"}
              </Button>
              {config.imageData && (
                <Button size="sm" variant="ghost" onPress={clearImage}>
                  Remove
                </Button>
              )}
            </div>
            <Switch
              isSelected={config.scaleToPage}
              size="sm"
              onChange={() => setConfig({ scaleToPage: !config.scaleToPage })}
            >
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Switch.Content>
                <Label className="text-xs">Scale image to page width</Label>
              </Switch.Content>
            </Switch>
          </div>
        </Section>
      )}

      {/* Opacity */}
      <Section title="Opacity">
        <Slider
          aria-label="Opacity"
          className="p-1"
          maxValue={100}
          minValue={0}
          step={1}
          value={Math.round(config.opacity * 100)}
          onChange={(value) => setConfig({ opacity: (value as number) / 100 })}
        >
          <Label className="text-xs text-default-500">Value</Label>
          <Slider.Output className="text-xs text-default-500" />
          <Slider.Track>
            <Slider.Fill />
            <Slider.Thumb />
          </Slider.Track>
        </Slider>
      </Section>

      {/* Rotation */}
      <Section title="Rotation">
        <div className="flex items-center gap-2">
          {ROTATION_PRESETS.map((preset) => (
            <Button
              key={preset.value}
              isIconOnly={false}
              size="sm"
              variant={config.rotation === preset.value ? "secondary" : "ghost"}
              onPress={() => setConfig({ rotation: preset.value })}
            >
              {preset.label}&deg;
            </Button>
          ))}
          <NumberField
            aria-label="Rotation degrees"
            className="w-20"
            maxValue={360}
            minValue={-360}
            value={config.rotation}
            onChange={(val) => {
              if (Number.isFinite(val)) setConfig({ rotation: val });
            }}
          >
            <NumberField.Group>
              <NumberField.Input />
            </NumberField.Group>
          </NumberField>
        </div>
      </Section>

      {/* Position */}
      <Section title="Position">
        <div className="grid grid-cols-2 gap-1.5">
          {POSITION_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              aria-label={opt.label}
              size="sm"
              variant={config.position === opt.value ? "secondary" : "ghost"}
              onPress={() =>
                setConfig({
                  enabled: true,
                  position: opt.value as WatermarkPosition,
                })
              }
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </Section>

      {/* Tiled spacing — only when position is tiled */}
      {config.position === "tiled" && (
        <Section title="Tile Spacing">
          <NumberField
            aria-label="Tile spacing"
            className="w-full"
            maxValue={800}
            minValue={20}
            value={config.tiledSpacing}
            onChange={(val) => {
              if (Number.isFinite(val)) setConfig({ tiledSpacing: val });
            }}
          >
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
        </Section>
      )}

      {/* Layer */}
      <Section title="Layer">
        <ToggleButtonGroup
          disallowEmptySelection
          selectedKeys={new Set([config.layer])}
          selectionMode="single"
          size="sm"
          onSelectionChange={(keys: Set<Key>) => {
            const key = Array.from(keys)[0] as
              | "overlay"
              | "underlay"
              | undefined;

            if (key) setConfig({ layer: key });
          }}
        >
          <ToggleButton id="overlay">Overlay</ToggleButton>
          <ToggleButtonGroup.Separator />
          <ToggleButton id="underlay">Underlay</ToggleButton>
        </ToggleButtonGroup>
      </Section>

      {/* Page scope */}
      <Section title="Pages">
        <ToggleButtonGroup
          disallowEmptySelection
          selectedKeys={new Set([config.pageScope])}
          selectionMode="single"
          size="sm"
          onSelectionChange={(keys: Set<Key>) => {
            const key = Array.from(keys)[0] as
              | "all"
              | "custom"
              | "even"
              | "odd"
              | undefined;

            if (key) setConfig({ pageScope: key });
          }}
        >
          <ToggleButton id="all">All</ToggleButton>
          <ToggleButtonGroup.Separator />
          <ToggleButton id="odd">Odd</ToggleButton>
          <ToggleButtonGroup.Separator />
          <ToggleButton id="even">Even</ToggleButton>
          <ToggleButtonGroup.Separator />
          <ToggleButton id="custom">Range</ToggleButton>
        </ToggleButtonGroup>
      </Section>

      {/* Custom page range */}
      {config.pageScope === "custom" && (
        <Input
          aria-label="Custom page range"
          className="text-sm"
          placeholder="1-3, 5, 7-12"
          value={config.customPageRange}
          onChange={(e) => setConfig({ customPageRange: e.target.value })}
        />
      )}
    </div>
  );
}
