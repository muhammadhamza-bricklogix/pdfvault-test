"use client";

import type { Document } from "@/lib/shared/types/documents.types";

import { useAuth } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  putPdfBytes,
  readCachedDocument,
  readPdfBytes,
  upsertCachedDocument,
} from "@/lib/client/offline";
import { usePdfEditorStore } from "@/lib/client/stores/pdf-editor-store";
import { gateEntitledAction } from "@/lib/client/utils/gate-entitled-action";
import { documentsService } from "@/lib/shared/api/services/documents.service";
import { ROUTES } from "@/lib/shared/constants/routes";
import { EVENTS } from "@/lib/shared/utils/analytics-events";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

type LoadedDoc = {
  file: File;
  id: string;
  name: string;
  editorState: string | null;
};

type EditorStateEnvelope = {
  v: 1;
  watermarkConfig?: Record<string, unknown>;
  backgroundImageConfig?: Record<string, unknown>;
  fabricJsonByPage?: Record<string, string>;
  extractedPages?: number[];
};

// Module-scope in-flight caches so React StrictMode's double-invocation (and
// any concurrent mounts) share a single network round-trip per document id.

// Fast path: just the API call that returns the signed URL + editorState.
const inflightMeta = new Map<string, Promise<Document>>();

// Full path: API call + blob download + IDB write-through.
const inflightDoc = new Map<string, Promise<LoadedDoc>>();

/**
 * Read the doc from the IDB offline cache. Returns null if either the bytes
 * blob or the metadata entry is missing — partial cache hits aren't enough
 * to construct a `LoadedDoc` (we need filename + contentType from bytes and
 * editorState from metadata).
 */
async function loadFromOfflineCache(
  userId: string | null | undefined,
  id: string,
): Promise<LoadedDoc | null> {
  if (!userId) return null;

  const bytes = await readPdfBytes(userId, id);

  if (!bytes) return null;

  const meta = await readCachedDocument(userId, id);
  const file = new File([bytes.blob], bytes.filename, {
    type: bytes.contentType,
  });

  return {
    file,
    id,
    name: bytes.filename,
    editorState: meta?.editorState ?? null,
  };
}

/**
 * Fast phase — fetches only the API metadata (signed URL + editorState). Used
 * by `useEditorDocumentLoader` to set `pdfSourceUrl` immediately so pdf.js can
 * start streaming pages via range requests while the blob download runs in
 * parallel. Deduped with `inflightMeta` to avoid double API calls.
 *
 * Not called when offline — callers should fall through to `loadDocument` which
 * handles the IDB cache path.
 */
function fetchDocumentMeta(id: string): Promise<Document> {
  const existing = inflightMeta.get(id);

  if (existing) return existing;

  // Post-upload race guard: right after `POST /documents/upload` returns
  // 201 with a fresh id, the URL updates to `?id=<newId>` and this
  // fetcher fires immediately. On staging/prod behind Railway (and any
  // deployment with Postgres replica lag or async cache invalidation),
  // the `GET /documents/{id}` races the write commit and returns 404
  // for a brief window. Without a retry the user gets bounced to
  // /dashboard on every upload — the exact symptom reported 2026-08-20
  // and again 2026-08-24 when the single 1500ms retry wasn't long enough.
  //
  // Retry up to 3 times with exponential backoff (500ms, 1500ms, 3000ms
  // = ~5s total wait) on 404 only. 401 / 500 / network errors pass
  // through unchanged so real failures still surface fast. A real
  // "document doesn't exist" 404 stays 404 after all retries, so the
  // dashboard bounce still fires for genuinely bad ids — just not for
  // freshly-created ones.
  const RETRY_DELAYS_MS = [500, 1500, 3000];
  const promise = (async () => {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        return await documentsService.getDocument(id);
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode;
        const isLastAttempt = attempt === RETRY_DELAYS_MS.length;

        if (status !== 404 || isLastAttempt) throw err;
        logger.warn(
          `[PDFedits] document meta 404 — retrying (${attempt + 1}/${RETRY_DELAYS_MS.length})`,
          { id, delayMs: RETRY_DELAYS_MS[attempt] },
        );
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
      }
    }
    // Unreachable — loop always returns or throws — TypeScript needs the
    // explicit path for return-type inference.
    throw new Error("unreachable");
  })().finally(() => {
    inflightMeta.delete(id);
  });

  inflightMeta.set(id, promise);

  return promise;
}

/**
 * Full load — API call (deduped with `inflightMeta`) + blob download + IDB
 * write-through. Returns the bytes as a File so the save/export pipeline has
 * local bytes in memory. Falls back to IDB cache when offline or on error.
 */
function loadDocument(
  id: string,
  userId: string | null | undefined,
): Promise<LoadedDoc> {
  const existing = inflightDoc.get(id);

  if (existing) return existing;

  const promise = (async () => {
    const isOnline = typeof navigator === "undefined" ? true : navigator.onLine;

    // Offline branch — cache or bust. We don't even attempt the network
    // since fetch(doc.url) would throw and then we'd still fall back here.
    if (!isOnline) {
      const cached = await loadFromOfflineCache(userId, id);

      if (cached) return cached;
      throw new Error(
        "This document isn't available offline. Connect to the internet to open it.",
      );
    }

    try {
      // Reuse the in-flight meta promise so the API call only happens once
      // even when fetchDocumentMeta() and loadDocument() fire concurrently.
      const doc = await fetchDocumentMeta(id);

      // `cache: "no-store"` — the signed URL often points to the same object
      // key after a save/restore, so the browser may serve a stale cached
      // response unless we explicitly bypass the cache (reported 2026-07-23:
      // restored/current PDFs don't reflect the latest bytes until a hard
      // refresh).
      const res = await fetch(doc.url, { cache: "no-store" });

      if (!res.ok) throw new Error(`Failed to fetch PDF (${res.status})`);
      const blob = await res.blob();
      const file = new File([blob], doc.filename, { type: doc.contentType });

      // Write-through: stash the bytes + freshen metadata so the next
      // offline open of this doc works without network. Failures here are
      // logged but don't surface — the in-session experience is fine.
      if (userId) {
        await Promise.all([
          putPdfBytes(userId, {
            id: doc.id,
            blob,
            filename: doc.filename,
            contentType: doc.contentType,
          }),
          upsertCachedDocument(userId, doc),
        ]);
      }

      return {
        file,
        id: doc.id,
        name: doc.filename,
        editorState: doc.editorState ?? null,
      };
    } catch (err) {
      // Network failed mid-flight (true offline, S3 hiccup, auth blip).
      // Best-effort cache fallback before propagating the error.
      const cached = await loadFromOfflineCache(userId, id);

      if (cached) {
        logger.warn(
          "[offline] served editor doc from cache after fetch failure",
          { id, err: err instanceof Error ? err.message : String(err) },
        );

        return cached;
      }

      throw err;
    }
  })().finally(() => {
    inflightDoc.delete(id);
  });

  inflightDoc.set(id, promise);

  return promise;
}

/**
 * Hydrates the editor from `?id=<documentId>` when the store has no file.
 * Fetches the signed download URL, downloads the bytes, and seeds the store.
 */
export function useEditorDocumentLoader() {
  const { isLoaded: authLoaded, isSignedIn, userId } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const file = usePdfEditorStore((s) => s.file);
  const currentDocumentId = usePdfEditorStore((s) => s.currentDocumentId);
  const clearFile = usePdfEditorStore((s) => s.clearFile);
  const setFile = usePdfEditorStore((s) => s.setFile);
  const setCurrentDocument = usePdfEditorStore((s) => s.setCurrentDocument);
  const setPdfSourceUrl = usePdfEditorStore((s) => s.setPdfSourceUrl);
  const lastHydratedDocumentId = useRef<string | null>(null);

  useEffect(() => {
    if (!id) {
      lastHydratedDocumentId.current = null;

      return;
    }

    // Sign-in gate for ?id=<doc>. `/pdf-editor` is intentionally a
    // public route (the editor works in local-only mode without an
    // account), but fetching an existing document from the cloud
    // needs a signed-in user. Without this guard, signed-out visitors
    // hitting a share-style URL just see a "Couldn't open document"
    // toast over a blank editor — reported by QA 2026-06-16. Wait
    // for Clerk to finish loading before deciding so we don't bounce
    // signed-in users on first paint.
    if (authLoaded && !isSignedIn) {
      logger.event(EVENTS.DOCUMENT_LOADER_SIGNIN_REQUIRED, "info", { id });
      const back = `${ROUTES.TOOLS.PDF_EDITOR}?id=${encodeURIComponent(id)}`;

      router.replace(
        `${ROUTES.AUTH.SIGN_IN}?redirect_url=${encodeURIComponent(back)}`,
      );

      return;
    }

    if (!authLoaded) {
      // Clerk still booting — don't fire the doc fetch yet (it would
      // 401 anyway without a session token), and don't bounce to
      // sign-in (the user might be authenticated).
      return;
    }

    // Switching to a different document — reset store immediately so stale
    // annotations/state don't bleed through and skeleton shows instantly.
    if (currentDocumentId && currentDocumentId !== id) {
      clearFile();
      lastHydratedDocumentId.current = null;
    }

    const alreadyHydratedThisUrl = file != null && currentDocumentId === id;

    if (alreadyHydratedThisUrl) {
      lastHydratedDocumentId.current = id;

      return;
    }

    let cancelled = false;
    // Set to true when Phase 1 successfully seeds the editor state.
    // Phase 2 skips rehydrateEditorState when this is true to avoid
    // overwriting edits the user might have started during the blob download.
    let editorStateHydrated = false;

    const isOnline = typeof navigator === "undefined" ? true : navigator.onLine;

    // Phase 1 (fast, ~200ms): fetch signed URL from the API and pass it to
    // pdf.js immediately so the editor can stream pages via range requests
    // while the full blob downloads in the background. Skipped when offline
    // since there's no URL to stream from.
    if (isOnline) {
      fetchDocumentMeta(id)
        .then(async (doc) => {
          if (cancelled) return;

          // QA 2026-09-09 (spec Flow 1 + item #17 restore): converted PDFs
          // gate on Open. Non-entitled users hit the paywall BEFORE the
          // editor renders — otherwise they'd see the doc for free by
          // just knowing its URL. Native PDFs skip this gate (`doc.
          // originalContentType == null` returns true from the helper).
          // If the paywall is cancelled, bounce to /dashboard so the
          // user isn't stranded on a blank editor with an aborted load.
          const allowed = await gateEntitledAction(doc);

          if (cancelled) return;

          if (!allowed) {
            logger.info("[PDFedits] document loader: paywall gated", { id });
            router.replace(ROUTES.APP.DASHBOARD);

            return;
          }

          // Seed overlay state BEFORE setting the URL — usePdfLoader opens
          // the pdf.js document as soon as pdfSourceUrl is set, which triggers
          // the render pipeline. fabricJsonByPage must be in store by then.
          rehydrateEditorState(doc.editorState ?? null);
          editorStateHydrated = true;
          setPdfSourceUrl(doc.url);
        })
        .catch(() => {
          // Swallow: loadDocument (Phase 2) will handle the error and may
          // fall back to the IDB offline cache.
        });
    }

    logger.breadcrumb("document_loader", "load.start", { id, isOnline });

    // Phase 2 (slow, seconds for large PDFs): download the full bytes for the
    // save/export pipeline, write to IDB for offline use, then seed the store.
    loadDocument(id, userId)
      .then((loaded) => {
        if (cancelled) return;

        const state = usePdfEditorStore.getState();

        if (
          state.currentDocumentId === id &&
          state.file != null &&
          lastHydratedDocumentId.current === id
        ) {
          return;
        }

        // Only rehydrate if Phase 1 didn't already do it — otherwise we could
        // overwrite edits the user made during the (potentially long) blob
        // download. For the offline path (Phase 1 skipped), this is the first
        // and only call, so the BEFORE-setFile invariant still holds.
        if (!editorStateHydrated) {
          rehydrateEditorState(loaded.editorState);
        }

        setFile(loaded.file);
        setCurrentDocument({ id: loaded.id, name: loaded.name });
        usePdfEditorStore.setState({ hasUnsavedChanges: false });
        lastHydratedDocumentId.current = id;
        logger.event(EVENTS.DOCUMENT_LOADER_LOAD_OK, "info", {
          id,
          bytes: loaded.file.size,
          hasEditorState: Boolean(loaded.editorState),
        });
      })
      .catch((err) => {
        if (cancelled) return;

        // Belt-and-braces 401 handling: if Clerk reported signed-in
        // but the backend rejected the request (expired session,
        // revoked user, etc.), bounce to sign-in with a return path
        // instead of just toasting onto a blank editor.
        const message = err instanceof Error ? err.message : String(err);
        const isAuthError = /\b401\b|unauthori[sz]ed/i.test(message);

        if (isAuthError) {
          logger.event(EVENTS.DOCUMENT_LOADER_AUTH_ERROR_BOUNCE, "warning", {
            id,
          });
          const back = `${ROUTES.TOOLS.PDF_EDITOR}?id=${encodeURIComponent(id)}`;

          router.replace(
            `${ROUTES.AUTH.SIGN_IN}?redirect_url=${encodeURIComponent(back)}`,
          );

          return;
        }

        // Document doesn't exist / forbidden / any non-auth error → toast
        // and — only when there's truly nothing to show — bounce to
        // Dashboard so the user isn't stranded on a blank editor
        // (reported 2026-06-18: pasting an invalid `?id=` URL left a
        // permanently blank page).
        //
        // BUT if the editor already has a file loaded (typical when
        // `?id=` was written by the hydrator's auto-save right after
        // the user's own upload — race between store update, URL
        // replace, and this loader fetch), do NOT redirect. The user
        // has a working local session; bouncing to Dashboard mid-flow
        // dumps them out of the editor after sign-in for no reason
        // (reported 2026-07-18 on the export-after-sign-in flow).
        logger.captureError(err, "document_loader.load", { id });
        const stateNow = usePdfEditorStore.getState();

        if (stateNow.file) {
          logger.event(EVENTS.DOCUMENT_LOADER_LOAD_FAIL_STAY_LOCAL, "warning", {
            id,
          });
          toast.error({
            title: "Couldn't open saved document",
            description:
              "Continuing with your local copy — Save to persist edits.",
          });

          return;
        }

        logger.event(
          EVENTS.DOCUMENT_LOADER_LOAD_FAIL_BOUNCE_DASHBOARD,
          "warning",
          {
            id,
          },
        );
        toast.error({
          title: "Couldn't open document",
          description: message,
        });
        router.replace(ROUTES.APP.DASHBOARD);
      });

    return () => {
      cancelled = true;
    };
  }, [
    id,
    file,
    currentDocumentId,
    clearFile,
    setFile,
    setCurrentDocument,
    setPdfSourceUrl,
    authLoaded,
    isSignedIn,
    userId,
    router,
  ]);
}

/**
 * Restores `watermarkConfig`, `backgroundImageConfig`, and `fabricJsonByPage`
 * from the persisted editor-state envelope. Also pre-seeds the
 * `lastBaked*Signature` fields so the first save after a refresh recognizes
 * "these overlays were already baked into the source bytes" and doesn't
 * re-apply them (which would stack at the configured opacity).
 *
 * Tolerant of malformed input: any parse failure is logged and skipped,
 * leaving the default config in place — the user just falls back to the
 * legacy "re-extract text on load" behavior for that session.
 */
function rehydrateEditorState(editorState: string | null) {
  // REHYDRATE-DIAG: log the raw envelope so we can tell whether the backend
  // returned editorState at all, whether the payload is the trimmed (no
  // imageData) variant, and how many pages carry Fabric objects. Pairs with
  // `[PDFedits] PERSIST-DIAG` on the save side.
  logger.info("[PDFedits] REHYDRATE-DIAG: entry", {
    hasEditorState: Boolean(editorState),
    editorStateLen: editorState?.length ?? 0,
  });

  if (!editorState) {
    logger.warn(
      "[PDFedits] REHYDRATE-DIAG: no editorState on document — watermark / bg image / editModeText overlays / extractedPages will NOT be restored; only baked PDF bytes will show",
    );

    return;
  }

  let parsed: EditorStateEnvelope;

  try {
    const candidate = JSON.parse(editorState) as EditorStateEnvelope;

    if (candidate?.v !== 1) {
      logger.warn(
        "[PDFedits] REHYDRATE-DIAG: envelope version mismatch, skipping",
        { v: candidate?.v },
      );

      return;
    }
    parsed = candidate;
  } catch (err) {
    logger.warn?.(
      "Failed to parse stored editorState; skipping rehydration",
      err,
    );

    return;
  }

  const wm = parsed.watermarkConfig as
    | { enabled?: boolean; imageData?: string | null; text?: string }
    | undefined;
  const bg = parsed.backgroundImageConfig as
    | { enabled?: boolean; imageData?: string | null }
    | undefined;
  const fabricPageKeys = parsed.fabricJsonByPage
    ? Object.keys(parsed.fabricJsonByPage)
    : [];
  const fabricPageObjectCounts: Record<string, number> = {};

  if (parsed.fabricJsonByPage) {
    for (const [page, json] of Object.entries(parsed.fabricJsonByPage)) {
      try {
        const p = JSON.parse(json as string) as { objects?: unknown[] };

        fabricPageObjectCounts[page] = p.objects?.length ?? 0;
      } catch {
        fabricPageObjectCounts[page] = -1;
      }
    }
  }
  logger.info("[PDFedits] REHYDRATE-DIAG: parsed envelope", {
    watermark: {
      present: Boolean(wm),
      enabled: wm?.enabled,
      hasImageData: Boolean(wm?.imageData),
      imageDataLen: wm?.imageData ? wm.imageData.length : 0,
      hasText: Boolean(wm?.text),
    },
    backgroundImage: {
      present: Boolean(bg),
      enabled: bg?.enabled,
      hasImageData: Boolean(bg?.imageData),
      imageDataLen: bg?.imageData ? bg.imageData.length : 0,
    },
    fabricPageKeys,
    fabricPageObjectCounts,
    extractedPages: parsed.extractedPages ?? [],
  });

  if (wm?.enabled && !wm.imageData) {
    logger.warn(
      "[PDFedits] REHYDRATE-DIAG: watermark enabled but imageData missing — most likely trimmed at save time (payload > 800 KB soft cap); live preview will not render the image",
    );
  }
  if (bg?.enabled && !bg.imageData) {
    logger.warn(
      "[PDFedits] REHYDRATE-DIAG: backgroundImage enabled but imageData missing — most likely trimmed at save time (payload > 800 KB soft cap); live preview will not render the image",
    );
  }

  const current = usePdfEditorStore.getState();
  const patch: Partial<ReturnType<typeof usePdfEditorStore.getState>> = {};

  // Restore the user's watermark / bg-image config so the editor's live
  // preview comes back exactly where they left it. The cloud-saved PDF does
  // NOT contain these overlays (Save passes bakeOverlays:false), so showing
  // the live preview here doesn't double up — it IS the only render of the
  // watermark on the editor canvas. Export re-bakes them on download.
  if (parsed.watermarkConfig) {
    patch.watermarkConfig = {
      ...current.watermarkConfig,
      ...parsed.watermarkConfig,
    } as typeof current.watermarkConfig;
  }

  if (parsed.backgroundImageConfig) {
    patch.backgroundImageConfig = {
      ...current.backgroundImageConfig,
      ...parsed.backgroundImageConfig,
    } as typeof current.backgroundImageConfig;
  }

  if (parsed.fabricJsonByPage) {
    const restoredMap = new Map<number, string>();

    for (const [page, json] of Object.entries(parsed.fabricJsonByPage)) {
      const numericPage = Number(page);

      if (Number.isFinite(numericPage) && typeof json === "string") {
        restoredMap.set(numericPage, json);
      }
    }
    patch.fabricJsonByPage = restoredMap;
  }

  if (Array.isArray(parsed.extractedPages)) {
    patch.extractedPages = new Set(
      parsed.extractedPages.filter((p): p is number => Number.isFinite(p)),
    );
  }

  if (Object.keys(patch).length > 0) {
    usePdfEditorStore.setState(patch);
  }
}

/**
 * Reload the editor with a `Document` payload returned by a mutation that
 * changed the current doc's bytes (e.g. `restoreVersion`). The signed
 * `url` on the payload is fresh, so we fetch straight from there instead
 * of round-tripping through the loader effect — which sometimes doesn't
 * refire deterministically after `clearFile()` on the same `?id=`
 * (reported 2026-07-23: "restore succeeds but I have to refresh").
 */
export async function reloadEditorFromDocument(
  doc: Document,
  userId?: string | null,
  restoredFileUrl?: string,
): Promise<void> {
  // Bypass the browser cache for restored bytes — the signed URL may reuse
  // the same object key, and without this the user sees the pre-restore
  // PDF until they hard-refresh (reported 2026-07-23).
  // `restoredFileUrl` lets the caller pass the immutable version-snapshot
  // URL instead of relying on the root document URL, which can still point
  // to the pre-restore bytes immediately after `restoreVersion` returns.
  const urlToFetch = restoredFileUrl ?? doc.url;
  const res = await fetch(urlToFetch, { cache: "no-store" });

  if (!res.ok) throw new Error(`Failed to fetch restored PDF (${res.status})`);
  const blob = await res.blob();
  const nextFile = new File([blob], doc.filename, { type: doc.contentType });

  // Write-through to IDB with the restored bytes + metadata. Without this,
  // a subsequent open of the same doc could serve the PRE-restore blob
  // from the offline cache (reported 2026-07-23: "reopen after restore
  // shows the old edited version until I refresh"). Best-effort — a
  // failure here shouldn't block the in-session swap that follows.
  if (userId) {
    try {
      await Promise.all([
        putPdfBytes(userId, {
          id: doc.id,
          blob,
          filename: doc.filename,
          contentType: doc.contentType,
        }),
        upsertCachedDocument(userId, doc),
      ]);
    } catch (err) {
      logger.warn?.("[reloadEditorFromDocument] IDB write-through failed", err);
    }
  }

  // Wipe overlay/history state first so stale edits don't paint on top of
  // the restored bytes. `clearFile` also resets `file` to null; that null
  // window is fine because we immediately swap in the new file below and
  // the loader's `alreadyHydratedThisUrl` guard prevents a duplicate fetch
  // once we've written `file` + `currentDocumentId`.
  usePdfEditorStore.getState().clearFile();

  // Seed watermark / bg-image / fabricJsonByPage from the version's stored
  // editor state, matching what the loader does on a cold open.
  rehydrateEditorState(doc.editorState ?? null);

  usePdfEditorStore.setState({
    file: nextFile,
    currentDocumentId: doc.id,
    currentDocumentName: doc.filename,
    hasUnsavedChanges: false,
  });
}
