"use client";

import type { Document } from "@/lib/shared/types/documents.types";

import { OBJECT_STORES, reqToPromise, withStore } from "./idb-client";

/**
 * Persisted dashboard metadata for a document. Mirrors the server `Document`
 * shape but strips the presigned `url` (15-min TTL — pointless to persist).
 * `cachedAt` lets the UI badge stale entries on long offline stretches.
 */
export type CachedDocument = Omit<Document, "url"> & {
  cachedAt: number;
};

function strip(doc: Document): CachedDocument {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { url: _url, ...rest } = doc;

  return { ...rest, cachedAt: Date.now() };
}

/**
 * Replace the cached document list with the latest server response. Performs
 * a full snapshot overwrite — any document removed server-side (delete /
 * filter) disappears from cache on the next online fetch. Bytes for removed
 * docs are pruned in the same transaction so cached blobs don't orphan.
 */
export async function replaceDocumentList(
  userId: string,
  docs: Document[],
): Promise<void> {
  await withStore(
    userId,
    [OBJECT_STORES.documents, OBJECT_STORES.pdfBytes],
    "readwrite",
    async (_tx, store) => {
      const docStore = store(OBJECT_STORES.documents);
      const bytesStore = store(OBJECT_STORES.pdfBytes);
      const liveIds = new Set(docs.map((d) => d.id));

      const existingKeys = (await reqToPromise(docStore.getAllKeys())) as
        | IDBValidKey[]
        | undefined;

      if (existingKeys) {
        for (const key of existingKeys) {
          if (typeof key === "string" && !liveIds.has(key)) {
            docStore.delete(key);
            bytesStore.delete(key);
          }
        }
      }

      for (const doc of docs) {
        docStore.put(strip(doc));
      }
    },
  );
}

/**
 * Returns all cached docs, newest-updated first. Used by the dashboard when
 * the network is unavailable or returns an error.
 */
export async function readCachedDocumentList(
  userId: string,
): Promise<CachedDocument[]> {
  const docs = await withStore(
    userId,
    OBJECT_STORES.documents,
    "readonly",
    async (_tx, store) => {
      const result = await reqToPromise(
        store(OBJECT_STORES.documents).getAll(),
      );

      return (result ?? []) as CachedDocument[];
    },
  );

  if (!docs) return [];

  return [...docs].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export async function readCachedDocument(
  userId: string,
  id: string,
): Promise<CachedDocument | null> {
  const result = await withStore(
    userId,
    OBJECT_STORES.documents,
    "readonly",
    async (_tx, store) => {
      const doc = await reqToPromise(store(OBJECT_STORES.documents).get(id));

      return (doc ?? null) as CachedDocument | null;
    },
  );

  return result ?? null;
}

/**
 * Upsert a single document — used by the editor doc loader when it lands on
 * a single-doc fetch and wants to cache the metadata it just received.
 */
export async function upsertCachedDocument(
  userId: string,
  doc: Document,
): Promise<void> {
  await withStore(
    userId,
    OBJECT_STORES.documents,
    "readwrite",
    async (_tx, store) => {
      store(OBJECT_STORES.documents).put(strip(doc));
    },
  );
}
