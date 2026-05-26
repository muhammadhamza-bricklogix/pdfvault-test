import type { ConversionType } from "@/lib/shared/types/conversion.types";

export type ToolConfig = {
  /** Accepted MIME types for the file input. */
  accept: string[];
  /** Human-readable label for the accepted format, e.g. "PDF" or "Word". */
  acceptLabel: string;
  /** Backend `ConversionType` enum value; absent for editor-entry-point tools. */
  conversionType?: ConversionType;
  /** Marketing description shown on the tool page. */
  description: string;
  /** Output format extension without leading dot, e.g. "docx". */
  outputFormat: string;
  /** URL slug — also used as the route under `/tools/<slug>`. */
  slug: string;
  /** Page title shown in `<h1>` and `<title>`. */
  title: string;
};

/** Format → friendly title fragment. Used to build descriptions consistently. */
const FORMAT_LABELS: Record<string, string> = {
  avif: "AVIF image",
  azw3: "AZW3 ebook",
  bmp: "BMP image",
  doc: "Word document",
  docx: "Word document",
  dxf: "DXF drawing",
  emf: "EMF graphic",
  eps: "EPS graphic",
  epub: "EPUB ebook",
  gif: "GIF image",
  html: "HTML page",
  ico: "ICO icon",
  jpg: "JPG image",
  lrf: "LRF ebook",
  md: "Markdown",
  mobi: "MOBI ebook",
  oeb: "OEB ebook",
  pdb: "PDB ebook",
  pdf: "PDF",
  png: "PNG image",
  ppt: "PowerPoint",
  pptx: "PowerPoint",
  ps: "PostScript",
  psd: "Photoshop file",
  rtf: "RTF document",
  svg: "SVG graphic",
  tiff: "TIFF image",
  txt: "plain text",
  webp: "WebP image",
  wmf: "WMF graphic",
  xls: "Excel spreadsheet",
  xlsx: "Excel spreadsheet",
};

const PDF_ACCEPT = {
  accept: ["application/pdf"],
  acceptLabel: "PDF",
} as const;

const PER_INPUT_ACCEPT: Record<
  string,
  { accept: string[]; acceptLabel: string }
> = {
  doc: {
    accept: ["application/msword"],
    acceptLabel: "Word (.doc)",
  },
  docx: {
    accept: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    acceptLabel: "Word (.docx)",
  },
  xls: {
    accept: ["application/vnd.ms-excel"],
    acceptLabel: "Excel (.xls)",
  },
  xlsx: {
    accept: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    acceptLabel: "Excel (.xlsx)",
  },
  pptx: {
    accept: [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    acceptLabel: "PowerPoint (.pptx)",
  },
  jpg: {
    accept: ["image/jpeg", "image/jpg"],
    acceptLabel: "JPG",
  },
  png: {
    accept: ["image/png"],
    acceptLabel: "PNG",
  },
};

const CONVERSION_TYPE_TO_TOOL: ConversionType[] = [
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
  "pptx_to_pdf",
  "jpg_to_pdf",
  "png_to_pdf",
];

function buildTool(type: ConversionType): ToolConfig {
  const [from, to] = type.split("_to_") as [string, string];
  const slug = `${from}-to-${to}`;
  const title = `${from.toUpperCase()} to ${to.toUpperCase()}`;
  const fromLabel = FORMAT_LABELS[from] ?? from.toUpperCase();
  const toLabel = FORMAT_LABELS[to] ?? to.toUpperCase();
  const input =
    from === "pdf" ? PDF_ACCEPT : (PER_INPUT_ACCEPT[from] ?? PDF_ACCEPT);

  return {
    accept: [...input.accept],
    acceptLabel: input.acceptLabel,
    conversionType: type,
    description: `Convert ${fromLabel} files into ${toLabel} format.`,
    outputFormat: to,
    slug,
    title,
  };
}

/**
 * Friendly slug aliases used by the backend tools catalog (e.g. "pdf-to-word"
 * instead of the CloudConvert-flavored "pdf-to-docx"). Each alias resolves to
 * the same ToolConfig as the canonical entry, so either URL lands on the same
 * page. Keep this in sync with the backend `TOOLS_CATALOG.route` values.
 */
const FRIENDLY_SLUG_ALIASES: Record<string, ConversionType> = {
  "pdf-to-word": "pdf_to_docx",
  "pdf-to-excel": "pdf_to_xlsx",
  "pdf-to-powerpoint": "pdf_to_pptx",
  "word-to-pdf": "docx_to_pdf",
  "excel-to-pdf": "xlsx_to_pdf",
  "powerpoint-to-pdf": "pptx_to_pdf",
  "pdf-to-text": "pdf_to_txt",
};

const canonicalToolEntries = CONVERSION_TYPE_TO_TOOL.map((type) => {
  const tool = buildTool(type);

  return [tool.slug, tool] as const;
});

const aliasToolEntries = Object.entries(FRIENDLY_SLUG_ALIASES).map(
  ([friendlySlug, type]) => {
    const canonical = buildTool(type);

    // Reuse the canonical config but override the slug so the page renders
    // with the URL the user actually visited.
    return [friendlySlug, { ...canonical, slug: friendlySlug }] as const;
  },
);

export const TOOLS: Record<string, ToolConfig> = Object.fromEntries([
  ...canonicalToolEntries,
  ...aliasToolEntries,
]);

/** Slug rule used by URL routing + home-grid hrefs + this file's tool map. */
export function conversionTypeToSlug(type: ConversionType): string {
  return type.replace(/_/g, "-");
}
