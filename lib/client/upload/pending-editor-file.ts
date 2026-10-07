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

import type { Canvas as FabricCanvas } from "fabric";

import { flushLiveFabricPage } from "@/lib/client/pdf-editor/save-utils";
import { usePdfEditorStore } from "@/lib/client/stores";

const DB_NAME = "pdfvault_pending_editor";
const STORE_NAME = "files";
const DB_VERSION = 1;
const RECORD_KEY = "current";
const MAX_AGE_MS = 30 * 60 * 1000;

interface PendingRecord {
  /** Legacy records stored the File itself (rejected by WebKit private mode). */
  file?: File;
  /** File bytes; WebKit private browsing refuses Blob/File values in IndexedDB. */
  bytes?: ArrayBuffer;
  name?: string;
  type?: string;
  lastModified?: number;
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
  const bytes = await file.arrayBuffer();
  const db = await open();

  if (!db) return;

  const record: PendingRecord = {
    bytes,
    name: file.name,
    type: file.type,
    lastModified: file.lastModified,
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

  const saved = await new Promise<boolean>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");

      tx.objectStore(STORE_NAME).put(record, RECORD_KEY);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });

  db.close();
  if (!saved) throw new Error("pending editor file: IndexedDB write failed");
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

  const file = record.bytes
    ? new File([record.bytes], record.name ?? "document.pdf", {
        type: record.type || "application/pdf",
        lastModified: record.lastModified,
      })
    : record.file;

  if (!file) return null;

  return {
    file,
    fabricJsonByPage: record.fabricState ? new Map(record.fabricState) : null,
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

/**
 * Snapshots the current PDF editor store to IndexedDB so a full-page
 * sign-in redirect (or any other unload) can be resumed with the file,
 * per-page Fabric overlay JSON, and extractedPages set intact.
 *
 * Every in-editor sign-in path funnels through this so callers can't
 * accidentally save `file` without the edits — losing fabric overlays
 * on return is the "first-time login drops my edits" bug.
 *
 * Optionally flushes the live Fabric canvas for the current page into
 * the store before serializing so the snapshot includes any in-flight
 * edits the store hasn't observed yet.
 *
 * No-ops (resolves false) when the store has no file loaded. Errors are
 * swallowed — the caller has already committed to the redirect and the
 * hydrator's normal rehydrate path is a viable fallback.
 */
export async function snapshotPendingEditorFile(
  liveFabricCanvas?: FabricCanvas | null,
): Promise<boolean> {
  const state = usePdfEditorStore.getState();
  const file = state.file;

  if (!file) return false;

  if (liveFabricCanvas) {
    try {
      flushLiveFabricPage(state.currentPage, liveFabricCanvas);
    } catch {
      // Flush failures shouldn't block the snapshot — the store's last
      // observed JSON for the page is still saved below.
    }
  }

  const { fabricJsonByPage, extractedPages } = usePdfEditorStore.getState();

  try {
    await savePendingEditorFile(file, fabricJsonByPage, extractedPages);

    return true;
  } catch {
    return false;
  }
}
