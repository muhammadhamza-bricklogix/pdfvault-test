/**
 * Find-and-replace engine for the editor.
 *
 * Operates on the editable-text IText overlays that `use-edit-text-mode`
 * materializes from `extractTextBlocks`. Two data sources:
 *
 *  1. The LIVE Fabric canvas for the active page — we mutate the IText
 *     instance directly so the change is visible immediately and the
 *     existing fabric event handlers fire (pushes a history entry).
 *  2. The serialized JSON in `fabricJsonByPage` for every other page — we
 *     parse, rewrite the `text` field on matching `editorType:"editModeText"`
 *     objects, and re-serialize. The next time that page is mounted the
 *     mount effect loads the rewritten JSON and the user sees the change.
 *
 * `editorType:"editModeText"` is the only flavor we touch — leaves user-added
 * text-boxes, watermark previews, etc. untouched even if they happen to
 * contain the search term.
 */

import type { Canvas as FabricCanvas, IText } from "fabric";

export type FindMatch = {
  /** Display page number this match lives on. */
  displayPage: number;
  /**
   * Source page number — what `fabricJsonByPage` is keyed on. Lets the editor
   * jump to the page even after a page reorder.
   */
  sourcePage: number;
  /** Index within `parsed.objects` (or the live canvas) for this match. */
  objectIndex: number;
  /** Verbatim text of the matched IText (so the UI can show context). */
  snippet: string;
};

type FabricJsonObject = Record<string, unknown> & {
  type?: string;
  editorType?: string;
  text?: string;
};

const TEXT_TYPES = new Set(["i-text", "itext", "text", "textbox"]);
const EDITOR_TYPE = "editModeText";

function isEditModeText(o: FabricJsonObject): boolean {
  const t = (o.type as string | undefined)?.toLowerCase();

  return t !== undefined && TEXT_TYPES.has(t) && o.editorType === EDITOR_TYPE;
}

function buildSearchRegex(
  needle: string,
  opts: { caseSensitive: boolean; wholeWord: boolean },
): RegExp {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = opts.wholeWord ? `\\b${escaped}\\b` : escaped;
  const flags = opts.caseSensitive ? "g" : "gi";

  return new RegExp(pattern, flags);
}

export type FindOptions = {
  caseSensitive: boolean;
  wholeWord: boolean;
};

/**
 * Index every `editModeText` IText across all pages and return the list of
 * matches in display-page-then-object-index order so "Find next" walks
 * naturally through the document.
 *
 * `liveCanvas` + `liveDisplayPage` carry the live state for the page the
 * user is currently looking at — we use the canvas objects there instead of
 * the (possibly stale) cached JSON.
 */
export function findAllMatches({
  fabricJsonByPage,
  liveCanvas,
  liveDisplayPage,
  liveSourcePage,
  needle,
  options,
  pageOrder,
  pageCount,
}: {
  fabricJsonByPage: Map<number, string>;
  liveCanvas: FabricCanvas | null;
  liveDisplayPage: number;
  liveSourcePage: number;
  needle: string;
  options: FindOptions;
  pageOrder: number[];
  pageCount: number;
}): FindMatch[] {
  if (!needle) return [];

  const regex = buildSearchRegex(needle, options);
  const matches: FindMatch[] = [];

  const resolveSource = (displayPage: number): number =>
    pageOrder.length
      ? (pageOrder[displayPage - 1] ?? displayPage)
      : displayPage;

  for (let displayPage = 1; displayPage <= pageCount; displayPage++) {
    const sourcePage = resolveSource(displayPage);

    if (displayPage === liveDisplayPage && liveCanvas) {
      const objects = liveCanvas.getObjects();

      for (let i = 0; i < objects.length; i++) {
        const obj = objects[i] as unknown as {
          type?: string;
          editorType?: string;
          text?: string;
        };

        if (!isEditModeText(obj)) continue;

        const text = obj.text ?? "";

        if (regex.test(text)) {
          matches.push({
            displayPage,
            sourcePage: liveSourcePage,
            objectIndex: i,
            snippet: text,
          });
        }
        regex.lastIndex = 0; // global flag accumulates lastIndex — reset.
      }
      continue;
    }

    const json = fabricJsonByPage.get(sourcePage);

    if (!json) continue;

    let parsed: { objects?: FabricJsonObject[] };

    try {
      parsed = JSON.parse(json) as { objects?: FabricJsonObject[] };
    } catch {
      continue;
    }
    const objects = parsed.objects ?? [];

    for (let i = 0; i < objects.length; i++) {
      const o = objects[i];

      if (!isEditModeText(o)) continue;
      const text = typeof o.text === "string" ? o.text : "";

      if (regex.test(text)) {
        matches.push({
          displayPage,
          sourcePage,
          objectIndex: i,
          snippet: text,
        });
      }
      regex.lastIndex = 0;
    }
  }

  return matches;
}

/**
 * Replace `needle` → `replacement` on the matching IText for ONE match.
 *
 * - When the match is on the live page, mutates the Fabric IText directly so
 *   the canvas paints the new text and `object:modified` fires (history
 *   pushed by the existing listener in `use-editor-history`).
 * - When the match is on another page, rewrites the cached JSON and stores
 *   it back via `saveFabricJsonBySourcePage`. On next page-mount the canvas
 *   loads the rewritten state.
 */
export function applyReplacement({
  fabricJsonByPage,
  liveCanvas,
  liveDisplayPage,
  match,
  needle,
  options,
  replacement,
  saveFabricJsonBySourcePage,
}: {
  fabricJsonByPage: Map<number, string>;
  liveCanvas: FabricCanvas | null;
  liveDisplayPage: number;
  match: FindMatch;
  needle: string;
  options: FindOptions;
  replacement: string;
  saveFabricJsonBySourcePage: (sourcePage: number, json: string) => void;
}): boolean {
  const regex = buildSearchRegex(needle, options);

  if (match.displayPage === liveDisplayPage && liveCanvas) {
    const obj = liveCanvas.getObjects()[match.objectIndex] as
      | (IText & { editorType?: string })
      | undefined;

    if (!obj || !isEditModeText(obj as unknown as FabricJsonObject)) {
      return false;
    }
    const oldText = obj.text ?? "";
    const newText = oldText.replace(regex, replacement);

    if (newText === oldText) return false;
    obj.set({ text: newText });
    obj.setCoords();
    // Trigger Fabric's modified event so undo history captures the edit.
    obj.fire("modified");
    liveCanvas.fire("object:modified", { target: obj });
    liveCanvas.renderAll();

    return true;
  }

  const json = fabricJsonByPage.get(match.sourcePage);

  if (!json) return false;

  let parsed: { objects?: FabricJsonObject[] };

  try {
    parsed = JSON.parse(json) as { objects?: FabricJsonObject[] };
  } catch {
    return false;
  }
  const objects = parsed.objects ?? [];
  const o = objects[match.objectIndex];

  if (!o || !isEditModeText(o)) return false;
  const oldText = typeof o.text === "string" ? o.text : "";
  const newText = oldText.replace(regex, replacement);

  if (newText === oldText) return false;
  o.text = newText;

  saveFabricJsonBySourcePage(match.sourcePage, JSON.stringify(parsed));

  return true;
}

/**
 * Replace every match in one pass. Returns the number of IText overlays
 * actually rewritten (not the number of regex hits — each IText counts
 * once even if it contains multiple occurrences).
 */
export function applyReplaceAll({
  fabricJsonByPage,
  liveCanvas,
  liveDisplayPage,
  liveSourcePage,
  needle,
  options,
  pageCount,
  pageOrder,
  replacement,
  saveFabricJsonBySourcePage,
}: {
  fabricJsonByPage: Map<number, string>;
  liveCanvas: FabricCanvas | null;
  liveDisplayPage: number;
  liveSourcePage: number;
  needle: string;
  options: FindOptions;
  pageCount: number;
  pageOrder: number[];
  replacement: string;
  saveFabricJsonBySourcePage: (sourcePage: number, json: string) => void;
}): number {
  const matches = findAllMatches({
    fabricJsonByPage,
    liveCanvas,
    liveDisplayPage,
    liveSourcePage,
    needle,
    options,
    pageOrder,
    pageCount,
  });
  let replaced = 0;

  // Walk in reverse to keep object indices stable even though we don't
  // remove/insert — defensive against future changes.
  for (let i = matches.length - 1; i >= 0; i--) {
    const ok = applyReplacement({
      fabricJsonByPage,
      liveCanvas,
      liveDisplayPage,
      match: matches[i],
      needle,
      options,
      replacement,
      saveFabricJsonBySourcePage,
    });

    if (ok) replaced++;
  }

  return replaced;
}
