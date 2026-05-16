import type { DraftPage } from "@/lib/client/hooks/pdf-editor/manage-pages-types";

type RemapFabricInput = {
  newPages: DraftPage[];
  oldFabricJsonByPage: Map<number, string>;
  oldHistoryByPage: Map<number, string[]>;
  oldHistoryIndexByPage: Map<number, number>;
};

export type RemappedFabricState = {
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
  oldFabricJsonByPage,
  oldHistoryByPage,
  oldHistoryIndexByPage,
}: RemapFabricInput): RemappedFabricState {
  const fabricJsonByPage = new Map<number, string>();
  const historyByPage = new Map<number, string[]>();
  const historyIndexByPage = new Map<number, number>();

  newPages.forEach((page, index) => {
    const displaySlot = index + 1;

    if (page.kind !== "source") return;

    const source = page.sourcePageIndex;
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

  return { fabricJsonByPage, historyByPage, historyIndexByPage };
}
