import { ROUTES } from "./routes";

/**
 * Central catalog of every editor-hosted tool the marketing site + dashboard
 * link to. Keeps the tile-href map and the auto-launch logic in one place so
 * a URL change doesn't need to be duplicated across the landing page,
 * dashboard grid, quick cards, and all-tools catalog.
 *
 * The value string is a `?tool=<slug>` query param on `/pdf-composer`. The
 * `EditorToolLauncher` in `components/shared/pending-editor-file-hydrator.tsx`
 * reads it and opens the matching modal / dialog / tool state once the
 * editor has a file loaded.
 */
export type EditorToolSlug =
  | "compress"
  | "password" // add password
  | "unlock" // remove password
  | "manage" // organize / rotate / delete
  | "merge" // merge multiple PDFs
  | "split"
  | "watermark"
  | "extract-images"
  | "flatten" // remove annotations
  | "edit" // land in edit-text tool (PRD §5/§6 dashboard "Edit PDF")
  | "sign"; // land in signature tool (PRD §5/§6 dashboard "Sign …")

/**
 * All composer tool routes carry `?fresh=1` so the hydrator wipes the
 * previous session's file on landing — a user who converts a Word doc,
 * then clicks "PDF Composer" from the navbar, expects the empty
 * drop-zone, not the freshly-converted PDF they just downloaded.
 * `?tool=<slug>` links already had the equivalent "clear on entry"
 * behavior via the hydrator's tool-tile reset; adding `fresh=1`
 * extends the same discipline to the bare `/pdf-composer` entry.
 */
const composer = (tool?: EditorToolSlug, extra?: Record<string, string>) => {
  const query = new URLSearchParams();

  query.set("fresh", "1");
  if (tool) query.set("tool", tool);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) query.set(key, value);
  }

  return `${ROUTES.TOOLS.PDF_EDITOR}?${query.toString()}`;
};

export const TOOL_ROUTE = {
  editor: composer(),
  edit: composer("edit"),
  sign: composer("sign"),
  compress: composer("compress"),
  password: composer("password"),
  unlock: composer("unlock"),
  managePages: composer("manage"),
  merge: composer("merge"),
  split: composer("split"),
  watermark: composer("watermark"),
  extractImages: composer("extract-images"),
  flatten: composer("flatten"),
} as const;
