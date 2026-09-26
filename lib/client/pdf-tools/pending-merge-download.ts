import type { MergeEntry } from "./merge-pdfs";

const DB_NAME = "pdfvault_pending_merge_download";
const STORE_NAME = "requests";
const DB_VERSION = 1;
const RECORD_KEY = "current";
const SESSION_FLAG_KEY = "pdfvault_pending_merge_download";
const MAX_AGE_MS = 30 * 60 * 1000;

type PendingMergeDownloadRecord = {
  extras: MergeEntry[];
  autoDownload: boolean;
  ts: number;
};

export type PendingMergeDownload = {
  extras: MergeEntry[];
  autoDownload: boolean;
};

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

function markPendingContinuation(): void {
  try {
    window.sessionStorage.setItem(SESSION_FLAG_KEY, "1");
  } catch {
    /* sessionStorage is best-effort */
  }
}

function consumePendingContinuation(): boolean {
  try {
    const hasMarker = window.sessionStorage.getItem(SESSION_FLAG_KEY) === "1";

    window.sessionStorage.removeItem(SESSION_FLAG_KEY);

    return hasMarker;
  } catch {
    return false;
  }
}

export async function savePendingMergeDownload(
  extras: MergeEntry[],
  autoDownload = true,
): Promise<boolean> {
  const db = await open();

  if (!db) return false;

  const record: PendingMergeDownloadRecord = {
    extras,
    autoDownload,
    ts: Date.now(),
  };

  const saved = await new Promise<boolean>((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");

    tx.objectStore(STORE_NAME).put(record, RECORD_KEY);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
    tx.onabort = () => resolve(false);
  });

  db.close();
  if (saved) markPendingContinuation();

  return saved;
}

export async function loadPendingMergeDownload(): Promise<PendingMergeDownload | null> {
  const shouldContinue = consumePendingContinuation();
  const cameFromMergeReturn =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("tool") === "merge";

  if (!shouldContinue && !cameFromMergeReturn) return null;

  const db = await open();

  if (!db) return null;

  const record = await new Promise<PendingMergeDownloadRecord | undefined>(
    (resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(RECORD_KEY);

      req.onsuccess = () =>
        resolve(req.result as PendingMergeDownloadRecord | undefined);
      req.onerror = () => resolve(undefined);
    },
  );

  db.close();

  if (!record) return null;

  await clearPendingMergeDownload();

  if (Date.now() - record.ts > MAX_AGE_MS || record.extras.length === 0) {
    return null;
  }

  return {
    autoDownload: record.autoDownload,
    extras: record.extras,
  };
}

export async function clearPendingMergeDownload(): Promise<void> {
  const db = await open();

  try {
    window.sessionStorage.removeItem(SESSION_FLAG_KEY);
  } catch {
    /* sessionStorage is best-effort */
  }

  if (!db) return;

  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");

    tx.objectStore(STORE_NAME).delete(RECORD_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
  db.close();
}
