"use client";

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
import { documentsService } from "@/lib/shared/api/services/documents.service";
import { ROUTES } from "@/lib/shared/constants/routes";
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

// Module-scope in-flight cache so React StrictMode's double-invocation (and
// any concurrent mounts) share a single network round-trip per document id.
const inflight = new Map<string, Promise<LoadedDoc>>();

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

function loadDocument(
  id: string,
  userId: string | null | undefined,
): Promise<LoadedDoc> {
  const existing = inflight.get(id);

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
      const doc = await documentsService.getDocument(id);
      const res = await fetch(doc.url);

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
    inflight.delete(id);
  });

  inflight.set(id, promise);

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

        // Rehydrate the editor overlay state BEFORE we set the file. The
        // file change triggers use-pdf-loader → pdf.js parse → page render,
        // and use-edit-text-mode reads fabricJsonByPage to decide whether
        // to re-extract text. Seeding first means re-extraction is skipped
        // for any page with stored Fabric JSON, so text lands exactly where
        // the user left it (no fontkit/pdf.js width drift).
        rehydrateEditorState(loaded.editorState);

        setFile(loaded.file);
        setCurrentDocument({ id: loaded.id, name: loaded.name });
        usePdfEditorStore.setState({ hasUnsavedChanges: false });
        lastHydratedDocumentId.current = id;
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
          const back = `${ROUTES.TOOLS.PDF_EDITOR}?id=${encodeURIComponent(id)}`;

          router.replace(
            `${ROUTES.AUTH.SIGN_IN}?redirect_url=${encodeURIComponent(back)}`,
          );

          return;
        }

        // Document doesn't exist / forbidden / any non-auth error → toast
        // then bounce to Dashboard so the user isn't stranded on a blank
        // editor. Reported 2026-06-18: pasting an invalid `?id=` URL
        // left a permanently blank page in both web and mobile views.
        // 404 / 403 / network errors all funnel here; the toast carries
        // the specific reason while the redirect ensures the user has a
        // place to go next.
        logger.error("Failed to load document for editor", err);
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
  if (!editorState) return;

  let parsed: EditorStateEnvelope;

  try {
    const candidate = JSON.parse(editorState) as EditorStateEnvelope;

    if (candidate?.v !== 1) return;
    parsed = candidate;
  } catch (err) {
    logger.warn?.(
      "Failed to parse stored editorState; skipping rehydration",
      err,
    );

    return;
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
