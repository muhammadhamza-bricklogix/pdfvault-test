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

// Hard cap: evict oldest entries until total cached size is below this limit.
// iOS Safari enforces ~50 MB origin quota; 80 MB gives headroom for doc cache.
const MAX_CACHE_BYTES = 80 * 1024 * 1024;

/**
 * Cache a PDF blob for offline viewing. Enforces an 80 MB LRU cap across all
 * cached entries before writing. Best-effort: a quota failure evicts the oldest
 * entry and retries once. Failures are non-fatal — online mode is unaffected.
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

  // Enforce the LRU cap before attempting the write.
  await enforceSizeCap(userId, entry.bytes);

  const ok = await tryPut(userId, entry);

  if (ok) return;

  // Quota / unknown failure — evict the oldest entry and retry once.
  await evictOldest(userId);
  const retried = await tryPut(userId, entry);

  if (!retried) {
    logger.warn("[offline] putPdfBytes failed after eviction", {
      id: payload.id,
      bytes: entry.bytes,
    });
  }
}

async function enforceSizeCap(
  userId: string,
  incomingBytes: number,
): Promise<void> {
  await withStore(
    userId,
    OBJECT_STORES.pdfBytes,
    "readwrite",
    async (_tx, store) => {
      const all = await reqToPromise(store(OBJECT_STORES.pdfBytes).getAll());
      const entries = (all ?? []) as StoredBytes[];

      let totalBytes = entries.reduce((sum, e) => sum + (e.bytes ?? 0), 0);

      if (totalBytes + incomingBytes <= MAX_CACHE_BYTES) return;

      // Sort oldest-first and evict until we have room.
      entries.sort((a, b) => a.cachedAt - b.cachedAt);

      for (const entry of entries) {
        if (totalBytes + incomingBytes <= MAX_CACHE_BYTES) break;

        store(OBJECT_STORES.pdfBytes).delete(entry.id);
        totalBytes -= entry.bytes ?? 0;

        logger.info("[offline] evicted cached PDF to enforce size cap", {
          id: entry.id,
          bytes: entry.bytes,
        });
      }
    },
  );
}

async function tryPut(userId: string, entry: StoredBytes): Promise<boolean> {
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
}

async function evictOldest(userId: string): Promise<void> {
  await withStore(
    userId,
    OBJECT_STORES.pdfBytes,
    "readwrite",
    async (_tx, store) => {
      const all = await reqToPromise(store(OBJECT_STORES.pdfBytes).getAll());
      const entries = (all ?? []) as StoredBytes[];

      if (entries.length === 0) return;

      entries.sort((a, b) => a.cachedAt - b.cachedAt);
      const target = entries[0];

      if (target) {
        store(OBJECT_STORES.pdfBytes).delete(target.id);
      }
    },
  );
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
