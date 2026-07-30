/**
 * Persists a pending editor `File` across the Clerk sign-in redirect so
 * a signed-out visitor can drop a PDF on the landing page and land back
 * in the editor with the same file already loaded, instead of having to
 * re-pick it.
 *
 * Zustand alone doesn't survive Clerk's full-page nav to `/sign-in` and
 * back, so we mirror the File blob into IndexedDB just before the
 * redirect and rehydrate it on `/pdf-composer` mount.
 *
 * Markers expire after 30 minutes so a stale file can't silently override
 * a fresh explicit upload later on.
 *
 * `fabricState` captures the per-page Fabric overlay JSON so that any edits
 * the user made before clicking Download (while signed out) survive the
 * sign-in redirect and appear correctly on return.
 */

const DB_NAME = "pdfvault_pending_editor";
const STORE_NAME = "files";
const DB_VERSION = 1;
const RECORD_KEY = "current";
const MAX_AGE_MS = 30 * 60 * 1000;

interface PendingRecord {
  file: File;
  ts: number;
  /** Serialized Map<number, string> — IDB can't store Map directly. */
  fabricState?: Array<[number, string]>;
  /** Source page numbers that had their text extracted into Fabric IText. */
  extractedPages?: number[];
}

export interface PendingEditorFileResult {
  file: File;
  /** Restored per-page Fabric JSON, or null if no edits were saved. */
  fabricJsonByPage: Map<number, string> | null;
  /**
   * Pages that were in IText-overlay mode before the redirect. Restoring
   * this keeps `suppressText=true` for those pages so pdf.js doesn't render
   * native text underneath the recovered Fabric overlay (which would produce
   * a double text layer visible to the user after sign-in).
   */
  extractedPages: Set<number> | null;
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

export async function savePendingEditorFile(
  file: File,
  fabricJsonByPage?: Map<number, string>,
  extractedPages?: Set<number>,
): Promise<void> {
  const db = await open();

  if (!db) return;

  const record: PendingRecord = {
    file,
    ts: Date.now(),
    fabricState:
      fabricJsonByPage && fabricJsonByPage.size > 0
        ? Array.from(fabricJsonByPage.entries())
        : undefined,
    extractedPages:
      extractedPages && extractedPages.size > 0
        ? Array.from(extractedPages)
        : undefined,
  };

  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");

    tx.objectStore(STORE_NAME).put(record, RECORD_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
  db.close();
}

export async function loadPendingEditorFile(): Promise<PendingEditorFileResult | null> {
  const db = await open();

  if (!db) return null;
  const record = await new Promise<PendingRecord | undefined>((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(RECORD_KEY);

    req.onsuccess = () => resolve(req.result as PendingRecord | undefined);
    req.onerror = () => resolve(undefined);
  });

  db.close();

  if (!record) return null;
  if (Date.now() - record.ts > MAX_AGE_MS) {
    await clearPendingEditorFile();

    return null;
  }

  return {
    file: record.file,
    fabricJsonByPage: record.fabricState
      ? new Map(record.fabricState)
      : null,
    extractedPages: record.extractedPages
      ? new Set(record.extractedPages)
      : null,
  };
}

export async function clearPendingEditorFile(): Promise<void> {
  const db = await open();

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
