"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { documentsService } from "@/lib/shared/api/services/documents.service";
import { usePdfEditorStore } from "@/lib/client/stores/pdf-editor-store";

/**
 * Hydrates the editor from `?id=<documentId>` when the store has no file.
 * Fetches the signed download URL, downloads the bytes, and seeds the store.
 */
export function useEditorDocumentLoader() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const file = usePdfEditorStore((s) => s.file);
  const currentDocumentId = usePdfEditorStore((s) => s.currentDocumentId);
  const setFile = usePdfEditorStore((s) => s.setFile);
  const setCurrentDocument = usePdfEditorStore((s) => s.setCurrentDocument);
  const loadingIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!id) return;
    if (currentDocumentId === id && file) return;
    if (loadingIdRef.current === id) return;
    loadingIdRef.current = id;

    let cancelled = false;

    (async () => {
      try {
        const doc = await documentsService.getDocument(id);
        const res = await fetch(doc.url);
        const blob = await res.blob();
        const loaded = new File([blob], doc.filename, {
          type: doc.contentType,
        });

        if (cancelled) return;
        setFile(loaded);
        setCurrentDocument({ id: doc.id, name: doc.filename });
      } finally {
        if (loadingIdRef.current === id) loadingIdRef.current = null;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, file, currentDocumentId, setFile, setCurrentDocument]);
}
