"use client";

import type { FieldProps } from "./types";

import { Label } from "@heroui/react";

import { useFormEditorStore } from "@/lib/client/stores";

import { overlayFontSize, pdfRectToCss } from "./types";

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
              className={`pointer-events-auto absolute flex items-center justify-center rounded-[2px] border outline-none transition-colors focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--color-accent)_30%,transparent)] ${
                isChecked
                  ? "border-[var(--color-accent)]/60 bg-yellow-100/80 hover:bg-yellow-100/90"
                  : "border-yellow-500/40 bg-yellow-100/50 hover:bg-yellow-100/70"
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
                <span
                  className="font-bold leading-none text-black"
                  style={{
                    fontSize: overlayFontSize(opt.rect, css.scale, {
                      allowOverflow: true,
                      maxPt: 12,
                      ratio: 1.35,
                    }),
                  }}
                >
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </>
    );
  }

  // Sidebar: tick-box list (matches the PDF's checkbox visual). Semantics
  // stay radio — only one can be selected at a time. Rendering as boxes
  // instead of the default dot-in-circle so the on-screen affordance
  // mirrors what the user sees on the printed form.
  return (
    <div
      aria-label={field.label}
      className="flex flex-col gap-2"
      role="radiogroup"
    >
      <Label className="text-xs font-medium text-default-700 dark:text-default-300">
        {field.label}
      </Label>
      <div className="flex flex-col gap-1">
        {field.options?.map((opt) => {
          const isChecked = value === opt.id;

          return (
            <button
              key={opt.id}
              aria-checked={isChecked}
              className={`group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                isChecked
                  ? "bg-default-100 dark:bg-default-800"
                  : "hover:bg-default-50 dark:hover:bg-default-900"
              }`}
              role="radio"
              type="button"
              onClick={() => handleChange(opt.id)}
            >
              <span
                aria-hidden="true"
                className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                  isChecked
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                    : "border-default-400 bg-white dark:bg-default-950"
                }`}
              >
                {isChecked ? (
                  <span className="text-[11px] font-bold leading-none">✓</span>
                ) : null}
              </span>
              <span className="text-default-700 dark:text-default-300">
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
