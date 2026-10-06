import { z } from "zod";

const INVALID_CHARS = /[<>:"/\\|?*\x00-\x1f]/;
const MAX_FILENAME_LENGTH = 255;

/** Product limit for a renamed file, counted without the `.pdf` extension. */
export const MAX_RENAME_NAME_LENGTH = 80;
const NAME_TOO_LONG = `Name must be ${MAX_RENAME_NAME_LENGTH} characters or fewer`;

export const renameFilenameSchema = z
  .string()
  .transform((v) => v.trim())
  .pipe(
    z
      .string()
      .min(1, "Name cannot be empty")
      .max(
        MAX_FILENAME_LENGTH,
        `Name must be ${MAX_FILENAME_LENGTH} characters or fewer`,
      )
      .refine(
        (v) => stripPdfExtension(v).trimEnd().length <= MAX_RENAME_NAME_LENGTH,
        { message: NAME_TOO_LONG },
      )
      .refine((v) => !INVALID_CHARS.test(v), {
        message: 'Name cannot contain < > : " / \\ | ? *',
      })
      .refine((v) => !v.endsWith(".") && !v.endsWith(" "), {
        message: "Name cannot end with a dot or space",
      }),
  );

export function validateRenameFilename(input: string): string | null {
  const result = renameFilenameSchema.safeParse(input);

  if (result.success) return null;

  return result.error.issues[0]?.message ?? "Invalid name";
}

/** Name part of a PDF filename, without a trailing `.pdf` (case-insensitive). */
export function stripPdfExtension(filename: string): string {
  return filename.replace(/\.pdf$/i, "");
}

/**
 * Validates the editable name part of a PDF rename (`.pdf` is appended by the
 * caller). Same rules as `validateRenameFilename`, plus a real name is required.
 */
export function validateRenameBaseName(input: string): string | null {
  const base = stripPdfExtension(input.trim()).trim();

  if (!base) return "Name cannot be empty";
  if (!/[\p{L}\p{N}]/u.test(base)) {
    return "Name must contain at least one letter or number";
  }
  if (base.length > MAX_RENAME_NAME_LENGTH) return NAME_TOO_LONG;

  return validateRenameFilename(base);
}
