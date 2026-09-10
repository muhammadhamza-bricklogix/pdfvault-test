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

import { compressImageDataUrl } from "@/lib/client/pdf-editor/compress-image-data-url";
import { usePdfEditorStore } from "@/lib/client/stores";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

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

      // Reset early so the same file can be re-selected after an error.
      e.target.value = "";

      if (!file) return;

      const isAllowedType =
        file.type === "image/png" || file.type === "image/jpeg";

      if (!isAllowedType) {
        toast.error({
          title: "Unsupported image",
          description: "Background images must be PNG or JPEG.",
        });

        return;
      }

      if (file.size > MAX_IMAGE_BYTES) {
        toast.error({
          title: "Image too large",
          description: "Background images must be 5 MB or smaller.",
        });

        return;
      }

      // Compress client-side so the resulting data URL fits inside the
      // ~800 KB editorState soft cap. Without this a 3 MB source PNG
      // produces a ~4 MB base64 string, `buildEditorStateJson` trims
      // `imageData` before uploading, and on reload the live preview
      // has no image bytes → user reports "background image gone."
      // Save uses bakeOverlays:false so the cloud PDF doesn't carry the
      // image either — the persisted data URL is the ONLY reload source.
      void (async () => {
        try {
          const dataUrl = await compressImageDataUrl(file, {
            maxDim: 1600,
            jpegQuality: 0.85,
          });

          // Auto-enable so users who upload without first flipping the Switch
          // still see the image apply and get it baked into the saved PDF.
          setConfig({ enabled: true, imageData: dataUrl });
        } catch (err) {
          logger.captureError(err, "backgroundImage.compress", {
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
          {/* QA 2026-09-08: add horizontal padding so the ghost-button
              focus/hover ring doesn't clip against the Section's edge
              on narrow sidebar/modal widths. `flex-1` on the Change/
              Upload button was previously stretching it flush to the
              container border with only ml-1/mr-1 which was insufficient
              for the ring outline. */}
          <div className="flex gap-2 px-1 py-0.5">
            <Button
              className="mx-1 my-1 flex-1"
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
