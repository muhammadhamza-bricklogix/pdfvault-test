"use client";

import { useEffect } from "react";

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
 * `.claude/LOCKED_PATHS` untouched.
 *
 * Refs live at module scope so a route re-mount doesn't re-emit
 * already-recorded state (each field only crosses the wire once per
 * real change, not once per component mount).
 */
let lastTool: string | null = null;
let lastFileSig: null | string = null;
let lastDocId: null | string = null;

export function EditorEventsLogger(): null {
  useEffect(() => {
    return usePdfEditorStore.subscribe((state) => {
      if (state.activeTool !== lastTool) {
        const previous = lastTool;

        lastTool = state.activeTool;
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

      if (fileSig !== lastFileSig) {
        lastFileSig = fileSig;
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

      const docId = state.currentDocumentId ?? null;

      if (docId !== lastDocId) {
        lastDocId = docId;
        logger.setContext(
          "editor.document",
          docId ? { id: docId, name: state.currentDocumentName ?? null } : null,
        );
      }
    });
  }, []);

  return null;
}
