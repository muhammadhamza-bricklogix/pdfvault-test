import type { PendingConversionStatus } from "@/lib/client/stores/pending-conversions-store";
import type { Document } from "@/lib/shared/types/documents.types";

import { formatFileSize } from "@/lib/shared/utils/file-upload.utils";

export type PvFileType = "PDF" | "DOC" | "DOCX" | "PPTX" | "XLS" | "XLSX";

export interface PvFileRow {
  id: string;
  /** Null for placeholder rows backed by a `PendingConversion` in the
   *  Zustand store (the doc row doesn't exist server-side yet). */
  doc: Document | null;
  name: string;
  displaySize: string;
  type: PvFileType;
  uploadedByName: string;
  uploadedByEmail: string;
  uploadedByAvatar: string | null;
  uploadDate: string;
  fileSize: string;
  /** Present only on placeholder rows. Drives the "Preparing your
   *  document…" loader and disables all row actions until the backing
   *  conversion resolves. */
  pending?: {
    status: PendingConversionStatus;
    errorMessage?: string;
  };
}

const TYPE_BY_EXT: Record<string, PvFileType> = {
  pdf: "PDF",
  doc: "DOC",
  docx: "DOCX",
  ppt: "PPTX",
  pptx: "PPTX",
  xls: "XLS",
  xlsx: "XLSX",
};

function extension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

/** Maps a backend `Document` into the row shape the table renders. */
export function documentToFileRow(
  doc: Document,
  uploader: {
    name: string;
    email: string;
    avatarUrl: string | null;
  },
): PvFileRow {
  const size = formatFileSize(doc.sizeBytes);
  const uploadDate = new Date(doc.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return {
    id: doc.id,
    doc,
    name: doc.filename,
    displaySize: size,
    type: TYPE_BY_EXT[extension(doc.filename)] ?? "PDF",
    uploadedByName: uploader.name,
    uploadedByEmail: uploader.email,
    uploadedByAvatar: uploader.avatarUrl,
    uploadDate,
    fileSize: size,
  };
}

/**
 * Placeholder row for an in-flight X→PDF conversion. Renders the
 * "Preparing your document…" state at the top of the file table until
 * `runPendingConversion` resolves and the real backend row lands via
 * the next `useDocumentsQuery` refetch.
 */
export function pendingConversionToFileRow(
  pending: {
    tempId: string;
    filename: string;
    sizeBytes: number;
    status: PendingConversionStatus;
    errorMessage?: string;
    startedAt: number;
  },
  uploader: {
    name: string;
    email: string;
    avatarUrl: string | null;
  },
): PvFileRow {
  const size = formatFileSize(pending.sizeBytes);
  const uploadDate = new Date(pending.startedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return {
    id: `pending:${pending.tempId}`,
    doc: null,
    name: pending.filename,
    displaySize: size,
    type: "PDF",
    uploadedByName: uploader.name,
    uploadedByEmail: uploader.email,
    uploadedByAvatar: uploader.avatarUrl,
    uploadDate,
    fileSize: size,
    pending: {
      status: pending.status,
      errorMessage: pending.errorMessage,
    },
  };
}
