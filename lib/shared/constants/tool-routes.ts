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
  | "manage" // organize / rotate / delete / merge
  | "split"
  | "watermark"
  | "extract-images"
  | "flatten"; // remove annotations

const composer = (tool?: EditorToolSlug, extra?: Record<string, string>) => {
  const query = new URLSearchParams();

  if (tool) query.set("tool", tool);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) query.set(key, value);
  }
  const q = query.toString();

  return q ? `${ROUTES.TOOLS.PDF_EDITOR}?${q}` : ROUTES.TOOLS.PDF_EDITOR;
};

export const TOOL_ROUTE = {
  editor: composer(),
  compress: composer("compress"),
  password: composer("password"),
  unlock: composer("unlock"),
  managePages: composer("manage"),
  split: composer("split"),
  watermark: composer("watermark"),
  extractImages: composer("extract-images"),
  flatten: composer("flatten"),
} as const;
