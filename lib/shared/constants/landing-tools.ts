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
  | "merge"
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
  | "watermark"
  | "forms";

export type BadgeVariant = "orange" | "blue";

export type LandingToolIcon =
  | { kind: "line"; id: LineIconId }
  | { kind: "badge"; variant: BadgeVariant; badge: string };

export interface LandingTool {
  label: string;
  /** Key under `allToolsCatalog.tools` in messages/landing. */
  i18nKey: string;
  icon: LandingToolIcon;
  href: string;
}

export interface LandingToolCategory {
  id: string;
  heading: string;
  /** Key under `allToolsCatalog.categories` in messages/landing. */
  i18nKey: string;
  tools: LandingTool[];
}

export const LANDING_TOOL_CATEGORIES: LandingToolCategory[] = [
  {
    id: "edit-sign",
    // Category renamed 2026-07-23 per product: parent = "PDF COMPOSER"
    // (all caps to match the other category headings), first tool
    // relabeled "Edit & Sign" (title case) — the swap the design
    // review asked for. Same href — tile still opens the PDF editor.
    heading: "PDF COMPOSER",

    i18nKey: "pdfComposer",
    tools: [
      // Each composer tool routes to its own marketing landing page
      // (`/edit`, `/compress`, `/organize-pdf`, …) that renders the shared
      // hero + `UploadWorkspace(variant="hero")` defined by
      // `ToolLandingPage`. Same "Drag & drop file to edit" screen as
      // `/convert/[slug]` so every uploader sees a consistent UI. The
      // workspace forwards the file into `/pdf-composer?tool=<slug>`
      // under the hood.
      {
        label: "Edit & Sign",

        i18nKey: "editSign",
        icon: { kind: "line", id: "editor" },
        href: "/edit",
      },
      {
        label: "Compress",

        i18nKey: "compress",
        icon: { kind: "line", id: "compress" },
        href: "/compress",
      },
      {
        label: "Organize Pages",

        i18nKey: "organizePages",
        icon: { kind: "line", id: "organize" },
        href: "/organize-pdf",
      },
      {
        label: "Merge PDF",

        i18nKey: "mergePdf",
        icon: { kind: "line", id: "merge" },
        href: "/merge-pdf",
      },
      {
        label: "Split & Extract Pages",

        i18nKey: "splitExtractPages",
        icon: { kind: "line", id: "split" },
        href: "/split-pdf",
      },
      {
        label: "Password Protect",

        i18nKey: "passwordProtect",
        icon: { kind: "line", id: "password" },
        href: "/password-protect-pdf",
      },
      {
        label: "Unlock PDF",

        i18nKey: "unlockPdf",
        icon: { kind: "line", id: "unlock" },
        href: "/unlock-pdf",
      },
      {
        label: "Rotate Pages",

        i18nKey: "rotatePages",
        icon: { kind: "line", id: "rotate" },
        href: "/rotate-pdf",
      },
      {
        label: "Delete Pages",

        i18nKey: "deletePages",
        icon: { kind: "line", id: "delete" },
        href: "/delete-pages",
      },
    ],
  },
  {
    id: "convert-to-pdf",
    heading: "CONVERT TO PDF",

    i18nKey: "convertToPdf",
    tools: [
      {
        label: "Word to PDF",

        i18nKey: "wordToPdf",
        icon: { kind: "badge", variant: "orange", badge: "DOC" },
        href: convert("word-to-pdf"),
      },
      {
        label: "PNG to PDF",

        i18nKey: "pngToPdf",
        icon: { kind: "badge", variant: "orange", badge: "PNG" },
        href: convert("png-to-pdf"),
      },
      {
        label: "JPG to PDF",

        i18nKey: "jpgToPdf",
        icon: { kind: "badge", variant: "orange", badge: "JPG" },
        href: convert("jpg-to-pdf"),
      },
      // Hidden 2026-08-28 — Excel/PowerPoint conversions parked pending
      // future work. Do not remove; re-enable once pipelines are ready.
      // {
      //   label: "EXCEL to PDF",
      //   icon: { kind: "badge", variant: "orange", badge: "XLS" },
      //   href: convert("excel-to-pdf"),
      // },
      // {
      //   label: "POWERPOINT to PDF",
      //   icon: { kind: "badge", variant: "orange", badge: "PPT" },
      //   href: convert("powerpoint-to-pdf"),
      // },
      // TXT to PDF hidden 2026-08-29 (PM: PDF/Word/PNG/JPG only).
      // {
      //   label: "TXT  to PDF",
      //   icon: { kind: "badge", variant: "orange", badge: "TXT" },
      //   href: convert("txt-to-pdf"),
      // },
      // "Any format to PDF" removed — no backend pipeline for arbitrary formats.
    ],
  },
  {
    id: "convert-from-pdf",
    heading: "CONVERT FROM PDF",

    i18nKey: "convertFromPdf",
    tools: [
      {
        label: "PDF to WORD",

        i18nKey: "pdfToWord",
        icon: { kind: "badge", variant: "blue", badge: "PDF" },
        href: convert("pdf-to-word"),
      },
      {
        label: "PDF to PNG",

        i18nKey: "pdfToPng",
        icon: { kind: "badge", variant: "blue", badge: "PDF" },
        href: convert("pdf-to-png"),
      },
      {
        label: "PDF to JPG",

        i18nKey: "pdfToJpg",
        icon: { kind: "badge", variant: "blue", badge: "PDF" },
        href: convert("pdf-to-jpg"),
      },
      // Hidden 2026-08-28 — PDF → Excel/PowerPoint parked pending
      // future work. Do not remove; re-enable once pipelines are ready.
      // {
      //   label: "PDF to EXCEL",
      //   icon: { kind: "badge", variant: "blue", badge: "PDF" },
      //   href: convert("pdf-to-excel"),
      // },
      // {
      //   label: "PDF to POWERPOINT",
      //   icon: { kind: "badge", variant: "blue", badge: "PDF" },
      //   href: convert("pdf-to-powerpoint"),
      // },
      // PDF to HTML + PDF to Plain Text hidden 2026-08-29 (PM: PDF/Word/PNG/JPG only).
      // {
      //   label: "PDF to HTML",
      //   icon: { kind: "badge", variant: "blue", badge: "PDF" },
      //   href: convert("pdf-to-html"),
      // },
      // {
      //   label: "PDF to Plain Text",
      //   icon: { kind: "badge", variant: "blue", badge: "PDF" },
      //   href: convert("pdf-to-text"),
      // },
    ],
  },
  {
    id: "others",
    heading: "OTHERS",

    i18nKey: "others",
    // Edit Metadata / Crop / OCR / Repair PDF / Create Bookmarks removed —
    // not offered yet. Only kept features with a live backend or editor
    // implementation.
    tools: [
      {
        label: "Extract Images",

        i18nKey: "extractImages",
        icon: { kind: "line", id: "extract-images" },
        href: "/extract-images",
      },
      {
        label: "Remove Annotations",

        i18nKey: "removeAnnotations",
        icon: { kind: "line", id: "remove-annotations" },
        href: "/remove-annotations",
      },
      {
        label: "Watermark",

        i18nKey: "watermark",
        icon: { kind: "line", id: "watermark" },
        href: "/watermark-pdf",
      },
      {
        label: "Forms (W-9)",

        i18nKey: "formsW9",
        icon: { kind: "line", id: "forms" },
        href: "/forms/w-9",
      },
      {
        label: "Forms (1099-NEC)",
        i18nKey: "forms1099Nec",
        icon: { kind: "line", id: "forms" },
        href: "/forms/1099-nec",
      },
    ],
  },
];
