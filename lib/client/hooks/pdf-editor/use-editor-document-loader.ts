"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { usePdfEditorStore } from "@/lib/client/stores/pdf-editor-store";
import { documentsService } from "@/lib/shared/api/services/documents.service";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

type LoadedDoc = { file: File; id: string; name: string };

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

    return { file, id: doc.id, name: doc.filename };
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

    const alreadyHydratedThisUrl =
      lastHydratedDocumentId.current === id &&
      file != null &&
      currentDocumentId === id;

    if (alreadyHydratedThisUrl) return;

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
