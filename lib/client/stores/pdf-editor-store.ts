import type { PDFDocumentProxy } from "pdfjs-dist";

import { create } from "zustand";

const MAX_HISTORY = 50;

export type ActiveTool =
  | "draw"
  | "eraser"
  | "highlight"
  | "image"
  | "select"
  | "shape"
  | "signature"
  | "text"
  | "whiteout";
export type ShapeType = "arrow" | "ellipse" | "line" | "rect";

type PdfEditorStore = {
  activeShapeType: ShapeType;
  activeTool: ActiveTool;
  currentDocumentId: string | null;
  currentDocumentName: string | null;
  currentPage: number;
  highlightColor: string;
  fabricJsonByPage: Map<number, string>;
  file: File | null;
  historyByPage: Map<number, string[]>;
  historyIndexByPage: Map<number, number>;
  createPdfModalKey: number;
  isCreatePdfModalOpen: boolean;
  isCreatingShape: boolean;
  isRestoringHistory: boolean;
  isSignatureModalOpen: boolean;
  isSignedIn: boolean;
  pageCount: number;
  pdfDocument: PDFDocumentProxy | null;
  shapeFill: string;
  shapeStroke: string;
  shapeStrokeWidth: number;
  zoom: number;

  clearFile: () => void;
  setCurrentDocument: (doc: { id: string; name: string } | null) => void;
  getFabricJson: (page: number) => string | undefined;
  pushHistory: (page: number, json: string) => void;
  redo: (page: number) => string | undefined;
  saveFabricJson: (page: number, json: string) => void;
  setActiveShapeType: (type: ShapeType) => void;
  setActiveTool: (tool: ActiveTool) => void;
  setHighlightColor: (color: string) => void;
  setCurrentPage: (page: number) => void;
  setFile: (file: File | null) => void;
  setIsCreatePdfModalOpen: (value: boolean) => void;
  setIsCreatingShape: (value: boolean) => void;
  setIsRestoringHistory: (value: boolean) => void;
  setIsSignatureModalOpen: (value: boolean) => void;
  setIsSignedIn: (value: boolean) => void;
  setPdfDocument: (doc: PDFDocumentProxy | null, pageCount: number) => void;
  setShapeFill: (color: string) => void;
  setShapeStroke: (color: string) => void;
  setShapeStrokeWidth: (width: number) => void;
  setZoom: (zoom: number) => void;
  undo: (page: number) => string | undefined;
};

export const usePdfEditorStore = create<PdfEditorStore>((set, get) => ({
  activeShapeType: "rect",
  activeTool: "select",
  currentDocumentId: null,
  currentDocumentName: null,
  currentPage: 1,
  highlightColor: "#FFEB3B",
  fabricJsonByPage: new Map(),
  file: null,
  historyByPage: new Map(),
  historyIndexByPage: new Map(),
  createPdfModalKey: 0,
  isCreatePdfModalOpen: false,
  isCreatingShape: false,
  isRestoringHistory: false,
  isSignatureModalOpen: false,
  isSignedIn: false,
  pageCount: 0,
  pdfDocument: null,
  shapeFill: "transparent",
  shapeStroke: "#000000",
  shapeStrokeWidth: 2,
  zoom: 1.0,

  clearFile: () =>
    set({
      activeTool: "select",
      currentDocumentId: null,
      currentDocumentName: null,
      currentPage: 1,
      fabricJsonByPage: new Map(),
      file: null,
      historyByPage: new Map(),
      historyIndexByPage: new Map(),
      isCreatePdfModalOpen: false,
      isCreatingShape: false,
      isRestoringHistory: false,
      isSignatureModalOpen: false,
      pageCount: 0,
      pdfDocument: null,
      shapeFill: "transparent",
      shapeStroke: "#000000",
      shapeStrokeWidth: 2,
      zoom: 1.0,
    }),

  setCurrentDocument: (doc) =>
    set({
      currentDocumentId: doc?.id ?? null,
      currentDocumentName: doc?.name ?? null,
    }),

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

  setActiveShapeType: (type) => set({ activeShapeType: type }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setHighlightColor: (color) => set({ highlightColor: color }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setFile: (file) => set({ file }),
  setIsCreatePdfModalOpen: (value) =>
    set((state) => ({
      createPdfModalKey: value
        ? state.createPdfModalKey + 1
        : state.createPdfModalKey,
      isCreatePdfModalOpen: value,
    })),
  setIsCreatingShape: (value) => set({ isCreatingShape: value }),
  setIsRestoringHistory: (value) => set({ isRestoringHistory: value }),
  setIsSignatureModalOpen: (value) => set({ isSignatureModalOpen: value }),
  setIsSignedIn: (value) => set({ isSignedIn: value }),
  setPdfDocument: (doc, pageCount) => set({ pdfDocument: doc, pageCount }),
  setShapeFill: (color) => set({ shapeFill: color }),
  setShapeStroke: (color) => set({ shapeStroke: color }),
  setShapeStrokeWidth: (width) => set({ shapeStrokeWidth: width }),
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
