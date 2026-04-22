import type { PDFDocumentProxy } from "pdfjs-dist";

import { create } from "zustand";

const MAX_HISTORY = 50;

export type ActiveTool = "select" | "text";

type PdfEditorStore = {
  activeTool: ActiveTool;
  currentPage: number;
  fabricJsonByPage: Map<number, string>;
  file: File | null;
  historyByPage: Map<number, string[]>;
  historyIndexByPage: Map<number, number>;
  isSignedIn: boolean;
  pageCount: number;
  pdfDocument: PDFDocumentProxy | null;
  zoom: number;

  getFabricJson: (page: number) => string | undefined;
  pushHistory: (page: number, json: string) => void;
  redo: (page: number) => string | undefined;
  saveFabricJson: (page: number, json: string) => void;
  setActiveTool: (tool: ActiveTool) => void;
  setCurrentPage: (page: number) => void;
  setFile: (file: File) => void;
  setIsSignedIn: (value: boolean) => void;
  setPdfDocument: (doc: PDFDocumentProxy, pageCount: number) => void;
  setZoom: (zoom: number) => void;
  undo: (page: number) => string | undefined;
};

export const usePdfEditorStore = create<PdfEditorStore>((set, get) => ({
  activeTool: "select",
  currentPage: 1,
  fabricJsonByPage: new Map(),
  file: null,
  historyByPage: new Map(),
  historyIndexByPage: new Map(),
  isSignedIn: false,
  pageCount: 0,
  pdfDocument: null,
  zoom: 1.0,

  getFabricJson: (page) => get().fabricJsonByPage.get(page),

  pushHistory: (page, json) =>
    set((state) => {
      const history = [...(state.historyByPage.get(page) ?? [])];
      const idx = state.historyIndexByPage.get(page) ?? -1;
      // Discard any redo states ahead of current index
      const trimmed = history.slice(0, idx + 1);

      trimmed.push(json);
      if (trimmed.length > MAX_HISTORY) trimmed.shift();
      const newHistory = new Map(state.historyByPage);
      const newIndex = new Map(state.historyIndexByPage);

      newHistory.set(page, trimmed);
      newIndex.set(page, trimmed.length - 1);

      return { historyByPage: newHistory, historyIndexByPage: newIndex };
    }),

  redo: (page) => {
    const state = get();
    const history = state.historyByPage.get(page) ?? [];
    const idx = state.historyIndexByPage.get(page) ?? -1;

    if (idx >= history.length - 1) return undefined;
    const newIdx = idx + 1;

    set((s) => {
      const newIndex = new Map(s.historyIndexByPage);

      newIndex.set(page, newIdx);

      return { historyIndexByPage: newIndex };
    });

    return history[newIdx];
  },

  saveFabricJson: (page, json) =>
    set((state) => {
      const newMap = new Map(state.fabricJsonByPage);

      newMap.set(page, json);

      return { fabricJsonByPage: newMap };
    }),

  setActiveTool: (tool) => set({ activeTool: tool }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setFile: (file) => set({ file }),
  setIsSignedIn: (value) => set({ isSignedIn: value }),
  setPdfDocument: (doc, pageCount) => set({ pdfDocument: doc, pageCount }),
  setZoom: (zoom) => set({ zoom }),

  undo: (page) => {
    const state = get();
    const history = state.historyByPage.get(page) ?? [];
    const idx = state.historyIndexByPage.get(page) ?? -1;

    if (idx <= 0) return undefined;
    const newIdx = idx - 1;

    set((s) => {
      const newIndex = new Map(s.historyIndexByPage);

      newIndex.set(page, newIdx);

      return { historyIndexByPage: newIndex };
    });

    return history[newIdx];
  },
}));
