"use client";

import { ColorSwatch, Tooltip } from "@heroui/react";

import { usePdfEditorStore } from "@/lib/client/stores";

const HIGHLIGHT_COLORS = [
  { color: "#FFEB3B", label: "Yellow" },
  { color: "#A5D6A7", label: "Green" },
  { color: "#90CAF9", label: "Blue" },
  { color: "#F48FB1", label: "Pink" },
] as const;

export function HighlightPropertiesContent() {
  const highlightColor = usePdfEditorStore((s) => s.highlightColor);
  const setHighlightColor = usePdfEditorStore((s) => s.setHighlightColor);

  return (
    <section className="space-y-2.5">
      <h3 className="text-sm font-medium text-[var(--color-foreground)]">
        Highlight Color
      </h3>
      <div className="flex flex-wrap items-center gap-2">
        {HIGHLIGHT_COLORS.map((preset) => (
          <Tooltip key={preset.color} delay={300}>
            <button
              aria-label={`${preset.label} highlight`}
              aria-pressed={highlightColor === preset.color}
              className={`rounded-sm transition ${
                highlightColor === preset.color
                  ? "ring-2 ring-[var(--color-accent)] ring-offset-2 ring-offset-default-100"
                  : ""
              }`}
              type="button"
              onClick={() => setHighlightColor(preset.color)}
            >
              <ColorSwatch
                aria-label={preset.label}
                color={preset.color}
                colorName={preset.label}
                shape="square"
                size="sm"
              />
            </button>
            <Tooltip.Content>
              <p>{preset.label}</p>
            </Tooltip.Content>
          </Tooltip>
        ))}
      </div>
    </section>
  );
}
