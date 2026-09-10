import type { DraftPage } from "@/lib/client/hooks/pdf-editor/manage-pages-types";
import type { PDFDocumentProxy } from "pdfjs-dist";

import { buildPdfFromDraft } from "@/lib/client/pdf-editor/build-pages-pdf";
import { remapFabricAfterPageOps } from "@/lib/client/pdf-editor/remap-fabric-after-page-ops";

type MaterializeInput = {
  extractedPages: Set<number>;
  fabricJsonByPage: Map<number, string>;
  historyByPage: Map<number, string[]>;
  historyIndexByPage: Map<number, number>;
  pageOrder: number[];
  pdfDocument: PDFDocumentProxy;
  sourceBytes: ArrayBuffer;
};

export type MaterializedReorder = {
  extractedPages: Set<number>;
  fabricJsonByPage: Map<number, string>;
  historyByPage: Map<number, string[]>;
  historyIndexByPage: Map<number, number>;
  sourceBytes: Uint8Array;
};

export function isIdentityOrder(pageOrder: number[]): boolean {
  for (let i = 0; i < pageOrder.length; i += 1) {
    if (pageOrder[i] !== i + 1) return false;
  }

  return true;
}

/**
 * Returns a copy of `fabricJsonByPage` with every `editorType === "pageNumber"`
 * object removed. Used by the cloud Save path so `mergeFabricEditsIntoPdf` does
 * NOT draw the page-number labels into the PDF content stream — they stay as
 * Fabric overlays, restored from `editorState.fabricJsonByPage` on reload.
 *
 * Why never bake on Save: the bake-then-strip approach (2026-06-18) breaks on
 * pages in `extractedPages` where `PdfViewerCanvas` sets `suppressText: true`
 * to hide pdf.js's native text — baked `pageNumber` text gets suppressed
 * along with everything else and the user sees nothing. Treating page numbers
 * as overlay-only avoids that entire failure mode. Trade-off: cloud-saved PDF
 * opened in a third-party reader won't show page numbers (only the editor
 * renders them via Fabric). The download/Export path bypasses this strip
 * (`bakeOverlays: true` keeps the labels in the merge input) so downloaded
 * PDFs DO carry them. See skill log 2026-06-19 (d).
 */
export function stripPageNumberOverlays(
  fabricJsonByPage: Map<number, string>,
): Map<number, string> {
  if (fabricJsonByPage.size === 0) return fabricJsonByPage;

  const next = new Map<number, string>();
  let mutated = false;

  fabricJsonByPage.forEach((json, page) => {
    try {
      const parsed = JSON.parse(json) as {
        objects?: { editorType?: string }[];
        [k: string]: unknown;
      };

      if (!Array.isArray(parsed.objects)) {
        next.set(page, json);

        return;
      }

      const filtered = parsed.objects.filter(
        (obj) => obj.editorType !== "pageNumber",
      );

      if (filtered.length === parsed.objects.length) {
        next.set(page, json);

        return;
      }

      mutated = true;
      next.set(page, JSON.stringify({ ...parsed, objects: filtered }));
    } catch {
      // Bad JSON — leave it untouched; the merge will skip the page via
      // its own `parseFabricJson` null-check.
      next.set(page, json);
    }
  });

  return mutated ? next : fabricJsonByPage;
}

/**
 * Strips all Fabric overlay objects EXCEPT `editModeText` from the merge
 * input on the cloud Save path.
 *
 * WHY: after aa89240 shapes/drawings/highlights/signatures/annotations are
 * kept in `fabricJsonByPage` post-save so they stay selectable in the editor.
 * But `mergeFabricEditsIntoPdf` (Case 3) also bakes those objects into the
 * saved PDF bytes via `copyPages + processPageObjects`. On reload the PDF
 * canvas renders the baked copies AND Fabric reloads them from
 * `fabricJsonByPage` — the user sees two identical overlapping layers; only
 * the top (Fabric) one is selectable, the bottom (PDF-baked) one is stuck.
 *
 * Fix: pass ONLY `editModeText` objects to the merge on Save. Modified
 * editModeText still gets whiteout + vector drawIText (its normal path);
 * everything else is NOT drawn into the PDF content stream. On reload the
 * source page is copied as-is (no baked shapes), and Fabric renders all
 * overlays from `fabricJsonByPage` — one layer, all selectable.
 *
 * Trade-off: the cloud-saved PDF opened in a third-party reader won't show
 * shapes/drawings/highlights etc. (same trade-off as `pageNumber`). The
 * Download / Export path bypasses this strip (`bakeOverlays: true`) so
 * exported PDFs carry everything baked in.
 *
 * Pages whose only objects are non-editModeText overlays are removed from
 * the returned map entirely so `merge-pdf.ts` takes the cheaper Case 1
 * (copyPages with no overlay pass) instead of Case 3 with an empty object
 * list.
 */
export function stripBakedOverlaysForSave(
  fabricJsonByPage: Map<number, string>,
): Map<number, string> {
  if (fabricJsonByPage.size === 0) return fabricJsonByPage;

  const next = new Map<number, string>();
  let mutated = false;

  fabricJsonByPage.forEach((json, page) => {
    try {
      const parsed = JSON.parse(json) as {
        objects?: { editorType?: string }[];
        [k: string]: unknown;
      };

      if (!Array.isArray(parsed.objects)) {
        next.set(page, json);

        return;
      }

      // Keep only editModeText — those may still need whiteout + vector
      // drawIText in the merge when the user modified source text.
      const editModeOnly = parsed.objects.filter(
        (obj) => obj.editorType === "editModeText",
      );

      if (editModeOnly.length === parsed.objects.length) {
        // Nothing to strip for this page.
        next.set(page, json);

        return;
      }

      mutated = true;

      if (editModeOnly.length === 0) {
        // No editModeText either — omit the page entirely so Case 1 fires
        // (copyPages, no overlay pass) instead of Case 3 with empty objects.
        return;
      }

      next.set(page, JSON.stringify({ ...parsed, objects: editModeOnly }));
    } catch {
      // Bad JSON — leave untouched; merge will handle via parseFabricJson.
      next.set(page, json);
    }
  });

  return mutated ? next : fabricJsonByPage;
}

/**
 * Bakes a non-identity `pageOrder` (set by sidebar drag-drop) into a rebuilt
 * source PDF so the downstream merge can run with identity ordering. Reuses
 * the proven Manage Pages rebuild pipeline (`buildPdfFromDraft` +
 * `remapFabricAfterPageOps`) — synthesises a source-only `DraftPage[]` from
 * `pageOrder`, rebuilds bytes with pages in that order, then rekeys the
 * Fabric overlays / history / extracted-page set from the old source-page
 * index to the new display slot (which IS the new source page index after
 * the rebuild).
 *
 * Pure — does NOT mutate the store. Caller commits the returned state via
 * `applyPostSaveReset` once the cloud upload succeeds, so a failed upload
 * leaves the editor in a recoverable pre-save state.
 */
export async function materializeSidebarReorder({
  extractedPages,
  fabricJsonByPage,
  historyByPage,
  historyIndexByPage,
  pageOrder,
  pdfDocument,
  sourceBytes,
}: MaterializeInput): Promise<MaterializedReorder> {
  const draftPages: DraftPage[] = pageOrder.map((sourcePageIndex) => ({
    id: `reorder-${sourcePageIndex}`,
    kind: "source",
    rotation: 0,
    sourcePageIndex,
  }));

  const rebuiltBytes = await buildPdfFromDraft({
    importedPdfs: new Map(),
    pages: draftPages,
    pdfDocument,
    sourceBytes,
  });

  const remapped = remapFabricAfterPageOps({
    newPages: draftPages,
    oldExtractedPages: extractedPages,
    oldFabricJsonByPage: fabricJsonByPage,
    oldHistoryByPage: historyByPage,
    oldHistoryIndexByPage: historyIndexByPage,
  });

  return {
    extractedPages: remapped.extractedPages,
    fabricJsonByPage: remapped.fabricJsonByPage,
    historyByPage: remapped.historyByPage,
    historyIndexByPage: remapped.historyIndexByPage,
    sourceBytes: rebuiltBytes,
  };
}
