"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { usePdfEditorStore } from "@/lib/client/stores/pdf-editor-store";
import { documentsService } from "@/lib/shared/api/services/documents.service";
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
};

// Module-scope in-flight cache so React StrictMode's double-invocation (and
// any concurrent mounts) share a single network round-trip per document id.
const inflight = new Map<string, Promise<LoadedDoc>>();

function loadDocument(id: string): Promise<LoadedDoc> {
  const existing = inflight.get(id);

  if (existing) return existing;

  const promise = (async () => {
    const doc = await documentsService.getDocument(id);
    const res = await fetch(doc.url);

    if (!res.ok) throw new Error(`Failed to fetch PDF (${res.status})`);
    const blob = await res.blob();
    const file = new File([blob], doc.filename, { type: doc.contentType });

    return {
      file,
      id: doc.id,
      name: doc.filename,
      editorState: doc.editorState ?? null,
    };
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

    loadDocument(id)
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
        logger.error("Failed to load document for editor", err);
        toast.error({
          title: "Couldn't open document",
          description: err instanceof Error ? err.message : undefined,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [id, file, currentDocumentId, clearFile, setFile, setCurrentDocument]);
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

  if (Object.keys(patch).length > 0) {
    usePdfEditorStore.setState(patch);
  }
}
