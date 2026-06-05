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

/**
 * Mirrors backend `EncryptKeyLength`. The wire values are qpdf's `--encrypt N`
 * argument — `"128"` means RC4-128 (PDF 1.4, legacy compatibility) and
 * `"256"` means AES-256 (PDF 1.7+, the modern default).
 */
export const ENCRYPT_KEY_LENGTHS = ["128", "256"] as const;
export type EncryptKeyLength = (typeof ENCRYPT_KEY_LENGTHS)[number];

export type EncryptFileInput = {
  file: File;
  userPassword: string;
  ownerPassword?: string;
  keyLength: EncryptKeyLength;
  signal?: AbortSignal;
};

export type DecryptFileInput = {
  file: File;
  password: string;
  signal?: AbortSignal;
};

export type PdfToolBlobResult = {
  blob: Blob;
  fileName: string;
};

export type FlattenFileInput = { file: File; signal?: AbortSignal };

export type ExtractImagesFileInput = { file: File; signal?: AbortSignal };

export type ExtractImagesResult = {
  blob: Blob;
  fileName: string;
};
