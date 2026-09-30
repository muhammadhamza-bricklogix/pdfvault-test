"use client";

import type { FieldProps } from "./types";

import { Checkbox } from "@heroui/react";

import { useFormEditorStore } from "@/lib/client/stores";

import { pdfRectToCss } from "./types";

export function CheckboxField({ field, mode, page }: FieldProps) {
  const value = useFormEditorStore((s) => s.values[field.id] ?? "");
  const setValue = useFormEditorStore((s) => s.setValue);

  const isChecked = value === "true" || value === "1" || value === "X";

  const handleChange = (next: boolean) => {
    setValue(field.id, next ? "true" : "");
  };

  if (mode === "overlay") {
    if (!page) return null;

    const css = pdfRectToCss(field.rect, page);

    return (
      <button
        aria-checked={isChecked}
        aria-label={field.label}
        className={`pointer-events-auto absolute flex items-center justify-center rounded-[2px] border transition-colors outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--color-accent)_30%,transparent)] ${
          isChecked
            ? "border-[var(--color-accent)]/60 bg-yellow-100/80 hover:bg-yellow-100/90"
            : "border-yellow-500/40 bg-yellow-100/50 hover:bg-yellow-100/70"
        }`}
        id={`field-input-${field.id}`}
        role="checkbox"
        style={{
          height: css.height,
          left: css.left,
          top: css.top,
          width: css.width,
        }}
        type="button"
        onClick={() => handleChange(!isChecked)}
      >
        {isChecked ? (
          <span className="text-[11px] font-bold leading-none text-black">
            ✓
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <Checkbox isSelected={isChecked} onChange={handleChange}>
      <span className="text-xs text-default-700 dark:text-default-300">
        {field.label}
      </span>
    </Checkbox>
  );
}
