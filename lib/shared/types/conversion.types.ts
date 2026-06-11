/**
 * Mirror of the backend NestJS `ConversionType` enum
 * (src/conversion/interfaces/index.ts). Keep these strings in sync.
 *
 * The backend rejects unknown enum values with `class-validator`, so any
 * drift here surfaces as a 400 at runtime.
 */
export const CONVERSION_TYPES = [
  "pdf_to_avif",
  "pdf_to_azw3",
  "pdf_to_bmp",
  "pdf_to_doc",
  "pdf_to_docx",
  "pdf_to_dxf",
  "pdf_to_emf",
  "pdf_to_eps",
  "pdf_to_epub",
  "pdf_to_gif",
  "pdf_to_html",
  "pdf_to_ico",
  "pdf_to_jpg",
  "pdf_to_lrf",
  "pdf_to_md",
  "pdf_to_mobi",
  "pdf_to_oeb",
  "pdf_to_pdb",
  "pdf_to_png",
  "pdf_to_ppt",
  "pdf_to_pptx",
  "pdf_to_ps",
  "pdf_to_psd",
  "pdf_to_rtf",
  "pdf_to_svg",
  "pdf_to_tiff",
  "pdf_to_txt",
  "pdf_to_webp",
  "pdf_to_wmf",
  "pdf_to_xls",
  "pdf_to_xlsx",
  "doc_to_pdf",
  "docx_to_pdf",
  "xls_to_pdf",
  "xlsx_to_pdf",
  "ppt_to_pdf",
  "pptx_to_pdf",
  "jpg_to_pdf",
  "png_to_pdf",
  "gif_to_pdf",
  "html_to_pdf",
  "txt_to_pdf",
] as const;

export type ConversionType = (typeof CONVERSION_TYPES)[number];

export type ConvertFileInput = {
  file: File;
  type: ConversionType;
  signal?: AbortSignal;
};

export type ConvertFileResult = {
  blob: Blob;
  fileName: string;
};
