import type { ValidationResult } from "@/lib/shared/types/file-upload.types";

/**
 * Upload size ceiling shared by every PDF-upload surface (dashboard
 * "Upload PDF" button, editor drop-zone, cloud picker, etc.). The cap
 * is enforced client-side so the user gets immediate feedback instead
 * of waiting for the multi-minute upload of a 500 MB PDF to fail at
 * the backend.
 */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB

const DEFAULT_MAX_SIZE = MAX_UPLOAD_BYTES;

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
