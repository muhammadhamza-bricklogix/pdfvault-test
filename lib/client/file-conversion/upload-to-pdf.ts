"use client";

import type { ConversionType } from "@/lib/shared/types/conversion.types";

import { conversionService } from "@/lib/shared/api/services/conversion.service";

// GIF / HTML / TXT / Excel / PowerPoint mappings commented out 2026-08-29
// (PM: PDF/Word/PNG/JPG only). Kept in place — uncomment to re-enable.
const EXT_TO_CONVERSION: Record<string, ConversionType> = {
  doc: "doc_to_pdf",
  docx: "docx_to_pdf",
  // gif: "gif_to_pdf",
  // htm: "html_to_pdf",
  // html: "html_to_pdf",
  jpeg: "jpg_to_pdf",
  jpg: "jpg_to_pdf",
  png: "png_to_pdf",
  // ppt: "ppt_to_pdf",
  // pptx: "pptx_to_pdf",
  // txt: "txt_to_pdf",
  // xls: "xls_to_pdf",
  // xlsx: "xlsx_to_pdf",
};

const UNSUPPORTED_EXTENSIONS = new Set(["bmp"]);

// Excel / PowerPoint / GIF / HTML / TXT mime types commented out
// 2026-08-29 (PM: PDF/Word/PNG/JPG only). Restore to re-enable.
export const UPLOAD_ACCEPT_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  // "application/vnd.ms-excel",
  // "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // "application/vnd.ms-powerpoint",
  // "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  // "image/gif",
  // "text/html",
  // "text/plain",
];

function getExtension(file: File): string {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

export function isPdf(file: File): boolean {
  return file.type === "application/pdf" || getExtension(file) === "pdf";
}

/**
 * Confirm the file's byte content actually starts with a `%PDF-` header
 * before we hand it to the editor. Extension + MIME can lie (a renamed
 * .txt is happily accepted by the OS as `application/pdf`), and the
 * editor's downstream error state is a dead-end — much friendlier to
 * reject at the dropzone with an inline message.
 *
 * PDFs allow up to 1024 leading bytes of garbage before `%PDF-` per the
 * spec, but the vast majority of real files start with it in the first
 * few bytes. Reading 1024 keeps the check cheap while covering the
 * spec-legal window.
 */
export async function looksLikePdfBytes(file: File): Promise<boolean> {
  try {
    const slice = file.slice(0, 1024);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    // "%PDF-" = 0x25 0x50 0x44 0x46 0x2D
    const needle = [0x25, 0x50, 0x44, 0x46, 0x2d];

    for (let i = 0; i <= bytes.length - needle.length; i++) {
      let match = true;

      for (let j = 0; j < needle.length; j++) {
        if (bytes[i + j] !== needle[j]) {
          match = false;
          break;
        }
      }
      if (match) return true;
    }

    return false;
  } catch {
    // If we can't even read the first bytes, treat as invalid.
    return false;
  }
}

export interface UploadAsPdfOptions {
  /**
   * @deprecated 2026-09-08 — kept for callsite compatibility but no
   * longer read. X→PDF conversion is now always paywall-free per the
   * "convert + edit are free, pay only at download" product rule.
   * `uploadAsPdf` always uses `convertPreview` internally.
   */
  bypassPaywallGate?: boolean;
}

/**
 * Routes non-PDF uploads through the backend conversion endpoint and returns
 * a PDF File ready to load into the editor. PDFs pass straight through.
 * Throws a user-facing Error for formats that don't have a backend converter
 * yet — callers should surface the message via toast.
 *
 * QA 2026-09-08: always uses `convertPreview` (bypasses the client-side
 * `/conversion` paywall pre-flight gate) because X→PDF conversion is a
 * FREE operation for every user tier — guest, signed-in-non-entitled,
 * and signed-in-entitled. The paywall for X→PDF flows fires later in
 * the user journey at Download-time via `useExportEditor` (Done →
 * Download in the editor). Backend `/conversion` is `@Public()` so
 * neither auth nor entitlement is enforced server-side either — the
 * whole X→PDF path is anonymous-friendly.
 *
 * PDF→X conversions go through the same backend endpoint but ARE gated
 * at the Download trigger by `useExportEditor` (auth-chain items 1-4),
 * NOT by this helper.
 */
export async function uploadAsPdf(
  file: File,
  _options?: UploadAsPdfOptions,
): Promise<File> {
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

  const result = await conversionService.convertPreview({ file, type });
  const baseName = file.name.replace(/\.[^.]+$/, "") || "document";
  const arrayBuffer = await result.blob.arrayBuffer();

  const pdfFile = new File([arrayBuffer], `${baseName}.pdf`, {
    type: "application/pdf",
  }) as File & { __createdFromImage?: boolean };

  // Row 73/79: image-to-PDF (jpg_to_pdf / png_to_pdf) produces a PDF
  // whose page is a rasterised image — there is no editable text layer
  // by design. Tag the resulting File so `use-edit-text-mode` can
  // suppress the "No editable text found" info toast for this flow;
  // the toast is accurate for scanned PDFs but misleading when the
  // user explicitly asked for an image → PDF conversion.
  if (type === "jpg_to_pdf" || type === "png_to_pdf") {
    pdfFile.__createdFromImage = true;
  }

  return pdfFile;
}
