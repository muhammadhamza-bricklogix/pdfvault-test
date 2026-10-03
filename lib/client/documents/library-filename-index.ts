import type { Document } from "@/lib/shared/types/documents.types";

import { documentsService } from "@/lib/shared/api/services/documents.service";

const PAGE_SIZE = 100;
/** Matches the old NEC walker: 10 pages (1 000 docs) was too low. */
const MAX_PAGES = 100;
/**
 * How long a listing stays reusable.
 *
 * One Save answers three questions — "is this name taken?", "what is the
 * next free name?" and the modal's live re-check — and autosave asks them
 * again seconds later. Without this, each answer cost a full walk of the
 * user's library (135 kB and several seconds each on a large account), and
 * the save could not finish inside the navigation budget.
 */
const TTL_MS = 5_000;

type Index = ReadonlyMap<string, Document>;

let cached: { at: number; index: Index } | null = null;
let inFlight: Promise<Index> | null = null;

async function walk(): Promise<Index> {
  const byName = new Map<string, Document>();

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await documentsService.listDocuments({
      page,
      pageSize: PAGE_SIZE,
    });

    for (const doc of response.items) {
      // Case-insensitive: users treat filenames that way and the backend
      // accepts any casing on upload. First match wins, mirroring the
      // previous `items.find(...)` behaviour.
      const key = doc.filename.toLowerCase();

      if (!byName.has(key)) byName.set(key, doc);
    }
    if (page >= response.pagination.totalPages) break;
  }

  return byName;
}

/**
 * The user's library keyed by lowercased filename, cached briefly and
 * de-duplicated across concurrent callers.
 */
export async function loadLibraryIndex({
  force = false,
}: { force?: boolean } = {}): Promise<Index> {
  if (!force && cached && Date.now() - cached.at < TTL_MS) {
    return cached.index;
  }
  // A second caller arriving mid-walk shares the same request rather than
  // starting another one.
  if (!force && inFlight) return inFlight;

  const promise = walk()
    .then((index) => {
      cached = { at: Date.now(), index };

      return index;
    })
    .finally(() => {
      inFlight = null;
    });

  inFlight = promise;

  return promise;
}

/** Drop the cache. Call after anything that adds, renames or removes a row. */
export function invalidateLibraryIndex(): void {
  cached = null;
}
