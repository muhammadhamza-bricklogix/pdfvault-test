"use client";

import { logger } from "@/lib/shared/utils/logger";

const DB_PREFIX = "pdfedits-offline-";
const DB_VERSION = 1;

export const OBJECT_STORES = {
  documents: "documents",
  pdfBytes: "pdfBytes",
  meta: "meta",
} as const;

export type ObjectStoreName =
  (typeof OBJECT_STORES)[keyof typeof OBJECT_STORES];

const LAST_USER_KEY = "pdfedits-last-user-id";

function dbName(userId: string): string {
  return `${DB_PREFIX}${userId}`;
}

function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function rememberCurrentUser(userId: string): void {
  try {
    localStorage.setItem(LAST_USER_KEY, userId);
  } catch {
    // Safari private mode etc. — non-fatal.
  }
}

export function getLastKnownUserId(): string | null {
  try {
    return localStorage.getItem(LAST_USER_KEY);
  } catch {
    return null;
  }
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    if (!isIndexedDBAvailable()) {
      resolve();

      return;
    }
    const req = indexedDB.deleteDatabase(name);

    req.onsuccess = () => resolve();
    req.onerror = () => {
      logger.warn("[offline] deleteDatabase failed", { name });
      resolve();
    };
    req.onblocked = () => {
      logger.warn("[offline] deleteDatabase blocked", { name });
      resolve();
    };
  });
}

/**
 * Drops the previous user's IDB when the signed-in Clerk user changes. Called
 * by the dashboard mount path before any cache reads/writes happen so we never
 * surface another account's documents in the current session.
 */
export async function invalidateOnAccountSwitch(
  currentUserId: string,
): Promise<void> {
  const previous = getLastKnownUserId();

  if (previous && previous !== currentUserId) {
    await deleteDatabase(dbName(previous));
    logger.info("[offline] cleared prior user IDB", {
      previous,
      currentUserId,
    });
  }
  rememberCurrentUser(currentUserId);
}

function openConnection(userId: string): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (!isIndexedDBAvailable()) {
      resolve(null);

      return;
    }
    const req = indexedDB.open(dbName(userId), DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains(OBJECT_STORES.documents)) {
        db.createObjectStore(OBJECT_STORES.documents, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(OBJECT_STORES.pdfBytes)) {
        db.createObjectStore(OBJECT_STORES.pdfBytes, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(OBJECT_STORES.meta)) {
        db.createObjectStore(OBJECT_STORES.meta, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      logger.warn("[offline] indexedDB open failed", {
        userId,
        error: req.error?.message,
      });
      resolve(null);
    };
    req.onblocked = () => {
      logger.warn("[offline] indexedDB open blocked", { userId });
      resolve(null);
    };
  });
}

/**
 * Runs a callback inside a single transaction against the user's offline DB.
 * Returns null on any failure — callers are expected to fall through to
 * network-only behavior. Never throws.
 */
export async function withStore<T>(
  userId: string,
  stores: ObjectStoreName | ObjectStoreName[],
  mode: IDBTransactionMode,
  run: (
    tx: IDBTransaction,
    storeAccessor: (name: ObjectStoreName) => IDBObjectStore,
  ) => Promise<T> | T,
): Promise<T | null> {
  const db = await openConnection(userId);

  if (!db) return null;

  try {
    const tx = db.transaction(stores, mode);
    const result = await run(tx, (name) => tx.objectStore(name));

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("transaction aborted"));
    });

    return result;
  } catch (err) {
    logger.warn("[offline] withStore failed", {
      error: err instanceof Error ? err.message : String(err),
    });

    return null;
  } finally {
    db.close();
  }
}

export function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
