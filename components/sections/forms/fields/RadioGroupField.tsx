"use client";

import type { FieldProps } from "./types";

import { Label, Radio, RadioGroup } from "@heroui/react";

import { useFormEditorStore } from "@/lib/client/stores";

import { pdfRectToCss } from "./types";

/**
 * Renders the 7-way W-9 federal tax classification.
 *
 * Selecting any option other than "llc" clears f1_03 so the optional LLC
 * letter doesn't get stamped on a non-LLC form. Same for "other" / f1_04.
 *
 * Overlay mode renders one transparent hit-area `<button>` per option
 * positioned over the printed checkbox on the PDF. When the user clicks
 * any of them, the shared store value updates and a visible ✓ is drawn.
 */
export function RadioGroupField({ field, mode, page }: FieldProps) {
  const value = useFormEditorStore((s) => s.values[field.id] ?? "");
  const setValue = useFormEditorStore((s) => s.setValue);

  const handleChange = (next: string) => {
    setValue(field.id, next);
    // Clear the LLC letter input when switching away from LLC.
    if (next !== "llc") {
      useFormEditorStore.getState().setValue("f1_03", "");
    }
    // Clear the "Other" description when switching away from Other.
    if (next !== "other") {
      useFormEditorStore.getState().setValue("f1_04", "");
    }
  };

  if (mode === "overlay") {
    if (!page) return null;

    return (
      <>
        {field.options?.map((opt) => {
          if (!opt.rect) return null;
          const css = pdfRectToCss(opt.rect, page);
          const isChecked = value === opt.id;

          return (
            <button
              key={opt.id}
              aria-checked={isChecked}
              aria-label={opt.label}
              className={`pointer-events-auto absolute flex items-center justify-center border border-transparent outline-none transition-colors hover:bg-yellow-100/40 focus:border-[var(--color-accent)] ${
                isChecked ? "bg-yellow-100/40" : "bg-transparent"
              }`}
              role="radio"
              style={{
                height: css.height,
                left: css.left,
                top: css.top,
                width: css.width,
              }}
              type="button"
              onClick={() => handleChange(opt.id)}
            >
              {isChecked ? (
                <span className="text-[11px] font-bold leading-none text-black">
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs font-medium text-default-700 dark:text-default-300">
        {field.label}
      </Label>
      <RadioGroup
        aria-label={field.label}
        className="flex flex-col gap-1.5"
        value={value}
        onChange={handleChange}
      >
        {field.options?.map((opt) => (
          <Radio key={opt.id} value={opt.id}>
            <span className="text-sm">{opt.label}</span>
          </Radio>
        ))}
      </RadioGroup>
    </div>
  );
}
