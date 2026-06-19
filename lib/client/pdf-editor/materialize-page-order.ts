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
    oldFabricJsonByPage: fabricJsonByPage,
    oldHistoryByPage: historyByPage,
    oldHistoryIndexByPage: historyIndexByPage,
  });

  // extractedPages is keyed by source page index. After rebuild, the source
  // page that was at display slot i+1 becomes the new source page i+1 — so
  // remap by walking pageOrder and recording the new slot for any old source
  // page that was in `extractedPages`.
  const remappedExtractedPages = new Set<number>();

  pageOrder.forEach((oldSourcePageIndex, i) => {
    if (extractedPages.has(oldSourcePageIndex)) {
      remappedExtractedPages.add(i + 1);
    }
  });

  return {
    extractedPages: remappedExtractedPages,
    fabricJsonByPage: remapped.fabricJsonByPage,
    historyByPage: remapped.historyByPage,
    historyIndexByPage: remapped.historyIndexByPage,
    sourceBytes: rebuiltBytes,
  };
}
