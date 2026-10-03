"use client";

import type { FieldProps } from "./types";

import {
  FieldError,
  Input,
  Label,
  TextField as HeroTextField,
} from "@heroui/react";

import { useFormEditorStore } from "@/lib/client/stores";

import { overlayFontSize, pdfRectToCss } from "./types";

const BASE =
  "pointer-events-auto absolute rounded-[2px] border text-black caret-[var(--color-accent)] outline-none transition-colors focus:border-[var(--color-accent)] focus:shadow-[0_0_0_2px_color-mix(in_oklab,var(--color-accent)_30%,transparent)] aria-[invalid=true]:border-danger-500";

const TINT = {
  yellow:
    "border-yellow-500/40 bg-yellow-100/50 hover:bg-yellow-100/70 focus:bg-yellow-100/80",
  /**
   * For fields drawn over one of the IRS shaded blocks. Those print red on
   * Copy A, and a yellow wash over red reads as muddy peach, so these keep
   * the red and only brighten on hover and focus.
   */
  red: "border-red-400/60 bg-red-200/40 hover:bg-red-200/60 focus:bg-red-200/70",
} as const;

export function TextField({ field, mode, page }: FieldProps) {
  const value = useFormEditorStore((s) => s.values[field.id] ?? "");
  const error = useFormEditorStore((s) => s.errors[field.id]);
  const setValue = useFormEditorStore((s) => s.setValue);

  if (mode === "overlay") {
    if (!page) return null;

    const css = pdfRectToCss(field.rect, page);
    const tint = field.freeText ? TINT.red : TINT.yellow;

    if (field.multiline) {
      return (
        <textarea
          aria-invalid={Boolean(error)}
          aria-label={field.label}
          autoComplete="off"
          // overflow-hidden: a textarea whose content is taller than its box
          // grows a scrollbar, and the IRS name cells are short enough that
          // the arrows showed up over the printed form.
          className={`${BASE} ${tint} resize-none overflow-hidden p-1 leading-tight`}
          id={`field-input-${field.id}`}
          maxLength={field.maxLength}
          style={{
            fontSize: overlayFontSize(field.rect, css.scale, {
              maxPt: 13,
              override: field.overlayFontSize,
              ratio: 0.45,
            }),
            height: css.height,
            left: css.left,
            top: css.top,
            width: css.width,
          }}
          value={value}
          onChange={(e) => setValue(field.id, e.target.value)}
        />
      );
    }

    return (
      <input
        aria-invalid={Boolean(error)}
        aria-label={field.label}
        autoComplete="off"
        className={`${BASE} ${tint} px-1 leading-none`}
        id={`field-input-${field.id}`}
        maxLength={field.maxLength}
        style={{
          fontSize: overlayFontSize(field.rect, css.scale, {
            maxPt: 15,
            override: field.overlayFontSize,
            ratio: 0.95,
          }),
          height: css.height,
          left: css.left,
          top: css.top,
          width: css.width,
        }}
        type="text"
        value={value}
        onChange={(e) => setValue(field.id, e.target.value)}
      />
    );
  }

  return (
    <HeroTextField isInvalid={Boolean(error)} name={field.id}>
      <Label className="text-xs font-medium text-default-700 dark:text-default-300">
        {field.label}
      </Label>
      <Input
        id={`sidebar-${field.id}`}
        maxLength={field.maxLength}
        placeholder={field.helpText ?? " "}
        value={value}
        onChange={(e) => setValue(field.id, e.target.value)}
      />
      {error ? <FieldError>{error}</FieldError> : null}
    </HeroTextField>
  );
}
