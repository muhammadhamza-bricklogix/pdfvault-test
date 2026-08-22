import type { FormField } from "@/lib/shared/types/forms.types";

/**
 * Simple equality-based `showIf` evaluation. A field is visible when:
 *   - no `showIf` rule is defined, OR
 *   - every key in `showIf` matches the value currently stored for that
 *     dependent field.
 *
 * Kept dumb on purpose — we don't need OR/AND/NOT yet.
 */
export function fieldIsVisible(
  field: FormField,
  values: Record<string, string>,
): boolean {
  if (!field.showIf) return true;

  return Object.entries(field.showIf).every(
    ([key, expected]) => values[key] === expected,
  );
}
