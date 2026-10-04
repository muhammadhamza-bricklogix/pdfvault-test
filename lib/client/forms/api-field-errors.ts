import type { FormSchema } from "@/lib/shared/types/forms.types";

export type ApiFieldError = { field: string; message: string };

/**
 * Pulls the per-field errors out of a 422 from the finalize endpoint, which
 * answers with `{ errors: [{ field, message }] }`. Without this the user only
 * sees "Some fields are invalid" and has no idea which ones.
 */
export function extractApiFieldErrors(err: unknown): ApiFieldError[] {
  const wrapper = err as { cause?: unknown; response?: { data?: unknown } };
  const axiosLike = (wrapper?.cause ?? wrapper) as {
    response?: { data?: unknown };
  };
  const data = axiosLike?.response?.data as { errors?: unknown } | undefined;

  if (!Array.isArray(data?.errors)) return [];

  return (data.errors as unknown[]).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { field, message } = entry as { field?: unknown; message?: unknown };

    if (typeof field !== "string" || typeof message !== "string") return [];

    return [{ field, message }];
  });
}

/** Maps backend field keys to the labels the user actually sees. */
export function labelFieldErrors(
  errors: ApiFieldError[],
  schema: FormSchema,
): Record<string, string> {
  const labels = new Map(
    schema.sections
      .flatMap((section) => section.fields)
      .map((field) => [field.id, field.label]),
  );

  return Object.fromEntries(
    errors.map(({ field, message }) => [
      field,
      labels.has(field) ? `${labels.get(field)}: ${message}` : message,
    ]),
  );
}

export function describeFieldErrors(labelled: Record<string, string>): string {
  const entries = Object.values(labelled);

  if (entries.length === 0) return "Please review your entries and try again.";
  if (entries.length === 1) return entries[0]!;

  return `${entries.length} fields need attention — the first is: ${entries[0]}`;
}
