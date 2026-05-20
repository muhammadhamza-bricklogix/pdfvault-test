"use client";

import type { Key } from "@heroui/react";
import type { BackgroundImageFit } from "@/lib/client/stores/pdf-editor-store";

import {
  Button,
  Input,
  Label,
  Slider,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import { useCallback, useRef } from "react";

import { usePdfEditorStore } from "@/lib/client/stores";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

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

export function BackgroundImagePropertiesContent() {
  const config = usePdfEditorStore((s) => s.backgroundImageConfig);
  const setConfig = usePdfEditorStore((s) => s.setBackgroundImageConfig);

  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];

      if (!file) return;
      if (file.size > MAX_IMAGE_BYTES) return;

      const reader = new FileReader();

      reader.onload = () => {
        setConfig({ imageData: reader.result as string });
      };
      reader.readAsDataURL(file);

      e.target.value = "";
    },
    [setConfig],
  );

  const clearImage = useCallback(() => {
    setConfig({ imageData: null });
  }, [setConfig]);

  return (
    <div className="flex max-h-[calc(100vh-10rem)] min-w-48 max-w-full flex-col gap-4 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Switch
        isSelected={config.enabled}
        size="sm"
        onChange={() => setConfig({ enabled: !config.enabled })}
      >
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Switch.Content>
          <Label className="text-sm font-medium">Background image</Label>
        </Switch.Content>
      </Switch>

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
              alt="Background preview"
              className="max-h-24 max-w-full rounded border border-default-200 object-contain"
              src={config.imageData}
            />
          )}
          <div className="flex gap-2">
            <Button
              className="flex-1"
              size="sm"
              variant="ghost"
              onPress={() => imageInputRef.current?.click()}
            >
              {config.imageData ? "Change image" : "Upload image"}
            </Button>
            {config.imageData && (
              <Button size="sm" variant="ghost" onPress={clearImage}>
                Remove
              </Button>
            )}
          </div>
        </div>
      </Section>

      <Section title="Fit">
        <ToggleButtonGroup
          disallowEmptySelection
          selectedKeys={new Set([config.fit])}
          selectionMode="single"
          size="sm"
          onSelectionChange={(keys: Set<Key>) => {
            const key = Array.from(keys)[0] as BackgroundImageFit | undefined;

            if (key) setConfig({ fit: key });
          }}
        >
          <ToggleButton id="cover">Cover</ToggleButton>
          <ToggleButtonGroup.Separator />
          <ToggleButton id="contain">Contain</ToggleButton>
          <ToggleButtonGroup.Separator />
          <ToggleButton id="stretch">Stretch</ToggleButton>
        </ToggleButtonGroup>
      </Section>

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
