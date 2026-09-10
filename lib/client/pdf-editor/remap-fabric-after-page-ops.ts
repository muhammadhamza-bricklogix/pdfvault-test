import type { DraftPage } from "@/lib/client/hooks/pdf-editor/manage-pages-types";

type RemapFabricInput = {
  newPages: DraftPage[];
  oldExtractedPages: Set<number>;
  oldFabricJsonByPage: Map<number, string>;
  oldHistoryByPage: Map<number, string[]>;
  oldHistoryIndexByPage: Map<number, number>;
};

export type RemappedFabricState = {
  extractedPages: Set<number>;
  fabricJsonByPage: Map<number, string>;
  historyByPage: Map<number, string[]>;
  historyIndexByPage: Map<number, number>;
};

/**
 * After Manage Pages rebuild, map fabric overlays from original source page
 * indices to new 1-based display slots. Duplicate source pages receive copies.
 */
export function remapFabricAfterPageOps({
  newPages,
  oldExtractedPages,
  oldFabricJsonByPage,
  oldHistoryByPage,
  oldHistoryIndexByPage,
}: RemapFabricInput): RemappedFabricState {
  const extractedPages = new Set<number>();
  const fabricJsonByPage = new Map<number, string>();
  const historyByPage = new Map<number, string[]>();
  const historyIndexByPage = new Map<number, number>();

  newPages.forEach((page, index) => {
    const displaySlot = index + 1;

    if (page.kind !== "source") return;

    const source = page.sourcePageIndex;

    // If the source page had its text extracted (Edit Text mode), the duplicate
    // must also suppress the native pdf.js text layer — otherwise the PDF
    // content-stream text and the Fabric IText overlay both render on the same
    // slot and the user sees doubled / overlapping text.
    if (oldExtractedPages.has(source)) {
      extractedPages.add(displaySlot);
    }

    const json = oldFabricJsonByPage.get(source);

    if (json) {
      fabricJsonByPage.set(displaySlot, json);
    }

    const history = oldHistoryByPage.get(source);

    if (history?.length) {
      historyByPage.set(displaySlot, [...history]);
      const oldIdx = oldHistoryIndexByPage.get(source) ?? history.length - 1;

      historyIndexByPage.set(displaySlot, Math.min(oldIdx, history.length - 1));
    }
  });

  return {
    extractedPages,
    fabricJsonByPage,
    historyByPage,
    historyIndexByPage,
  };
}
