"use client";

import type { ConversionType } from "@/lib/shared/types/conversion.types";

import { conversionService } from "@/lib/shared/api/services/conversion.service";

const EXT_TO_CONVERSION: Record<string, ConversionType> = {
  doc: "doc_to_pdf",
  docx: "docx_to_pdf",
  gif: "gif_to_pdf",
  htm: "html_to_pdf",
  html: "html_to_pdf",
  jpeg: "jpg_to_pdf",
  jpg: "jpg_to_pdf",
  png: "png_to_pdf",
  ppt: "ppt_to_pdf",
  pptx: "pptx_to_pdf",
  txt: "txt_to_pdf",
  xls: "xls_to_pdf",
  xlsx: "xlsx_to_pdf",
};

const UNSUPPORTED_EXTENSIONS = new Set(["bmp"]);

export const UPLOAD_ACCEPT_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/gif",
  "text/html",
  "text/plain",
];

function getExtension(file: File): string {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

export function isPdf(file: File): boolean {
  return file.type === "application/pdf" || getExtension(file) === "pdf";
}

/**
 * Routes non-PDF uploads through the backend conversion endpoint and returns
 * a PDF File ready to load into the editor. PDFs pass straight through.
 * Throws a user-facing Error for formats that don't have a backend converter
 * yet — callers should surface the message via toast.
 */
export async function uploadAsPdf(file: File): Promise<File> {
  if (isPdf(file)) return file;

  const ext = getExtension(file);
  const type = EXT_TO_CONVERSION[ext];

  if (!type) {
    if (UNSUPPORTED_EXTENSIONS.has(ext)) {
      throw new Error(
        `${ext.toUpperCase()} files aren't supported yet. Please convert to PDF first.`,
      );
    }

    throw new Error("File type not supported.");
  }

  const result = await conversionService.convert({ file, type });
  const baseName = file.name.replace(/\.[^.]+$/, "") || "document";
  const arrayBuffer = await result.blob.arrayBuffer();

  return new File([arrayBuffer], `${baseName}.pdf`, {
    type: "application/pdf",
  });
}
