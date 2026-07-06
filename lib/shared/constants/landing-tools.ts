import { ROUTES } from "./routes";

/**
 * Master catalog of every tool surfaced on `/all-tools`, one row per Figma
 * frame. Kept in one file so ordering, spellings, and future URL wiring are
 * reviewable in a single diff instead of spread across four column arrays.
 *
 * Icon variants:
 *   - `line`   : inline stroke SVG (matches the EDIT & SIGN + OTHERS columns)
 *   - `orange` : orange file badge with a format label (source → PDF)
 *   - `blue`   : blue PDF badge with a target format label (PDF → target)
 *
 * `label` is the visible name in the grid. `href` is where the row navigates;
 * tools that don't have a route yet stub to `#` so they render but no-op —
 * please replace with the real route as each tool ships instead of hiding
 * the row, so the catalog stays visually aligned with the Figma.
 */

export type LineIconId =
  | "editor"
  | "compress"
  | "organize"
  | "split"
  | "password"
  | "unlock"
  | "rotate"
  | "delete"
  | "hash"
  | "extract-images"
  | "crop"
  | "ocr"
  | "remove-annotations"
  | "repair"
  | "bookmarks"
  | "watermark";

export type BadgeVariant = "orange" | "blue";

export type LandingToolIcon =
  | { kind: "line"; id: LineIconId }
  | { kind: "badge"; variant: BadgeVariant; badge: string };

export interface LandingTool {
  label: string;
  icon: LandingToolIcon;
  href: string;
}

export interface LandingToolCategory {
  id: string;
  heading: string;
  tools: LandingTool[];
}

export const LANDING_TOOL_CATEGORIES: LandingToolCategory[] = [
  {
    id: "edit-sign",
    // Reference spells it "Edit & SIgn" — matches footer + Figma; kept
    // pixel-accurate. Flag to product if it should read "Edit & Sign".
    heading: "EDIT & SIgn",
    tools: [
      {
        label: "PDF Editor",
        icon: { kind: "line", id: "editor" },
        href: ROUTES.TOOLS.PDF_EDITOR,
      },
      {
        label: "Compress",
        icon: { kind: "line", id: "compress" },
        href: ROUTES.TOOLS.BY_SLUG("compress"),
      },
      {
        label: "Organize Pages",
        icon: { kind: "line", id: "organize" },
        href: ROUTES.TOOLS.BY_SLUG("organize"),
      },
      {
        label: "Split & Extract Pages",
        icon: { kind: "line", id: "split" },
        href: ROUTES.TOOLS.SPLIT_PDF,
      },
      {
        label: "Password Protect",
        icon: { kind: "line", id: "password" },
        href: ROUTES.TOOLS.BY_SLUG("protect"),
      },
      {
        label: "Unlock PDF",
        icon: { kind: "line", id: "unlock" },
        href: ROUTES.TOOLS.BY_SLUG("unlock"),
      },
      {
        label: "Rotate Pages",
        icon: { kind: "line", id: "rotate" },
        href: ROUTES.TOOLS.BY_SLUG("rotate"),
      },
      {
        label: "Delete Pages",
        icon: { kind: "line", id: "delete" },
        href: ROUTES.TOOLS.BY_SLUG("delete"),
      },
    ],
  },
  {
    id: "convert-to-pdf",
    heading: "CONVERT TO PDF",
    tools: [
      {
        label: "Word to PDF",
        icon: { kind: "badge", variant: "orange", badge: "DOC" },
        href: ROUTES.TOOLS.DOC_TO_PDF,
      },
      {
        label: "PNG to PDF",
        icon: { kind: "badge", variant: "orange", badge: "PNG" },
        href: ROUTES.TOOLS.BY_SLUG("png-to-pdf"),
      },
      {
        label: "JPG to PDF",
        icon: { kind: "badge", variant: "orange", badge: "JPG" },
        href: ROUTES.TOOLS.BY_SLUG("jpg-to-pdf"),
      },
      {
        label: "EXCEl to PDF",
        icon: { kind: "badge", variant: "orange", badge: "XLS" },
        href: ROUTES.TOOLS.EXCEL_TO_PDF,
      },
      {
        label: "POWERPOINT to PDF",
        icon: { kind: "badge", variant: "orange", badge: "PPT" },
        href: ROUTES.TOOLS.BY_SLUG("pptx-to-pdf"),
      },
      {
        label: "TXT  to PDF",
        icon: { kind: "badge", variant: "orange", badge: "TXT" },
        href: ROUTES.TOOLS.BY_SLUG("txt-to-pdf"),
      },
      {
        label: "Any format to PDF",
        icon: { kind: "badge", variant: "orange", badge: "ANY" },
        href: ROUTES.TOOLS.BY_SLUG("convert"),
      },
    ],
  },
  {
    id: "convert-from-pdf",
    heading: "CONVERT FROM PDF",
    tools: [
      {
        label: "PDF to WORD",
        icon: { kind: "badge", variant: "blue", badge: "PDF" },
        href: ROUTES.TOOLS.PDF_TO_DOC,
      },
      {
        label: "PDF to PNG",
        icon: { kind: "badge", variant: "blue", badge: "PDF" },
        href: ROUTES.TOOLS.BY_SLUG("pdf-to-png"),
      },
      {
        label: "PDF to JPG",
        icon: { kind: "badge", variant: "blue", badge: "PDF" },
        href: ROUTES.TOOLS.BY_SLUG("pdf-to-jpg"),
      },
      {
        label: "PDF to EXCEL",
        icon: { kind: "badge", variant: "blue", badge: "PDF" },
        href: ROUTES.TOOLS.PDF_TO_EXCEL,
      },
      {
        label: "PDF to POWERPOINT",
        icon: { kind: "badge", variant: "blue", badge: "PDF" },
        href: ROUTES.TOOLS.BY_SLUG("pdf-to-pptx"),
      },
      {
        label: "PDF to  Any format",
        icon: { kind: "badge", variant: "blue", badge: "PDF" },
        href: ROUTES.TOOLS.BY_SLUG("pdf-to-any"),
      },
    ],
  },
  {
    id: "others",
    heading: "OTHERS",
    tools: [
      {
        label: "Edit Metadata",
        icon: { kind: "line", id: "hash" },
        href: ROUTES.TOOLS.BY_SLUG("edit-metadata"),
      },
      {
        label: "Extract Images",
        icon: { kind: "line", id: "extract-images" },
        href: ROUTES.TOOLS.BY_SLUG("extract-images"),
      },
      {
        label: "Crop",
        icon: { kind: "line", id: "crop" },
        href: ROUTES.TOOLS.BY_SLUG("crop"),
      },
      {
        label: "OCR",
        icon: { kind: "line", id: "ocr" },
        href: ROUTES.TOOLS.BY_SLUG("ocr"),
      },
      {
        label: "Remove Annotations",
        icon: { kind: "line", id: "remove-annotations" },
        href: ROUTES.TOOLS.BY_SLUG("remove-annotations"),
      },
      {
        label: "Repair PDF",
        icon: { kind: "line", id: "repair" },
        href: ROUTES.TOOLS.BY_SLUG("repair"),
      },
      {
        label: "Create Bookmarks",
        icon: { kind: "line", id: "bookmarks" },
        href: ROUTES.TOOLS.BY_SLUG("bookmarks"),
      },
      {
        label: "Watermark",
        icon: { kind: "line", id: "watermark" },
        href: ROUTES.TOOLS.BY_SLUG("watermark"),
      },
    ],
  },
];
