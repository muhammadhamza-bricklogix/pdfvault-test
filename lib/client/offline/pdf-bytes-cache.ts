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

/**
 * Cache a PDF blob for offline viewing. Best-effort: a quota failure evicts
 * the oldest cached entry and retries once. If it still fails (e.g. a single
 * blob larger than the origin's quota) we log + bail without surfacing the
 * error to the UI — online mode is unaffected.
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
