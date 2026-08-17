import { z } from "zod";

const INVALID_CHARS = /[<>:"/\\|?*\x00-\x1f]/;
const MAX_FILENAME_LENGTH = 255;

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
