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

    // The native `<input type="date">` paints a placeholder ("dd/mm/yyyy" or
    // "mm/dd/yyyy" depending on locale) over the form when empty. Hide that
    // placeholder by transparenting the text colour until the user picks a
    // date; the sidebar input drives most date entry anyway.
    return (
      <input
        aria-invalid={Boolean(error)}
        aria-label={field.label}
        className={`pointer-events-auto absolute rounded-[2px] border border-yellow-500/40 bg-yellow-100/50 px-1 text-[12px] caret-[var(--color-accent)] outline-none transition-colors hover:bg-yellow-100/70 focus:border-[var(--color-accent)] focus:bg-yellow-100/80 aria-[invalid=true]:border-danger-500 ${
          hasValue ? "text-black" : "text-transparent"
        }`}
        style={{
          fontSize: Math.max(css.height * 0.55, 10),
          height: css.height,
          left: css.left,
          top: css.top,
          width: css.width,
        }}
        type="date"
        value={isoValue}
        onChange={(e) => handleIsoChange(e.target.value)}
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
