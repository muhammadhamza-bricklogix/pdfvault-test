"use client";

import type { FieldProps } from "./types";

import {
  FieldError,
  Input,
  Label,
  TextField as HeroTextField,
} from "@heroui/react";

import { useFormEditorStore } from "@/lib/client/stores";

import { pdfRectToCss } from "./types";

export function TextField({ field, mode, page }: FieldProps) {
  const value = useFormEditorStore((s) => s.values[field.id] ?? "");
  const error = useFormEditorStore((s) => s.errors[field.id]);
  const setValue = useFormEditorStore((s) => s.setValue);

  if (mode === "overlay") {
    if (!page) return null;

    const css = pdfRectToCss(field.rect, page);

    return (
      <input
        aria-invalid={Boolean(error)}
        aria-label={field.label}
        autoComplete="off"
        className="pointer-events-auto absolute rounded-[2px] border border-transparent bg-white/0 px-1 text-[12px] leading-none text-black caret-[var(--color-accent)] outline-none transition-shadow focus:border-[var(--color-accent)] focus:bg-yellow-100/30 focus:shadow-[0_0_0_2px_color-mix(in_oklab,var(--color-accent)_30%,transparent)] aria-[invalid=true]:border-danger-500"
        id={`field-input-${field.id}`}
        maxLength={field.maxLength}
        style={{
          fontSize: Math.max(css.height * 0.65, 10),
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
