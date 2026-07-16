import { ROUTES } from "./routes";

const DASHBOARD = ROUTES.APP.DASHBOARD;
const convert = (slug: string) => `/convert/${slug}` as const;

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
 * `label` is the visible name in the grid. `href` is where the row navigates.
 * Routing rules:
 *   - EDIT & SIGN / OTHERS tools require an account → all point to the
 *     dashboard; the Clerk middleware in `proxy.ts` bounces signed-out users
 *     to `/sign-in?redirect_url=/dashboard` automatically.
 *   - CONVERT TO PDF / CONVERT FROM PDF tools deep-link to `/convert/<slug>`
 *     so the shared UploadWorkspace opens under the correct heading. Slugs
 *     must exist in `CONVERT_ROUTES` (see `convert-routes.ts`).
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
        label: "PDF Composer",
        icon: { kind: "line", id: "editor" },
        href: DASHBOARD,
      },
      {
        label: "Compress",
        icon: { kind: "line", id: "compress" },
        href: DASHBOARD,
      },
      {
        label: "Organize Pages",
        icon: { kind: "line", id: "organize" },
        href: DASHBOARD,
      },
      {
        label: "Split & Extract Pages",
        icon: { kind: "line", id: "split" },
        href: DASHBOARD,
      },
      {
        label: "Password Protect",
        icon: { kind: "line", id: "password" },
        href: DASHBOARD,
      },
      {
        label: "Unlock PDF",
        icon: { kind: "line", id: "unlock" },
        href: DASHBOARD,
      },
      {
        label: "Rotate Pages",
        icon: { kind: "line", id: "rotate" },
        href: DASHBOARD,
      },
      {
        label: "Delete Pages",
        icon: { kind: "line", id: "delete" },
        href: DASHBOARD,
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
        href: convert("word-to-pdf"),
      },
      {
        label: "PNG to PDF",
        icon: { kind: "badge", variant: "orange", badge: "PNG" },
        href: convert("png-to-pdf"),
      },
      {
        label: "JPG to PDF",
        icon: { kind: "badge", variant: "orange", badge: "JPG" },
        href: convert("jpg-to-pdf"),
      },
      {
        label: "EXCEl to PDF",
        icon: { kind: "badge", variant: "orange", badge: "XLS" },
        href: convert("excel-to-pdf"),
      },
      {
        label: "POWERPOINT to PDF",
        icon: { kind: "badge", variant: "orange", badge: "PPT" },
        href: convert("powerpoint-to-pdf"),
      },
      {
        label: "TXT  to PDF",
        icon: { kind: "badge", variant: "orange", badge: "TXT" },
        href: convert("txt-to-pdf"),
      },
      {
        label: "Any format to PDF",
        icon: { kind: "badge", variant: "orange", badge: "ANY" },
        href: convert("any-to-pdf"),
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
        href: convert("pdf-to-word"),
      },
      {
        label: "PDF to PNG",
        icon: { kind: "badge", variant: "blue", badge: "PDF" },
        href: convert("pdf-to-png"),
      },
      {
        label: "PDF to JPG",
        icon: { kind: "badge", variant: "blue", badge: "PDF" },
        href: convert("pdf-to-jpg"),
      },
      {
        label: "PDF to EXCEL",
        icon: { kind: "badge", variant: "blue", badge: "PDF" },
        href: convert("pdf-to-excel"),
      },
      {
        label: "PDF to POWERPOINT",
        icon: { kind: "badge", variant: "blue", badge: "PDF" },
        href: convert("pdf-to-powerpoint"),
      },
      {
        label: "PDF to HTML",
        icon: { kind: "badge", variant: "blue", badge: "PDF" },
        href: convert("pdf-to-html"),
      },
      {
        label: "PDF to Plain Text",
        icon: { kind: "badge", variant: "blue", badge: "PDF" },
        href: convert("pdf-to-text"),
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
        href: DASHBOARD,
      },
      {
        label: "Extract Images",
        icon: { kind: "line", id: "extract-images" },
        href: DASHBOARD,
      },
      {
        label: "Crop",
        icon: { kind: "line", id: "crop" },
        href: DASHBOARD,
      },
      {
        label: "OCR",
        icon: { kind: "line", id: "ocr" },
        href: DASHBOARD,
      },
      {
        label: "Remove Annotations",
        icon: { kind: "line", id: "remove-annotations" },
        href: DASHBOARD,
      },
      {
        label: "Repair PDF",
        icon: { kind: "line", id: "repair" },
        href: DASHBOARD,
      },
      {
        label: "Create Bookmarks",
        icon: { kind: "line", id: "bookmarks" },
        href: DASHBOARD,
      },
      {
        label: "Watermark",
        icon: { kind: "line", id: "watermark" },
        href: DASHBOARD,
      },
    ],
  },
];
