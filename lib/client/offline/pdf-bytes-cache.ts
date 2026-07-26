"use client";

import { logger } from "@/lib/shared/utils/logger";

import { OBJECT_STORES, reqToPromise, withStore } from "./idb-client";

type StoredBytes = {
  id: string;
  blob: Blob;
  filename: string;
  contentType: string;
  cachedAt: number;
  bytes: number;
};

// Per-user IndexedDB bytes budget. Default 500 MB — large enough for a few
// hundred typical PDFs, small enough to avoid browser quota prompts on
// long-lived sessions. Can be overridden via env at build time.
const BUDGET_BYTES =
  Number(process.env.NEXT_PUBLIC_IDB_PDF_BYTES_BUDGET) || 500 * 1024 * 1024;

function isQuotaError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;

  return (
    err.name === "QuotaExceededError" ||
    /quota|exceeded|full/i.test(err.message)
  );
}

/**
 * Cache a PDF blob for offline viewing. Keeps the store under a size budget
 * using LRU eviction. A quota failure triggers aggressive eviction and a
 * single retry. If it still fails (e.g. a single blob larger than the origin
 * quota) we log + bail without surfacing the error to the UI — online mode is
 * unaffected.
 */
export async function putPdfBytes(
  userId: string,
  payload: {
    id: string;
    blob: Blob;
    filename: string;
    contentType: string;
  },
): Promise<void> {
  const entry: StoredBytes = {
    id: payload.id,
    blob: payload.blob,
    filename: payload.filename,
    contentType: payload.contentType,
    cachedAt: Date.now(),
    bytes: payload.blob.size,
  };

  await ensureBudgetHeadroom(userId, entry.id, entry.bytes);

  const ok = await tryPut(userId, entry);

  if (ok) return;

  // Quota / unknown failure — evict aggressively and retry once.
  await evictToBudget(userId, entry.id, entry.bytes);
  const retried = await tryPut(userId, entry);

  if (!retried) {
    logger.warn("[offline] putPdfBytes failed after eviction", {
      id: payload.id,
      bytes: entry.bytes,
    });
  }
}

async function tryPut(userId: string, entry: StoredBytes): Promise<boolean> {
  try {
    const result = await withStore(
      userId,
      OBJECT_STORES.pdfBytes,
      "readwrite",
      async (_tx, store) => {
        store(OBJECT_STORES.pdfBytes).put(entry);

        return true;
      },
    );

    return result === true;
  } catch (err) {
    if (isQuotaError(err)) return false;

    // Non-quota errors are best-effort logged; don't surface to UI.
    logger.warn("[offline] putPdfBytes non-quota error", {
      id: entry.id,
      error: err instanceof Error ? err.message : String(err),
    });

    return false;
  }
}

async function readAllEntries(userId: string): Promise<StoredBytes[]> {
  const result = await withStore(
    userId,
    OBJECT_STORES.pdfBytes,
    "readonly",
    async (_tx, store) => {
      const all = await reqToPromise(store(OBJECT_STORES.pdfBytes).getAll());

      return (all ?? []) as StoredBytes[];
    },
  );

  return result ?? [];
}

/**
 * Evict the oldest entries until `neededBytes` of headroom is available.
 * Returns true if headroom was achieved.
 */
async function evictToBudget(
  userId: string,
  currentId: string,
  neededBytes: number,
): Promise<boolean> {
  const entries = await readAllEntries(userId);

  if (entries.length === 0) return false;

  // Don't evict the entry we're about to write (it may already exist from a
  // previous session; we'll overwrite it anyway).
  const evictable = entries.filter((e) => e.id !== currentId);
  const currentTotal = evictable.reduce((sum, e) => sum + (e.bytes || 0), 0);
  const targetMax = Math.max(0, BUDGET_BYTES - neededBytes);

  if (currentTotal <= targetMax) return true;

  // Sort oldest-first (LRU) and evict until we're under budget.
  evictable.sort((a, b) => a.cachedAt - b.cachedAt);

  let removed = 0;
  let runningTotal = currentTotal;
  const idsToDelete: string[] = [];

  for (const entry of evictable) {
    if (runningTotal <= targetMax) break;

    idsToDelete.push(entry.id);
    runningTotal -= entry.bytes || 0;
    removed += entry.bytes || 0;
  }

  if (idsToDelete.length === 0) return false;

  await withStore(
    userId,
    OBJECT_STORES.pdfBytes,
    "readwrite",
    async (_tx, store) => {
      for (const id of idsToDelete) {
        store(OBJECT_STORES.pdfBytes).delete(id);
      }
    },
  );

  logger.info("[offline] evicted PDF bytes", {
    evictedCount: idsToDelete.length,
    evictedBytes: removed,
    remainingBytes: runningTotal,
  });

  return runningTotal <= targetMax;
}

/**
 * Proactive eviction: if adding `neededBytes` would exceed the budget, evict
 * oldest entries first.
 */
async function ensureBudgetHeadroom(
  userId: string,
  currentId: string,
  neededBytes: number,
): Promise<void> {
  const entries = await readAllEntries(userId);
  const current = entries
    .filter((e) => e.id !== currentId)
    .reduce((sum, e) => sum + (e.bytes || 0), 0);

  if (current + neededBytes <= BUDGET_BYTES) return;

  await evictToBudget(userId, currentId, neededBytes);
}

export async function readPdfBytes(
  userId: string,
  id: string,
): Promise<StoredBytes | null> {
  const result = await withStore(
    userId,
    OBJECT_STORES.pdfBytes,
    "readonly",
    async (_tx, store) => {
      const entry = await reqToPromise(store(OBJECT_STORES.pdfBytes).get(id));

      return (entry ?? null) as StoredBytes | null;
    },
  );

  return result ?? null;
}

export async function deletePdfBytes(
  userId: string,
  id: string,
): Promise<void> {
  await withStore(
    userId,
    OBJECT_STORES.pdfBytes,
    "readwrite",
    async (_tx, store) => {
      store(OBJECT_STORES.pdfBytes).delete(id);
    },
  );
}
