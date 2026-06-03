/**
 * Mirrors the backend's `src/pdf-tools/dto/compress.request.dto.ts`. Keep the
 * preset string union in sync with the `CompressPreset` enum on the server —
 * `class-validator` will reject unknown values with a 400 at runtime.
 */
export const COMPRESS_PRESETS = [
  "high",
  "balanced",
  "light",
  "custom",
] as const;

export type CompressPreset = (typeof COMPRESS_PRESETS)[number];

export type CompressFileInput = {
  file: File;
  preset: CompressPreset;
  /** Required when `preset === "custom"`. At least one of these must be set. */
  quality?: number;
  maxImageDpi?: number;
  grayscale?: boolean;
  signal?: AbortSignal;
};

export type CompressFileResult = {
  blob: Blob;
  fileName: string;
};
