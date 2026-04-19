import type { ValidationResult } from "@/lib/shared/types/file-upload.types";

const DEFAULT_MAX_SIZE = 100 * 1024 * 1024; // 100 MB

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateFile(
  file: File,
  accept: string[],
  maxSize: number = DEFAULT_MAX_SIZE,
): ValidationResult {
  if (accept.length > 0 && !accept.includes(file.type)) {
    return { valid: false, error: "File type not supported." };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File exceeds ${formatFileSize(maxSize)} limit.`,
    };
  }

  return { valid: true };
}
