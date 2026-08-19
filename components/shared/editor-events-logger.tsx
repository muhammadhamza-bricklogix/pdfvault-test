"use client";

import { useEffect, useRef } from "react";

import { usePdfEditorStore } from "@/lib/client/stores";
import { logger } from "@/lib/shared/utils/logger";

/**
 * Centralised editor-lifecycle observer. Subscribes to the pdf-editor
 * Zustand store and emits Sentry breadcrumbs / context updates on:
 *
 *   - activeTool switches            → breadcrumb "editor" / "tool.change"
 *   - file loaded / cleared          → breadcrumb + context update
 *   - currentDocumentId changes      → Sentry context "editor.document"
 *
 * Living in one place beats sprinkling `logger.breadcrumb` calls across
 * every tool hook and keeps the load-bearing hook files under
 * `.claude/LOCKED_PATHS` untouched. If a specific tool starts producing
 * errors, add per-tool spans then; until then this covers the story of
 * "what was the user doing when it broke".
 */
export function EditorEventsLogger(): null {
  const lastToolRef = useRef<string | null>(null);
  const lastFileRef = useRef<string | null>(null);
  const lastDocIdRef = useRef<null | string>(null);

  useEffect(() => {
    const emit = (state: ReturnType<typeof usePdfEditorStore.getState>) => {
      if (state.activeTool !== lastToolRef.current) {
        const previous = lastToolRef.current;

        lastToolRef.current = state.activeTool;
        if (previous !== null) {
          logger.breadcrumb("editor", "tool.change", {
            from: previous,
            to: state.activeTool,
          });
        }
      }

      const fileSig = state.file
        ? `${state.file.name}|${state.file.size}`
        : null;

      if (fileSig !== lastFileRef.current) {
        lastFileRef.current = fileSig;
        if (fileSig) {
          logger.breadcrumb("editor", "file.loaded", {
            filename: state.file?.name,
            size: state.file?.size,
            pageCount: state.pdfDocument?.numPages ?? null,
          });
        } else {
          logger.breadcrumb("editor", "file.cleared");
        }
      }

      if (state.currentDocumentId !== lastDocIdRef.current) {
        lastDocIdRef.current = state.currentDocumentId ?? null;
        logger.setContext(
          "editor.document",
          state.currentDocumentId
            ? {
                id: state.currentDocumentId,
                name: state.currentDocumentName ?? null,
              }
            : null,
        );
      }
    };

    // Emit for initial state so events after mount already have context.
    emit(usePdfEditorStore.getState());

    return usePdfEditorStore.subscribe(emit);
  }, []);

  return null;
}
