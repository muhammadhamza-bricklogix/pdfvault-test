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
        href: ROUTES.TOOLS.PDF_EDITOR,
      },
      {
        label: "Organize Pages",
        icon: { kind: "line", id: "organize" },
        href: ROUTES.TOOLS.PDF_EDITOR,
      },
      {
        label: "Split & Extract Pages",
        icon: { kind: "line", id: "split" },
        href: ROUTES.TOOLS.PDF_EDITOR,
      },
      {
        label: "Password Protect",
        icon: { kind: "line", id: "password" },
        href: ROUTES.TOOLS.PDF_EDITOR,
      },
      {
        label: "Unlock PDF",
        icon: { kind: "line", id: "unlock" },
        href: ROUTES.TOOLS.PDF_EDITOR,
      },
      {
        label: "Rotate Pages",
        icon: { kind: "line", id: "rotate" },
        href: ROUTES.TOOLS.PDF_EDITOR,
      },
      {
        label: "Delete Pages",
        icon: { kind: "line", id: "delete" },
        href: ROUTES.TOOLS.PDF_EDITOR,
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
        href: ROUTES.TOOLS.PDF_EDITOR,
      },
      {
        label: "PNG to PDF",
        icon: { kind: "badge", variant: "orange", badge: "PNG" },
        href: ROUTES.TOOLS.PDF_EDITOR,
      },
      {
        label: "JPG to PDF",
        icon: { kind: "badge", variant: "orange", badge: "JPG" },
        href: ROUTES.TOOLS.PDF_EDITOR,
      },
      {
        label: "EXCEl to PDF",
        icon: { kind: "badge", variant: "orange", badge: "XLS" },
        href: ROUTES.TOOLS.PDF_EDITOR,
      },
      {
        label: "POWERPOINT to PDF",
        icon: { kind: "badge", variant: "orange", badge: "PPT" },
        href: ROUTES.TOOLS.PDF_EDITOR,
      },
      {
        label: "TXT  to PDF",
        icon: { kind: "badge", variant: "orange", badge: "TXT" },
        href: ROUTES.TOOLS.PDF_EDITOR,
      },
      {
        label: "Any format to PDF",
        icon: { kind: "badge", variant: "orange", badge: "ANY" },
        href: ROUTES.TOOLS.PDF_EDITOR,
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
        href: ROUTES.TOOLS.PDF_EDITOR,
      },
      {
        label: "PDF to PNG",
        icon: { kind: "badge", variant: "blue", badge: "PDF" },
        href: ROUTES.TOOLS.PDF_EDITOR,
      },
      {
        label: "PDF to JPG",
        icon: { kind: "badge", variant: "blue", badge: "PDF" },
        href: ROUTES.TOOLS.PDF_EDITOR,
      },
      {
        label: "PDF to EXCEL",
        icon: { kind: "badge", variant: "blue", badge: "PDF" },
        href: ROUTES.TOOLS.PDF_EDITOR,
      },
      {
        label: "PDF to POWERPOINT",
        icon: { kind: "badge", variant: "blue", badge: "PDF" },
        href: ROUTES.TOOLS.PDF_EDITOR,
      },
      {
        label: "PDF to  Any format",
        icon: { kind: "badge", variant: "blue", badge: "PDF" },
        href: ROUTES.TOOLS.PDF_EDITOR,
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
        href: ROUTES.TOOLS.PDF_EDITOR,
      },
      {
        label: "Extract Images",
        icon: { kind: "line", id: "extract-images" },
        href: ROUTES.TOOLS.PDF_EDITOR,
      },
      {
        label: "Crop",
        icon: { kind: "line", id: "crop" },
        href: ROUTES.TOOLS.PDF_EDITOR,
      },
      {
        label: "OCR",
        icon: { kind: "line", id: "ocr" },
        href: ROUTES.TOOLS.PDF_EDITOR,
      },
      {
        label: "Remove Annotations",
        icon: { kind: "line", id: "remove-annotations" },
        href: ROUTES.TOOLS.PDF_EDITOR,
      },
      {
        label: "Repair PDF",
        icon: { kind: "line", id: "repair" },
        href: ROUTES.TOOLS.PDF_EDITOR,
      },
      {
        label: "Create Bookmarks",
        icon: { kind: "line", id: "bookmarks" },
        href: ROUTES.TOOLS.PDF_EDITOR,
      },
      {
        label: "Watermark",
        icon: { kind: "line", id: "watermark" },
        href: ROUTES.TOOLS.PDF_EDITOR,
      },
    ],
  },
];
