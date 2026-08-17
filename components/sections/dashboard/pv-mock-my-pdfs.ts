import type { Document } from "@/lib/shared/types/documents.types";

import { formatFileSize } from "@/lib/shared/utils/file-upload.utils";

export type PvFileType = "PDF" | "DOC" | "DOCX" | "PPTX" | "XLS" | "XLSX";

export interface PvFileRow {
  id: string;
  doc: Document;
  name: string;
  displaySize: string;
  type: PvFileType;
  uploadedByName: string;
  uploadedByEmail: string;
  uploadedByAvatar: string | null;
  uploadDate: string;
  fileSize: string;
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
