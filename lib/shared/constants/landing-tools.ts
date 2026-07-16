import { TOOL_ROUTE } from "./tool-routes";

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
        href: TOOL_ROUTE.editor,
      },
      {
        label: "Compress",
        icon: { kind: "line", id: "compress" },
        href: TOOL_ROUTE.compress,
      },
      {
        label: "Organize Pages",
        icon: { kind: "line", id: "organize" },
        href: TOOL_ROUTE.managePages,
      },
      {
        label: "Split & Extract Pages",
        icon: { kind: "line", id: "split" },
        href: TOOL_ROUTE.split,
      },
      {
        label: "Password Protect",
        icon: { kind: "line", id: "password" },
        href: TOOL_ROUTE.password,
      },
      {
        label: "Unlock PDF",
        icon: { kind: "line", id: "unlock" },
        href: TOOL_ROUTE.unlock,
      },
      {
        label: "Rotate Pages",
        icon: { kind: "line", id: "rotate" },
        href: TOOL_ROUTE.managePages,
      },
      {
        label: "Delete Pages",
        icon: { kind: "line", id: "delete" },
        href: TOOL_ROUTE.managePages,
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
      // "Any format to PDF" removed — no backend pipeline for arbitrary formats.
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
    // Edit Metadata / Crop / OCR / Repair PDF / Create Bookmarks removed —
    // not offered yet. Only kept features with a live backend or editor
    // implementation.
    tools: [
      {
        label: "Extract Images",
        icon: { kind: "line", id: "extract-images" },
        href: TOOL_ROUTE.extractImages,
      },
      {
        label: "Remove Annotations",
        icon: { kind: "line", id: "remove-annotations" },
        href: TOOL_ROUTE.flatten,
      },
      {
        label: "Watermark",
        icon: { kind: "line", id: "watermark" },
        href: TOOL_ROUTE.watermark,
      },
    ],
  },
];
