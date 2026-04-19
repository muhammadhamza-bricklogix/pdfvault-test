export type FileUploadProps = {
  /** Accepted MIME types, e.g. ["application/pdf"] */
  accept: string[];
  /** Human-readable format label, e.g. "PDF" */
  acceptLabel: string;
  /** Subtext below the heading */
  description?: string;
  /** Currently selected file (controlled) */
  file?: File | null;
  /** Heading text inside the dropzone */
  heading?: string;
  /** Max file size in bytes (default: 100 MB) */
  maxSize?: number;
  /** Called when the selected file is cleared */
  onFileClear?: () => void;
  /** Called when a valid file is selected or dropped */
  onFileSelect: (file: File) => void;
};

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };
