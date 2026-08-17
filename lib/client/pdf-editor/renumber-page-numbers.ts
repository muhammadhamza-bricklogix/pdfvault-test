/**
 * Renumber page-number overlays after a Manage Pages reorder / delete /
 * duplicate operation.
 *
 * Page numbers live as Fabric `IText` overlays carrying
 * `editorType: "pageNumber"` (see `use-page-numbers-editor.ts`). The
 * stored text — e.g. `"Page 5 of 10"` — is a plain string, so after the
 * remap pass moves a page from slot 5 to slot 2, its overlay still
 * reads `"Page 5 of 10"` until something rewrites it.
 *
 * This helper does that rewrite: it walks every remapped page's
 * serialized Fabric JSON, finds page-number overlays whose text still
 * matches one of the known formats, and replaces it with the label
 * appropriate to its new slot. The starting number and total are
 * derived from the existing labels so we keep the user's original
 * choices (e.g. "start at 5") rather than resetting to 1.
 *
 * If the user manually edited a page-number overlay to something
 * custom (e.g. "Confidential — pg 5"), it won't match any known
 * pattern and is left untouched.
 */

type PageNumberFormat = "n" | "page-n" | "n-of-N" | "page-n-of-N" | "n-slash-N";

type DetectedLabel = {
  format: PageNumberFormat;
  n: number;
  total?: number;
};

const PAGE_OF_PATTERN = /^Page\s+(\d+)\s+of\s+(\d+)$/;
const N_OF_PATTERN = /^(\d+)\s+of\s+(\d+)$/;
const N_SLASH_PATTERN = /^(\d+)\s*\/\s*(\d+)$/;
const PAGE_N_PATTERN = /^Page\s+(\d+)$/;
const N_PATTERN = /^(\d+)$/;

function detectFormat(text: string): DetectedLabel | null {
  const trimmed = text.trim();
  let m: RegExpExecArray | null;

  if ((m = PAGE_OF_PATTERN.exec(trimmed))) {
    return {
      format: "page-n-of-N",
      n: Number(m[1]),
      total: Number(m[2]),
    };
  }
  if ((m = N_OF_PATTERN.exec(trimmed))) {
    return { format: "n-of-N", n: Number(m[1]), total: Number(m[2]) };
  }
  if ((m = N_SLASH_PATTERN.exec(trimmed))) {
    return { format: "n-slash-N", n: Number(m[1]), total: Number(m[2]) };
  }
  if ((m = PAGE_N_PATTERN.exec(trimmed))) {
    return { format: "page-n", n: Number(m[1]) };
  }
  if ((m = N_PATTERN.exec(trimmed))) {
    return { format: "n", n: Number(m[1]) };
  }

  return null;
}

function formatLabel(
  format: PageNumberFormat,
  n: number,
  total: number,
): string {
  switch (format) {
    case "n":
      return String(n);
    case "page-n":
      return `Page ${n}`;
    case "n-of-N":
      return `${n} of ${total}`;
    case "page-n-of-N":
      return `Page ${n} of ${total}`;
    case "n-slash-N":
      return `${n}/${total}`;
  }
}

type PageNumberObj = {
  editorType?: string;
  text?: string;
  [k: string]: unknown;
};

type ParsedFabric = {
  objects?: PageNumberObj[];
  [k: string]: unknown;
};

/**
 * Maps a Fabric-JSON-map KEY to its current display slot. Two callers:
 *   - Manage Pages save: the map is already keyed by display slot →
 *     identity resolver (default).
 *   - Sidebar thumbnail drag: the map is keyed by SOURCE page index;
 *     resolver is `(sourceKey) => pageOrder.indexOf(sourceKey) + 1`.
 *
 * Returning `null` from the resolver marks the entry as "not visible
 * in the current arrangement" — the entry is skipped (its label isn't
 * renumbered and isn't counted toward the running total).
 */
export type SlotResolver = (mapKey: number) => number | null;

const identitySlotResolver: SlotResolver = (key) => key;

/**
 * Rewrite page-number overlay labels in the Fabric JSON map so they
 * reflect each page's CURRENT display slot. Returns a new Map only if
 * something actually changed; otherwise returns the input map by
 * reference (callers can shallow-compare to skip downstream work).
 *
 * @param fabricJsonByPage Map keyed however the caller stores fabric
 *   JSON (display slot OR source page index).
 * @param resolveSlot Optional mapper from map-key → current display
 *   slot. Defaults to identity.
 */
export function renumberPageNumbersInFabricJson(
  fabricJsonByPage: Map<number, string>,
  resolveSlot: SlotResolver = identitySlotResolver,
): Map<number, string> {
  if (fabricJsonByPage.size === 0) return fabricJsonByPage;

  type Entry = {
    mapKey: number;
    slot: number;
    objectIndex: number;
    detected: DetectedLabel;
  };

  const entries: Entry[] = [];
  const parsedByKey = new Map<number, ParsedFabric>();

  fabricJsonByPage.forEach((json, mapKey) => {
    if (!json) return;
    const slot = resolveSlot(mapKey);

    if (slot === null || !Number.isFinite(slot)) return;
    let parsed: ParsedFabric;

    try {
      parsed = JSON.parse(json) as ParsedFabric;
    } catch {
      return;
    }

    const objects = Array.isArray(parsed.objects) ? parsed.objects : [];

    objects.forEach((obj, idx) => {
      if (!obj || obj.editorType !== "pageNumber") return;
      const detected = detectFormat(String(obj.text ?? ""));

      if (!detected) return;
      entries.push({ mapKey, slot, objectIndex: idx, detected });
    });

    parsedByKey.set(mapKey, parsed);
  });

  if (entries.length === 0) return fabricJsonByPage;

  entries.sort((a, b) => a.slot - b.slot || a.objectIndex - b.objectIndex);

  // Preserve the original "start at N" choice by reading the smallest
  // number on any page that still has a recognisable label. If the user
  // started numbering at 5, the lowest-slot numbered page is still 5
  // after reorder.
  const startNumber = entries.reduce(
    (min, e) => Math.min(min, e.detected.n),
    Number.POSITIVE_INFINITY,
  );
  const totalLabel = startNumber - 1 + entries.length;

  let dirty = false;

  entries.forEach((entry, i) => {
    const newN = startNumber + i;
    const newLabel = formatLabel(entry.detected.format, newN, totalLabel);
    const parsed = parsedByKey.get(entry.mapKey);

    if (!parsed?.objects) return;
    const obj = parsed.objects[entry.objectIndex];

    if (!obj) return;
    if (obj.text === newLabel) return;
    obj.text = newLabel;
    dirty = true;
  });

  if (!dirty) return fabricJsonByPage;

  const next = new Map(fabricJsonByPage);

  parsedByKey.forEach((parsed, mapKey) => {
    next.set(mapKey, JSON.stringify(parsed));
  });

  return next;
}

// Re-export the format helpers so callers that need to update a LIVE
// Fabric canvas (where the IText objects already exist) can detect /
// rewrite labels without parsing JSON.
export { detectFormat as detectPageNumberFormat };
export { formatLabel as formatPageNumberLabel };
export type { PageNumberFormat };
