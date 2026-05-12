import {
  Delete02Icon,
  FileExportIcon,
  FileUnlockedIcon,
  Layout03Icon,
  LockKeyIcon,
  RotateLeft01Icon,
  Scissor01Icon,
  TextFontIcon,
} from "@hugeicons/core-free-icons";

import { ROUTES } from "@/lib/shared/constants/routes";

export const HOME_TOOL_GRID_SECTION_ID = "pdf-tools";

export const HOME_TOOL_GRID_HEADING_PREFIX = "Everything you need for";

export const HOME_TOOL_GRID_HEADING_ACCENT = "PDF";

export const HOME_TOOL_GRID_SUBTITLE =
  "Professional PDF tools built for speed, simplicity, and security.";

export const HOME_TOOL_GRID_BADGE_SUFFIX = "PDF Tools";

const PDF_TOOLS_HUB = `${ROUTES.PUBLIC.HOME}#pdf-tools`;

export type HomeToolCardIcon =
  | typeof Delete02Icon
  | typeof FileExportIcon
  | typeof FileUnlockedIcon
  | typeof Layout03Icon
  | typeof LockKeyIcon
  | typeof RotateLeft01Icon
  | typeof Scissor01Icon
  | typeof TextFontIcon;

export type HomeToolCard = {
  description: string;
  href: string;
  icon: HomeToolCardIcon;
  title: string;
};

function hrefForPdfToFormatTitle(title: string): string {
  if (title === "PDF to DOC" || title === "PDF to DOCX") {
    return ROUTES.TOOLS.PDF_TO_DOC;
  }

  if (title === "PDF to XLS" || title === "PDF to XLSX") {
    return ROUTES.TOOLS.PDF_TO_EXCEL;
  }

  return PDF_TOOLS_HUB;
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
  "PDF to ODD",
  "PDF to OEB",
  "PDF to PDB",
  "PDF to PNG",
  "PDF to PPT",
  "PDF to PPTX",
  "PDF to PS",
  "PDF to PSD",
  "PDF to RTF",
  "PDF to SVG",
  "PDF to TIFF",
  "PDF to TXT",
  "PDF to WEBP",
  "PDF to WMF",
  "PDF to XLS",
  "PDF to XLSX",
] as const;

const PDF_TO_FORMAT_CARDS: HomeToolCard[] = PDF_TO_FORMAT_TITLES.map(
  (title) => {
    const format = title.replace(/^PDF to /, "");

    return {
      description: `Export your PDF to ${format} for sharing, editing, or publishing in other apps.`,
      href: hrefForPdfToFormatTitle(title),
      icon: FileExportIcon,
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
    description:
      "Turn PDFs into spreadsheets, Word docs, and more — starting with Excel.",
    href: ROUTES.TOOLS.PDF_TO_EXCEL,
    icon: FileExportIcon,
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
    href: ROUTES.TOOLS.PDF_EDITOR,
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

/** Row-major order: read down each column in a 3-column grid. */
export const HOME_TOOL_GRID_TOOL_CARDS: HomeToolCard[] = [
  ...HOME_TOOL_GRID_PRIMARY_CARDS,
  ...PDF_TO_FORMAT_CARDS,
];
