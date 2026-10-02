import type { ExportFormat } from "@/lib/client/hooks/pdf-editor/use-export-editor";

export interface ConvertRoute {
  title: string;
  description: string;
  /**
   * Optional marketing H1 shown on `/convert/[slug]`. When set, overrides
   * `title` for the hero only — meta title + dashboard pending-conversion
   * banner continue to use `title` so SEO + resume-flow copy stay stable.
   */
  heroTitle?: string;
  /** Optional marketing subhead for `/convert/[slug]`; overrides `description` for the hero only. */
  heroSubtitle?: string;
  /** File extensions the picker should accept (without leading dot). */
  accept: string[];
  /**
   * When set, the editor auto-fires an export in this format once the file
   * has loaded. Used by the /convert/pdf-to-<x> family — the visitor uploads
   * a PDF and immediately gets the target-format download.
   */
  exportFormat?: ExportFormat;
}

/**
 * Slug → title/description/accept/exportFormat for every file-conversion
 * tool. Consumed by the `/convert/[slug]` route to drive both the accept
 * filter on the picker and the auto-export step on `/pdf-composer`.
 */
export const CONVERT_ROUTES: Record<string, ConvertRoute> = {
  // ── Convert TO PDF ────────────────────────────────────────────────────────
  // Generic X→PDF entrypoint. The accept list mirrors EXT_TO_CONVERSION in
  // `lib/client/file-conversion/upload-to-pdf.ts` — every extension the
  // backend converter supports. UploadWorkspace treats this as an X→PDF
  // convert route (no `exportFormat`) and routes each drop through the
  // pending-conversion runner + dashboard placeholder row (invariant #17).
  "file-to-pdf": {
    title: "Convert File to PDF",
    // Excel + PowerPoint hidden 2026-08-28 pending pipeline work.
    // GIF + HTML + TXT hidden 2026-08-29 (PM: PDF/Word/PNG/JPG only).
    // Re-enable by uncommenting the accept entries and restoring the
    // extension names to the description string below.
    description: "Supported formats: Word, JPG, PNG.",
    accept: [
      "doc",
      "docx",
      // "xls",
      // "xlsx",
      // "ppt",
      // "pptx",
      "jpg",
      "jpeg",
      "png",
      // "gif",
      // "html",
      // "htm",
      // "txt",
    ],
  },
  "word-to-pdf": {
    title: "Convert Word to PDF",
    description:
      "Upload a .doc or .docx and get a clean PDF ready to sign or share.",
    accept: ["doc", "docx"],
  },
  "png-to-pdf": {
    title: "Convert PNG to PDF",
    description:
      "Drop one or more PNGs and we'll bundle them into a single PDF.",
    accept: ["png"],
  },
  "jpg-to-pdf": {
    title: "Convert JPG to PDF",
    description: "Turn JPG photos or scans into a single, tidy PDF.",
    heroTitle: "Turn JPG into PDF Instantly",
    heroSubtitle:
      "Convert in seconds — then download your PDF as soon as it’s ready.",
    accept: ["jpg", "jpeg"],
  },
  "excel-to-pdf": {
    title: "Convert Excel to PDF",
    description:
      "Upload an .xls or .xlsx and get a print-ready PDF with your formatting intact.",
    accept: ["xls", "xlsx"],
  },
  "powerpoint-to-pdf": {
    title: "Convert PowerPoint to PDF",
    description:
      "Turn .ppt or .pptx decks into shareable PDF slides in seconds.",
    accept: ["ppt", "pptx"],
  },
  // txt-to-pdf hidden 2026-08-29 (PM: PDF/Word/PNG/JPG only). Restore
  // the entry (and its landing-tools tile) to re-enable.
  // "txt-to-pdf": {
  //   title: "Convert TXT to PDF",
  //   description: "Wrap a plain-text file in a formatted, page-ready PDF.",
  //   accept: ["txt"],
  // },

  // ── Convert FROM PDF ─────────────────────────────────────────────────────
  "pdf-to-word": {
    title: "Convert PDF to Word",
    description:
      "Turn a PDF into an editable .docx so you can keep working in Word.",
    heroTitle: "Convert PDF to Word in Seconds",
    heroSubtitle:
      "Convert in moments — then download your editable Word file right away.",
    accept: ["pdf"],
    exportFormat: "docx",
  },
  "pdf-to-png": {
    title: "Convert PDF to PNG",
    description: "Export every page of a PDF as a high-quality PNG image.",
    accept: ["pdf"],
    exportFormat: "png",
  },
  "pdf-to-jpg": {
    title: "Convert PDF to JPG",
    description: "Export every page of a PDF as a JPG image.",
    accept: ["pdf"],
    exportFormat: "jpg",
  },
  "pdf-to-excel": {
    title: "Convert PDF to Excel",
    description:
      "Pull tables out of a PDF and drop them into a ready-to-edit Excel file.",
    accept: ["pdf"],
    exportFormat: "xlsx",
  },
  "pdf-to-powerpoint": {
    title: "Convert PDF to PowerPoint",
    description:
      "Turn a PDF into an editable .pptx deck with each page as its own slide.",
    accept: ["pdf"],
    exportFormat: "pptx",
  },
  // pdf-to-html hidden 2026-08-29 (PM: PDF/Word/PNG/JPG only).
  // "pdf-to-html": {
  //   title: "Convert PDF to HTML",
  //   description:
  //     "Turn a PDF into a lightweight HTML page you can embed or edit.",
  //   accept: ["pdf"],
  //   exportFormat: "html",
  // },
  // pdf-to-text hidden 2026-08-29 (PM: PDF/Word/PNG/JPG only).
  // "pdf-to-text": {
  //   title: "Convert PDF to Plain Text",
  //   description:
  //     "Extract the raw text from a PDF as a plain .txt file, ready to reuse.",
  //   accept: ["pdf"],
  //   exportFormat: "txt",
  // },
};
