import type { DraftPage } from "@/lib/client/hooks/pdf-editor/manage-pages-types";

import { rotateFabricJson } from "./rotate-fabric-overlays";

type SourcePageDimensions = { height: number; width: number };

type RemapFabricInput = {
  newPages: DraftPage[];
  oldExtractedPages: Set<number>;
  oldFabricJsonByPage: Map<number, string>;
  oldHistoryByPage: Map<number, string[]>;
  oldHistoryIndexByPage: Map<number, number>;
  /**
   * Pre-rotation PDF dimensions of each source page, keyed by 1-based source
   * page index. Used to rotate overlay coords when a page's `rotation !== 0`.
   * Optional for callers that never set a non-zero rotation (identity remap).
   */
  sourcePageDimensions?: Map<number, SourcePageDimensions>;
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
 *
 * QA 2026-10-04 row 6: when `page.rotation !== 0`, overlay JSON passes through
 * `rotateFabricJson` so each object's (left, top, angle) matches the
 * post-rotation page coord system. See `rotate-fabric-overlays.ts` for the
 * transformation math.
 */
export function remapFabricAfterPageOps({
  newPages,
  oldExtractedPages,
  oldFabricJsonByPage,
  oldHistoryByPage,
  oldHistoryIndexByPage,
  sourcePageDimensions,
}: RemapFabricInput): RemappedFabricState {
  const extractedPages = new Set<number>();
  const fabricJsonByPage = new Map<number, string>();
  const historyByPage = new Map<number, string[]>();
  const historyIndexByPage = new Map<number, number>();

  newPages.forEach((page, index) => {
    const displaySlot = index + 1;

    if (page.kind !== "source") return;

    const source = page.sourcePageIndex;
    const rotation = page.rotation;
    const dims = sourcePageDimensions?.get(source);

    // If the source page had its text extracted (Edit Text mode), the duplicate
    // must also suppress the native pdf.js text layer — otherwise the PDF
    // content-stream text and the Fabric IText overlay both render on the same
    // slot and the user sees doubled / overlapping text.
    if (oldExtractedPages.has(source)) {
      extractedPages.add(displaySlot);
    }

    const json = oldFabricJsonByPage.get(source);

    if (json) {
      const transformed =
        rotation && dims
          ? rotateFabricJson(json, rotation, dims.width, dims.height)
          : json;

      fabricJsonByPage.set(displaySlot, transformed);
    }

    const history = oldHistoryByPage.get(source);

    if (history?.length) {
      const transformedHistory =
        rotation && dims
          ? history.map((entry) =>
              rotateFabricJson(entry, rotation, dims.width, dims.height),
            )
          : [...history];

      historyByPage.set(displaySlot, transformedHistory);
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
