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

/**
 * Convert MM/DD/YYYY → ISO YYYY-MM-DD for the underlying `<input type=date>`.
 * Returns null when the parts are incomplete.
 */
function displayToIso(display: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);

  if (!m) return null;

  return `${m[3]}-${m[1]}-${m[2]}`;
}

function isoToDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);

  if (!m) return "";

  return `${m[2]}/${m[3]}/${m[1]}`;
}

export function DateField({ field, mode, page }: FieldProps) {
  // Store holds the user-facing display string (MM/DD/YYYY) so validation
  // and PDF stamping read the same shape.
  const value = useFormEditorStore((s) => s.values[field.id] ?? "");
  const error = useFormEditorStore((s) => s.errors[field.id]);
  const setValue = useFormEditorStore((s) => s.setValue);

  const isoValue = displayToIso(value) ?? "";

  const handleIsoChange = (iso: string) => {
    setValue(field.id, isoToDisplay(iso));
  };

  if (mode === "overlay") {
    if (!page) return null;

    const css = pdfRectToCss(field.rect, page);
    const hasValue = Boolean(isoValue);
    const fontSize = Math.max(css.height * 0.55, 11);

    // Two-layer strategy so the picked date is ALWAYS legible:
    //
    //   1. Transparent-text `<input type="date">` (positioned + sized to
    //      the field rect) captures click → opens the native picker, and
    //      stores the value in the store. `text-transparent` + hidden
    //      `::-webkit-calendar-picker-indicator` (global rule below)
    //      keep the native placeholder + picker icon from stealing
    //      horizontal space — otherwise the calendar icon eats ~20px
    //      of the overlay width and long dates get clipped to "Feb…".
    //
    //   2. A read-only <span> painted on top renders the formatted
    //      `MM/DD/YYYY` string (or the placeholder) so the visible
    //      value matches `values[field.id]` exactly, regardless of the
    //      browser's locale-dependent `input[type=date]` render.
    //      `pointer-events: none` on the span lets the input underneath
    //      still receive clicks.
    return (
      <div
        className="pointer-events-none absolute"
        style={{
          height: css.height,
          left: css.left,
          top: css.top,
          width: css.width,
        }}
      >
        <input
          aria-invalid={Boolean(error)}
          aria-label={field.label}
          className="pointer-events-auto absolute inset-0 h-full w-full rounded-[2px] border border-yellow-500/40 bg-yellow-100/50 px-1 text-transparent caret-[var(--color-accent)] outline-none transition-colors hover:bg-yellow-100/70 focus:border-[var(--color-accent)] focus:bg-yellow-100/80 aria-[invalid=true]:border-danger-500 [&::-webkit-calendar-picker-indicator]:pointer-events-auto [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
          style={{ fontSize }}
          type="date"
          value={isoValue}
          onChange={(e) => handleIsoChange(e.target.value)}
        />
        <span
          className={`pointer-events-none absolute inset-0 flex items-center justify-center px-1 leading-none tabular-nums ${
            hasValue ? "text-black" : "italic text-black/55"
          }`}
          style={{ fontSize }}
        >
          {hasValue ? value : "MM/DD/YYYY"}
        </span>
      </div>
    );
  }

  return (
    <HeroTextField isInvalid={Boolean(error)} name={field.id}>
      <Label className="text-xs font-medium text-default-700 dark:text-default-300">
        {field.label}
      </Label>
      <Input
        id={`sidebar-${field.id}`}
        type="date"
        value={isoValue}
        onChange={(e) => handleIsoChange(e.target.value)}
      />
      <p className="text-[11px] text-default-500">
        Display: {value || "MM/DD/YYYY"}
      </p>
      {error ? <FieldError>{error}</FieldError> : null}
    </HeroTextField>
  );
}
