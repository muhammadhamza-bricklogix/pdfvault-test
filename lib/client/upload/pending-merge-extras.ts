/**
 * Persists the MergePdfModal `extras` (the additional PDFs the user
 * attached before clicking Merge & Download) across the Clerk sign-in
 * round trip so a signed-out user can hit paywall + payment on return
 * without losing their attachment list. Mirrors the compress signin
 * flow (QA 2026-09-16): guest clicks Merge & Download → email-first
 * modal → auto-signup → returns to `/pdf-composer?tool=merge` → the
 * MergePdfModal's mount effect restores these extras + auto-fires
 * `handleMerge` which opens the paywall directly.
 *
 * Kept separate from `pending-editor-file.ts` (which stores the source
 * File + fabric state) so the two records can be cleared independently
 * and the extras record doesn't pollute the general pending-file store
 * for flows that don't involve merging.
 *
 * Records expire after 30 minutes to prevent stale extras from being
 * silently reused on a much-later paywall gate.
 */

import type { MergeEntry } from "@/lib/client/pdf-tools/merge-pdfs";

const DB_NAME = "pdfvault_pending_merge";
const STORE_NAME = "extras";
const DB_VERSION = 1;
const RECORD_KEY = "current";
const MAX_AGE_MS = 30 * 60 * 1000;

interface PendingMergeExtrasRecord {
  /** Each entry stored with a plain Uint8Array copy so IDB serialises it. */
  extras: MergeEntry[];
  ts: number;
}

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);

      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

export async function saveMergeExtras(extras: MergeEntry[]): Promise<void> {
  const db = await open();

  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const record: PendingMergeExtrasRecord = { extras, ts: Date.now() };

    store.put(record, RECORD_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
  db.close();
}

export async function loadMergeExtras(): Promise<MergeEntry[] | null> {
  const db = await open();

  if (!db) return null;
  const record = await new Promise<PendingMergeExtrasRecord | null>(
    (resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(RECORD_KEY);

      req.onsuccess = () =>
        resolve((req.result as PendingMergeExtrasRecord) ?? null);
      req.onerror = () => resolve(null);
    },
  );

  db.close();
  if (!record) return null;
  if (Date.now() - record.ts > MAX_AGE_MS) {
    void clearMergeExtras();

    return null;
  }

  return record.extras;
}

export async function clearMergeExtras(): Promise<void> {
  const db = await open();

  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    store.delete(RECORD_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
  db.close();
}
