export interface ConvertRoute {
  title: string;
  description: string;
}

/**
 * Slug → title/description for every file-conversion tool. Consumed by the
 * `/convert/[slug]` route and by the landing-tools data so tool tiles in the
 * grid deep-link straight to the upload UI with the right heading.
 */
export const CONVERT_ROUTES: Record<string, ConvertRoute> = {
  "word-to-pdf": {
    title: "Convert Word to PDF",
    description:
      "Upload a .doc or .docx and get a clean PDF ready to sign or share.",
  },
  "png-to-pdf": {
    title: "Convert PNG to PDF",
    description:
      "Drop one or more PNGs and we'll bundle them into a single PDF.",
  },
  "jpg-to-pdf": {
    title: "Convert JPG to PDF",
    description: "Turn JPG photos or scans into a single, tidy PDF.",
  },
  "excel-to-pdf": {
    title: "Convert Excel to PDF",
    description:
      "Upload an .xls or .xlsx and get a print-ready PDF with your formatting intact.",
  },
  "powerpoint-to-pdf": {
    title: "Convert PowerPoint to PDF",
    description:
      "Turn .ppt or .pptx decks into shareable PDF slides in seconds.",
  },
  "txt-to-pdf": {
    title: "Convert TXT to PDF",
    description: "Wrap a plain-text file in a formatted, page-ready PDF.",
  },
  "any-to-pdf": {
    title: "Convert any format to PDF",
    description:
      "Drop any supported document and we'll convert it to PDF for you.",
  },
  "pdf-to-word": {
    title: "Convert PDF to Word",
    description:
      "Turn a PDF into an editable .docx so you can keep working in Word.",
  },
  "pdf-to-png": {
    title: "Convert PDF to PNG",
    description: "Export every page of a PDF as a high-quality PNG image.",
  },
  "pdf-to-jpg": {
    title: "Convert PDF to JPG",
    description: "Export every page of a PDF as a JPG image.",
  },
  "pdf-to-excel": {
    title: "Convert PDF to Excel",
    description:
      "Pull tables out of a PDF and drop them into a ready-to-edit Excel file.",
  },
  "pdf-to-powerpoint": {
    title: "Convert PDF to PowerPoint",
    description:
      "Turn a PDF into an editable .pptx deck with each page as its own slide.",
  },
  "pdf-to-any": {
    title: "Convert PDF to any format",
    description:
      "Pick your target format after uploading — Word, Excel, images, and more.",
  },
};
