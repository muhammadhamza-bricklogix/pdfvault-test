import {
  Add01Icon,
  ChartBarIncreasingIcon,
  Cursor01Icon,
  Delete02Icon,
  EraserIcon,
  File01Icon,
  FileExportIcon,
  FileUnlockedIcon,
  HighlighterIcon,
  Image01Icon,
  Layout03Icon,
  LockKeyIcon,
  PaintBrush01Icon,
  PaintBucketIcon,
  RedoIcon,
  RotateLeft01Icon,
  SaveMoneyDollarIcon,
  Scissor01Icon,
  ShapesIcon,
  SignatureIcon,
  TextFontIcon,
  UndoIcon,
} from "@hugeicons/core-free-icons";

import { ROUTES } from "@/lib/shared/constants/routes";

export const HOME_TOOL_GRID_SECTION_ID = "pdf-tools";

export const HOME_TOOL_GRID_HEADING_PREFIX = "Everything you need for";

export const HOME_TOOL_GRID_HEADING_ACCENT = "PDF";

export const HOME_TOOL_GRID_SUBTITLE =
  "Professional PDF tools built for speed, simplicity, and security.";

export const HOME_TOOL_GRID_BADGE_SUFFIX = "PDF Tools";

/** Icons allowed on home tool cards (pool for variety + typing). */
const HOME_TOOL_ICON_POOL = [
  TextFontIcon,
  FileExportIcon,
  File01Icon,
  Image01Icon,
  Layout03Icon,
  Scissor01Icon,
  LockKeyIcon,
  FileUnlockedIcon,
  RotateLeft01Icon,
  Delete02Icon,
  ShapesIcon,
  SignatureIcon,
  HighlighterIcon,
  PaintBrush01Icon,
  EraserIcon,
  Cursor01Icon,
  PaintBucketIcon,
  UndoIcon,
  RedoIcon,
  Add01Icon,
  ChartBarIncreasingIcon,
  SaveMoneyDollarIcon,
] as const;

export type HomeToolCardIcon = (typeof HOME_TOOL_ICON_POOL)[number];

export type HomeToolCard = {
  description: string;
  href: string;
  icon: HomeToolCardIcon;
  title: string;
};

function stringHash(value: string): number {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }

  return Math.abs(hash);
}

function iconForPdfToFormatTitle(title: string): HomeToolCardIcon {
  const index = stringHash(title) % HOME_TOOL_ICON_POOL.length;

  return HOME_TOOL_ICON_POOL[index]!;
}

function hrefForPdfToFormatTitle(title: string): string {
  // "PDF to DOCX" → "pdf-to-docx" → /tools/pdf-to-docx
  const slug = title.toLowerCase().replace(/\s+/g, "-");

  return ROUTES.TOOLS.BY_SLUG(slug);
}

const PDF_TO_FORMAT_TITLES = [
  "PDF to AVIF",
  "PDF to AZW3",
  "PDF to BMP",
  "PDF to DOC",
  "PDF to DOCX",
  "PDF to DXF",
  "PDF to EMF",
  "PDF to EPS",
  "PDF to EPUB",
  "PDF to GIF",
  "PDF to HTML",
  "PDF to ICO",
  "PDF to JPG",
  "PDF to LRF",
  "PDF to MD",
  "PDF to MOBI",
  "PDF to OEB",
  "PDF to PDB",
  "PDF to PNG",
  // Hidden 2026-08-28 — pending future work on PPT/XLSX pipelines.
  // Do not remove; re-add these entries when the conversions are ready.
  // "PDF to PPT",
  // "PDF to PPTX",
  "PDF to PS",
  "PDF to PSD",
  "PDF to RTF",
  "PDF to SVG",
  "PDF to TIFF",
  "PDF to TXT",
  "PDF to WEBP",
  "PDF to WMF",
  // "PDF to XLS",
  // "PDF to XLSX",
] as const;

const PDF_TO_FORMAT_CARDS: HomeToolCard[] = PDF_TO_FORMAT_TITLES.map(
  (title) => {
    const format = title.replace(/^PDF to /, "");

    return {
      description: `Export your PDF to ${format} for sharing, editing, or publishing in other apps.`,
      href: hrefForPdfToFormatTitle(title),
      icon: iconForPdfToFormatTitle(title),
      title,
    };
  },
);

const HOME_TOOL_GRID_PRIMARY_CARDS: HomeToolCard[] = [
  {
    description:
      "Revise text and objects inline with our full in-browser PDF workspace.",
    href: ROUTES.TOOLS.PDF_EDITOR,
    icon: TextFontIcon,
    title: "Edit PDF",
  },
  {
    description: "Turn PDFs into editable Word documents, images, and more.",
    href: ROUTES.TOOLS.PDF_TO_DOC,
    icon: ChartBarIncreasingIcon,
    title: "Convert Document",
  },
  {
    description:
      "Reorder, insert, and rotate thumbnails until the flow is right.",
    href: ROUTES.TOOLS.PDF_EDITOR,
    icon: Layout03Icon,
    title: "Organize Pages",
  },
  {
    description:
      "Pull out the pages you need or split a long file into lighter parts.",
    href: ROUTES.TOOLS.SPLIT_PDF,
    icon: Scissor01Icon,
    title: "Split & Extract Pages",
  },
  {
    description:
      "Lock your PDF with a password so only intended readers open it.",
    href: ROUTES.TOOLS.PDF_EDITOR,
    icon: LockKeyIcon,
    title: "Password Protect",
  },
  {
    description: "Remove encryption when you have the right credentials handy.",
    href: ROUTES.TOOLS.PDF_EDITOR,
    icon: FileUnlockedIcon,
    title: "Unlock PDF",
  },
  {
    description:
      "Fix upside-down scans or mixed-orientation bundles in seconds.",
    href: ROUTES.TOOLS.PDF_EDITOR,
    icon: RotateLeft01Icon,
    title: "Rotate Pages",
  },
  {
    description:
      "Drop extras, blanks, or outdated sections without re-exporting.",
    href: ROUTES.TOOLS.PDF_EDITOR,
    icon: Delete02Icon,
    title: "Delete Pages",
  },
];

const CONVERT_TO_PDF_CARDS: HomeToolCard[] = [
  {
    description: "Turn a Word document into a polished, shareable PDF.",
    href: ROUTES.TOOLS.DOC_TO_PDF,
    icon: File01Icon,
    title: "Word to PDF",
  },
  // Hidden 2026-08-28 — PPTX + Excel conversions parked pending future
  // work. Do not remove; re-enable once the pipelines are ready.
  // {
  //   description: "Export slides to PDF for handouts and archiving.",
  //   href: ROUTES.TOOLS.BY_SLUG("pptx-to-pdf"),
  //   icon: ShapesIcon,
  //   title: "PPTX to PDF",
  // },
  // {
  //   description: "Flatten spreadsheets to PDF for reporting and distribution.",
  //   href: ROUTES.TOOLS.EXCEL_TO_PDF,
  //   icon: ChartBarIncreasingIcon,
  //   title: "Excel to PDF",
  // },
  {
    description: "Combine raster images into a single lightweight PDF.",
    href: ROUTES.TOOLS.BY_SLUG("jpg-to-pdf"),
    icon: Image01Icon,
    title: "JPG to PDF",
  },
  {
    description: "Bundle lossless PNGs into one portable document.",
    href: ROUTES.TOOLS.BY_SLUG("png-to-pdf"),
    icon: PaintBucketIcon,
    title: "PNG to PDF",
  },
  // {
  //   description: "Browse every import path and conversion preset in one hub.",
  //   href: PDF_TOOLS_HUB,
  //   icon: Add01Icon,
  //   title: "View all",
  // },
];

// Tax forms — only the W-9 ships today. Other forms (W-4, 1099-NEC, W-7)
// will be added when they go live; placeholders intentionally omitted so
// the tab stays clean.
const TAX_FORMS_CARDS: HomeToolCard[] = [
  {
    description:
      "Get the latest IRS W-9 — fill it out, sign, and export a clean, printable PDF in minutes.",
    href: ROUTES.FORMS.W9_FORM,
    icon: File01Icon,
    title: "W-9 Form",
  },
];

export type HomeToolGridTabGroup = {
  cards: readonly HomeToolCard[];
  id: string;
  label: string;
};

export const HOME_TOOL_GRID_TAB_GROUPS: readonly HomeToolGridTabGroup[] = [
  {
    cards: HOME_TOOL_GRID_PRIMARY_CARDS,
    id: "edit-pdf",
    label: "Edit PDF",
  },
  {
    cards: PDF_TO_FORMAT_CARDS,
    id: "convert-from-pdf",
    label: "Convert from PDF",
  },
  {
    cards: CONVERT_TO_PDF_CARDS,
    id: "convert-to-pdf",
    label: "Convert to PDF",
  },
  {
    cards: TAX_FORMS_CARDS,
    id: "tax-forms",
    label: "Tax forms",
  },
];

export const HOME_TOOL_GRID_TOTAL_TOOL_COUNT = HOME_TOOL_GRID_TAB_GROUPS.reduce(
  (total, group) => total + group.cards.length,
  0,
);

/** Flat list (all tabs) for SEO or legacy consumers. */
export const HOME_TOOL_GRID_TOOL_CARDS: HomeToolCard[] =
  HOME_TOOL_GRID_TAB_GROUPS.flatMap((group) => [...group.cards]);
