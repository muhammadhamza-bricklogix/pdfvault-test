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

import { usePdfEditorStore } from "@/lib/client/stores";
import { detectImageMagicBytes } from "@/lib/shared/utils/image-magic-bytes";
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

export function WatermarkPropertiesContent() {
  const config = usePdfEditorStore((s) => s.watermarkConfig);
  const setConfig = usePdfEditorStore((s) => s.setWatermarkConfig);

  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];

      // Reset early so the same file can be re-selected after an error.
      e.target.value = "";

      if (!file) return;

      // First-pass MIME guard — picker `accept` plus extension-driven type.
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

      // Second-pass magic-byte verification. `file.type` is set from the
      // extension and can be spoofed by a rename, but a real PNG/JPEG starts
      // with the same bytes everywhere. Fabric's SVG path on Safari executes
      // <script>, so letting `payload.svg` renamed to `bad.png` slip through
      // would be a genuine XSS hole.
      const detected = await detectImageMagicBytes(file);

      if (!detected) {
        toast.error({
          title: "Unsupported image",
          description:
            "This file's contents don't look like a PNG or JPEG. Try another image.",
        });

        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        const dataUrl = reader.result;

        if (typeof dataUrl !== "string") {
          toast.error({
            title: "Upload failed",
            description: "Could not read the selected image. Try another file.",
          });

          return;
        }

        // Save the image bytes AND make sure the watermark is enabled +
        // type-switched to "image", so users who upload before flipping the
        // toggles still get a visible watermark on save/export.
        setConfig({ enabled: true, imageData: dataUrl, type: "image" });
      };
      reader.onerror = () => {
        toast.error({
          title: "Upload failed",
          description: "Could not read the selected image. Try another file.",
        });
      };
      reader.readAsDataURL(file);
    },
    [setConfig],
  );

  return (
    <div className="flex max-h-[calc(100vh-10rem)] min-w-48 max-w-full flex-col gap-4 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
          </Section>

          <Section title="Font">
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
          </Section>

          <Section title="Font Size">
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
            <Button
              size="sm"
              variant="ghost"
              onPress={() => imageInputRef.current?.click()}
            >
              {config.imageData ? "Change Image" : "Upload Image"}
            </Button>
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
