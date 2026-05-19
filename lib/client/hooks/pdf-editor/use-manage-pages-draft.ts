"use client";

import type {
  DraftPage,
  ManagePagesDraftSnapshot,
  PageRotation,
} from "@/lib/client/hooks/pdf-editor/manage-pages-types";

import { useCallback, useReducer } from "react";

import { DEFAULT_BLANK_PAGE } from "@/lib/client/hooks/pdf-editor/manage-pages-types";
import { toast } from "@/lib/shared/utils/toast";

const MAX_HISTORY = 50;

function createId() {
  return crypto.randomUUID();
}

function cloneSnapshot(
  snapshot: ManagePagesDraftSnapshot,
): ManagePagesDraftSnapshot {
  return {
    importedPdfs: new Map(snapshot.importedPdfs),
    pages: snapshot.pages.map((p) => ({ ...p })),
    selectedIds: [...snapshot.selectedIds],
  };
}

function initPagesFromOrder(
  pageOrder: number[],
  pageCount: number,
): DraftPage[] {
  const order =
    pageOrder.length === pageCount
      ? pageOrder
      : Array.from({ length: pageCount }, (_, i) => i + 1);

  return order.map((sourcePageIndex) => ({
    id: createId(),
    kind: "source" as const,
    rotation: 0,
    sourcePageIndex,
  }));
}

function normalizeRotation(degrees: number): PageRotation {
  const n = ((degrees % 360) + 360) % 360;

  if (n === 90) return 90;
  if (n === 180) return 180;
  if (n === 270) return 270;

  return 0;
}

function reorderPagesList(
  pages: DraftPage[],
  fromDisplay: number,
  toDisplay: number,
): DraftPage[] {
  const fromIdx = fromDisplay - 1;
  const toIdx = toDisplay - 1;
  const next = [...pages];
  const [moved] = next.splice(fromIdx, 1);

  next.splice(toIdx, 0, moved);

  return next;
}

type DraftState = {
  history: ManagePagesDraftSnapshot[];
  historyIndex: number;
  importedPdfs: Map<string, ArrayBuffer>;
  pages: DraftPage[];
  selectedIds: string[];
};

type DraftAction =
  | { pageCount: number; pageOrder: number[]; type: "reset" }
  | { type: "redo" }
  | { type: "undo" }
  | {
      type: "update";
      updater: (current: ManagePagesDraftSnapshot) => ManagePagesDraftSnapshot;
    };

function createInitialState(
  pageOrder: number[],
  pageCount: number,
): DraftState {
  const initial: ManagePagesDraftSnapshot = {
    importedPdfs: new Map(),
    pages: initPagesFromOrder(pageOrder, pageCount),
    selectedIds: [],
  };

  return {
    history: [cloneSnapshot(initial)],
    historyIndex: 0,
    importedPdfs: initial.importedPdfs,
    pages: initial.pages,
    selectedIds: initial.selectedIds,
  };
}

function draftReducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case "reset":
      return createInitialState(action.pageOrder, action.pageCount);
    case "undo": {
      if (state.historyIndex <= 0) return state;

      const nextIdx = state.historyIndex - 1;
      const snapshot = state.history[nextIdx];

      if (!snapshot) return state;

      return {
        ...state,
        historyIndex: nextIdx,
        importedPdfs: new Map(snapshot.importedPdfs),
        pages: snapshot.pages.map((p) => ({ ...p })),
        selectedIds: [...snapshot.selectedIds],
      };
    }
    case "redo": {
      if (state.historyIndex >= state.history.length - 1) return state;

      const nextIdx = state.historyIndex + 1;
      const snapshot = state.history[nextIdx];

      if (!snapshot) return state;

      return {
        ...state,
        historyIndex: nextIdx,
        importedPdfs: new Map(snapshot.importedPdfs),
        pages: snapshot.pages.map((p) => ({ ...p })),
        selectedIds: [...snapshot.selectedIds],
      };
    }
    case "update": {
      const current: ManagePagesDraftSnapshot = {
        importedPdfs: state.importedPdfs,
        pages: state.pages,
        selectedIds: state.selectedIds,
      };
      const next = action.updater(current);
      const trimmed = state.history.slice(0, state.historyIndex + 1);

      trimmed.push(cloneSnapshot(next));
      if (trimmed.length > MAX_HISTORY) trimmed.shift();

      return {
        history: trimmed,
        historyIndex: trimmed.length - 1,
        importedPdfs: next.importedPdfs,
        pages: next.pages,
        selectedIds: next.selectedIds,
      };
    }
    default:
      return state;
  }
}

type UseManagePagesDraftParams = {
  isOpen: boolean;
  pageCount: number;
  pageOrder: number[];
};

export function useManagePagesDraft({
  isOpen,
  pageCount,
  pageOrder,
}: UseManagePagesDraftParams) {
  const [state, dispatch] = useReducer(
    draftReducer,
    { isOpen, pageCount, pageOrder },
    ({ isOpen: open, pageCount: count, pageOrder: order }) =>
      open && count > 0
        ? createInitialState(order, count)
        : {
            history: [],
            historyIndex: -1,
            importedPdfs: new Map(),
            pages: [],
            selectedIds: [],
          },
  );

  const resetDraft = useCallback(() => {
    if (!isOpen || pageCount <= 0) return;

    dispatch({ pageCount, pageOrder, type: "reset" });
  }, [isOpen, pageCount, pageOrder]);

  const applyChange = useCallback(
    (
      updater: (current: ManagePagesDraftSnapshot) => ManagePagesDraftSnapshot,
    ) => {
      dispatch({ type: "update", updater });
    },
    [],
  );

  const { history, historyIndex, importedPdfs, pages, selectedIds } = state;
  const selectedCount = selectedIds.length;
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex >= 0 && historyIndex < history.length - 1;

  const reorder = useCallback(
    (fromDisplay: number, toDisplay: number) => {
      applyChange((current) => ({
        ...current,
        pages: reorderPagesList(current.pages, fromDisplay, toDisplay),
      }));
    },
    [applyChange],
  );

  const selectAll = useCallback(() => {
    applyChange((current) => ({
      ...current,
      selectedIds: current.pages.map((p) => p.id),
    }));
  }, [applyChange]);

  const selectNone = useCallback(() => {
    applyChange((current) => ({
      ...current,
      selectedIds: [],
    }));
  }, [applyChange]);

  const toggleSelect = useCallback(
    (id: string) => {
      applyChange((current) => {
        const next = new Set(current.selectedIds);

        if (next.has(id)) next.delete(id);
        else next.add(id);

        return { ...current, selectedIds: Array.from(next) };
      });
    },
    [applyChange],
  );

  const deleteSelected = useCallback(() => {
    applyChange((current) => {
      if (current.selectedIds.length === 0) return current;

      const selectedSet = new Set(current.selectedIds);
      const remaining = current.pages.filter((p) => !selectedSet.has(p.id));

      if (remaining.length === 0) {
        toast.error({
          title: "Cannot delete all pages",
          description: "At least one page must remain in the document.",
        });

        return current;
      }

      return {
        ...current,
        pages: remaining,
        selectedIds: [],
      };
    });
  }, [applyChange]);

  const duplicateSelected = useCallback(() => {
    applyChange((current) => {
      if (current.selectedIds.length === 0) return current;

      const selectedSet = new Set(current.selectedIds);
      const next: DraftPage[] = [];

      for (const page of current.pages) {
        next.push(page);

        if (!selectedSet.has(page.id)) continue;

        if (page.kind === "source") {
          next.push({
            heightPt: page.heightPt,
            id: createId(),
            kind: "source",
            rotation: page.rotation,
            sourcePageIndex: page.sourcePageIndex,
            widthPt: page.widthPt,
          });
        } else if (page.kind === "imported") {
          next.push({
            heightPt: page.heightPt,
            id: createId(),
            importKey: page.importKey,
            importPageIndex: page.importPageIndex,
            kind: "imported",
            rotation: page.rotation,
            widthPt: page.widthPt,
          });
        } else {
          next.push({
            heightPt: page.heightPt,
            id: createId(),
            kind: "blank",
            rotation: page.rotation,
            widthPt: page.widthPt,
          });
        }
      }

      return { ...current, pages: next, selectedIds: [] };
    });
  }, [applyChange]);

  const addBlankPage = useCallback(() => {
    applyChange((current) => {
      const makeBlank = (): DraftPage => ({
        heightPt: DEFAULT_BLANK_PAGE.heightPt,
        id: createId(),
        kind: "blank",
        rotation: 0,
        widthPt: DEFAULT_BLANK_PAGE.widthPt,
      });

      if (current.selectedIds.length === 0) {
        return { ...current, pages: [...current.pages, makeBlank()] };
      }

      const selectedSet = new Set(current.selectedIds);
      const next: DraftPage[] = [];

      for (const page of current.pages) {
        next.push(page);

        if (selectedSet.has(page.id)) {
          next.push(makeBlank());
        }
      }

      return { ...current, pages: next, selectedIds: [] };
    });
  }, [applyChange]);

  const rotateSelected = useCallback(
    (delta: 90 | -90) => {
      applyChange((current) => {
        if (current.selectedIds.length === 0) return current;

        const selectedSet = new Set(current.selectedIds);

        return {
          ...current,
          pages: current.pages.map((page) => {
            if (!selectedSet.has(page.id)) return page;

            return {
              ...page,
              rotation: normalizeRotation(page.rotation + delta),
            };
          }),
        };
      });
    },
    [applyChange],
  );

  const resizeSelected = useCallback(
    (widthPt: number, heightPt: number) => {
      applyChange((current) => {
        if (current.selectedIds.length === 0) return current;

        const selectedSet = new Set(current.selectedIds);

        return {
          ...current,
          pages: current.pages.map((page) => {
            if (!selectedSet.has(page.id)) return page;

            return { ...page, heightPt, widthPt };
          }),
        };
      });
    },
    [applyChange],
  );

  const moveSelected = useCallback(
    (targetPage: number, position: "after" | "before") => {
      applyChange((current) => {
        if (current.selectedIds.length === 0) return current;

        const selectedSet = new Set(current.selectedIds);
        const moving = current.pages.filter((p) => selectedSet.has(p.id));
        const rest = current.pages.filter((p) => !selectedSet.has(p.id));

        const clamped = Math.max(1, Math.min(targetPage, rest.length + 1));
        const insertAt = position === "before" ? clamped - 1 : clamped;
        const next = [...rest];

        next.splice(insertAt, 0, ...moving);

        return {
          ...current,
          pages: next,
          selectedIds: current.selectedIds.filter((id) => selectedSet.has(id)),
        };
      });
    },
    [applyChange],
  );

  const importPdf = useCallback(
    async (file: File) => {
      const bytes = await file.arrayBuffer();
      const importKey = createId();

      let pageTotal = 0;

      try {
        const pdfjs = await import("pdfjs-dist");
        const task = pdfjs.getDocument({ data: bytes.slice(0) });

        pageTotal = (await task.promise).numPages;
        task.destroy();
      } catch {
        toast.error({
          title: "Import failed",
          description: "Could not read the selected PDF file.",
        });

        return;
      }

      applyChange((current) => {
        const nextImports = new Map(current.importedPdfs);

        nextImports.set(importKey, bytes);

        const appended: DraftPage[] = Array.from(
          { length: pageTotal },
          (_, i) => ({
            id: createId(),
            importKey,
            importPageIndex: i + 1,
            kind: "imported" as const,
            rotation: 0,
          }),
        );

        return {
          importedPdfs: nextImports,
          pages: [...current.pages, ...appended],
          selectedIds: current.selectedIds,
        };
      });
    },
    [applyChange],
  );

  const undo = useCallback(() => {
    dispatch({ type: "undo" });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: "redo" });
  }, []);

  const getSnapshot = useCallback(
    (): ManagePagesDraftSnapshot => ({
      importedPdfs: new Map(importedPdfs),
      pages: pages.map((p) => ({ ...p })),
      selectedIds: [...selectedIds],
    }),
    [importedPdfs, pages, selectedIds],
  );

  return {
    addBlankPage,
    canRedo,
    canUndo,
    deleteSelected,
    duplicateSelected,
    getSnapshot,
    importPdf,
    importedPdfs,
    moveSelected,
    pages,
    redo,
    reorder,
    resetDraft,
    resizeSelected,
    rotateSelected,
    selectAll,
    selectNone,
    selectedCount,
    selectedIds,
    toggleSelect,
    undo,
  };
}
