import type { PDFDocumentProxy } from "pdfjs-dist";
import type { FontData } from "@/lib/client/pdf-editor/text-extraction";

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
export type EditorMode = "edit" | "editText";
export type ShapeType = "arrow" | "ellipse" | "line" | "rect";

/** Resolves a display slot (1..N) to a stable source PDF page index (1..N). */
function resolveSourcePage(displayPage: number, pageOrder: number[]): number {
  if (!pageOrder.length) return displayPage;

  return pageOrder[displayPage - 1] ?? displayPage;
}

type PdfEditorStore = {
  activeShapeType: ShapeType;
  activeTool: ActiveTool;
  currentDocumentId: string | null;
  currentDocumentName: string | null;
  currentPage: number;
  editorMode: EditorMode;
  highlightColor: string;
  /** Fabric JSON keyed by source PDF page number (stable across reorder). */
  fabricJsonByPage: Map<number, string>;
  file: File | null;
  hasUnsavedChanges: boolean;
  pendingCloudSaveAfterReload: boolean;
  fontDataByLoadedName: Map<string, FontData>;
  /** Undo stacks keyed by source PDF page number (stable across reorder). */
  historyByPage: Map<number, string[]>;
  historyIndexByPage: Map<number, number>;
  createPdfModalKey: number;
  isCreatePdfModalOpen: boolean;
  isCreatingShape: boolean;
  isManagePagesOpen: boolean;
  isRestoringHistory: boolean;
  isSignatureModalOpen: boolean;
  isSignedIn: boolean;
  pageCount: number;
  pageOrder: number[];
  pdfDocument: PDFDocumentProxy | null;
  shapeFill: string;
  shapeStroke: string;
  shapeStrokeWidth: number;
  zoom: number;

  addFontData: (fonts: FontData[]) => void;
  clearFile: () => void;
  setCurrentDocument: (doc: { id: string; name: string } | null) => void;
  getFabricJson: (page: number) => string | undefined;
  getSourcePageIndex: (displayPage?: number) => number;
  pushHistory: (page: number, json: string) => void;
  reorderPages: (fromDisplay: number, toDisplay: number) => void;
  setPageOrder: (pageOrder: number[]) => void;
  redo: (page: number) => string | undefined;
  saveFabricJson: (page: number, json: string) => void;
  saveFabricJsonBySourcePage: (sourcePage: number, json: string) => void;
  setActiveShapeType: (type: ShapeType) => void;
  setActiveTool: (tool: ActiveTool) => void;
  setEditorMode: (mode: EditorMode) => void;
  setHighlightColor: (color: string) => void;
  setCurrentPage: (page: number) => void;
  applyManagePagesSave: (params: {
    currentPage: number;
    fabricJsonByPage: Map<number, string>;
    file: File;
    historyByPage: Map<number, string[]>;
    historyIndexByPage: Map<number, number>;
  }) => void;
  clearDocumentDirty: () => void;
  clearPendingCloudSaveAfterReload: () => void;
  markDocumentDirty: () => void;
  setFile: (file: File | null) => void;
  setIsCreatePdfModalOpen: (value: boolean) => void;
  setIsManagePagesOpen: (value: boolean) => void;
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
  editorMode: "editText",
  highlightColor: "#FFEB3B",
  fabricJsonByPage: new Map(),
  file: null,
  hasUnsavedChanges: false,
  pendingCloudSaveAfterReload: false,
  fontDataByLoadedName: new Map(),
  historyByPage: new Map(),
  historyIndexByPage: new Map(),
  createPdfModalKey: 0,
  isCreatePdfModalOpen: false,
  isCreatingShape: false,
  isManagePagesOpen: false,
  isRestoringHistory: false,
  isSignatureModalOpen: false,
  isSignedIn: false,
  pageCount: 0,
  pageOrder: [],
  pdfDocument: null,
  shapeFill: "transparent",
  shapeStroke: "#000000",
  shapeStrokeWidth: 2,
  zoom: 1.0,

  addFontData: (fonts) =>
    set((state) => {
      const newMap = new Map(state.fontDataByLoadedName);
      let changed = false;

      for (const font of fonts) {
        if (!newMap.has(font.loadedName)) {
          newMap.set(font.loadedName, font);
          changed = true;
        }
      }

      return changed ? { fontDataByLoadedName: newMap } : {};
    }),

  clearFile: () =>
    set({
      activeTool: "select",
      currentDocumentId: null,
      currentDocumentName: null,
      currentPage: 1,
      editorMode: "editText",
      fabricJsonByPage: new Map(),
      file: null,
      hasUnsavedChanges: false,
      pendingCloudSaveAfterReload: false,
      fontDataByLoadedName: new Map(),
      historyByPage: new Map(),
      historyIndexByPage: new Map(),
      isCreatePdfModalOpen: false,
      isCreatingShape: false,
      isManagePagesOpen: false,
      isRestoringHistory: false,
      isSignatureModalOpen: false,
      pageCount: 0,
      pageOrder: [],
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

  getFabricJson: (displayPage) => {
    const state = get();
    const source = resolveSourcePage(displayPage, state.pageOrder);

    return state.fabricJsonByPage.get(source);
  },

  getSourcePageIndex: (displayPage) => {
    const state = get();
    const display = displayPage ?? state.currentPage;

    return resolveSourcePage(display, state.pageOrder);
  },

  reorderPages: (fromDisplay, toDisplay) =>
    set((state) => {
      const n = state.pageCount;

      if (n <= 1 || fromDisplay === toDisplay) return {};

      const fromIdx = fromDisplay - 1;
      const toIdx = toDisplay - 1;

      if (
        fromIdx < 0 ||
        toIdx < 0 ||
        fromIdx >= n ||
        toIdx >= n ||
        fromIdx === toIdx
      ) {
        return {};
      }

      const oldOrder = [...state.pageOrder];
      const newOrder = [...oldOrder];
      const [moved] = newOrder.splice(fromIdx, 1);

      newOrder.splice(toIdx, 0, moved);

      const sourceAtCurrent = oldOrder[state.currentPage - 1];
      const newCurrentPage = newOrder.indexOf(sourceAtCurrent) + 1;

      return {
        currentPage: newCurrentPage,
        hasUnsavedChanges: true,
        pageOrder: newOrder,
      };
    }),

  setPageOrder: (newOrder) =>
    set((state) => {
      if (newOrder.length !== state.pageCount) return {};

      const sourceAtCurrent = state.pageOrder[state.currentPage - 1];
      const newCurrentPage = newOrder.indexOf(sourceAtCurrent) + 1;

      return {
        currentPage: newCurrentPage > 0 ? newCurrentPage : 1,
        hasUnsavedChanges: true,
        pageOrder: [...newOrder],
      };
    }),

  pushHistory: (displayPage, json) =>
    set((state) => {
      const source = resolveSourcePage(displayPage, state.pageOrder);
      const history = [...(state.historyByPage.get(source) ?? [])];
      const idx = state.historyIndexByPage.get(source) ?? -1;
      // Discard any redo states ahead of current index
      const trimmed = history.slice(0, idx + 1);

      trimmed.push(json);
      if (trimmed.length > MAX_HISTORY) trimmed.shift();
      const newHistory = new Map(state.historyByPage);
      const newIndex = new Map(state.historyIndexByPage);

      newHistory.set(source, trimmed);
      newIndex.set(source, trimmed.length - 1);

      return { historyByPage: newHistory, historyIndexByPage: newIndex };
    }),

  redo: (displayPage) => {
    const state = get();
    const source = resolveSourcePage(displayPage, state.pageOrder);
    const history = state.historyByPage.get(source) ?? [];
    const idx = state.historyIndexByPage.get(source) ?? -1;

    if (idx >= history.length - 1) return undefined;
    const newIdx = idx + 1;

    set((s) => {
      const newIndex = new Map(s.historyIndexByPage);

      newIndex.set(source, newIdx);

      return { historyIndexByPage: newIndex };
    });

    return history[newIdx];
  },

  saveFabricJson: (displayPage, json) =>
    set((state) => {
      const source = resolveSourcePage(displayPage, state.pageOrder);
      const newMap = new Map(state.fabricJsonByPage);

      newMap.set(source, json);

      return { fabricJsonByPage: newMap, hasUnsavedChanges: true };
    }),

  saveFabricJsonBySourcePage: (sourcePage, json) =>
    set((state) => {
      const newMap = new Map(state.fabricJsonByPage);

      newMap.set(sourcePage, json);

      return { fabricJsonByPage: newMap, hasUnsavedChanges: true };
    }),

  markDocumentDirty: () => set({ hasUnsavedChanges: true }),

  clearDocumentDirty: () => set({ hasUnsavedChanges: false }),

  clearPendingCloudSaveAfterReload: () =>
    set({ pendingCloudSaveAfterReload: false }),

  setActiveShapeType: (type) => set({ activeShapeType: type }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setEditorMode: (mode) =>
    set(
      mode === "editText"
        ? { activeTool: "select", editorMode: mode }
        : { editorMode: mode },
    ),
  setHighlightColor: (color) => set({ highlightColor: color }),
  setCurrentPage: (page) => set({ currentPage: page }),

  applyManagePagesSave: ({
    currentPage,
    fabricJsonByPage,
    file,
    historyByPage,
    historyIndexByPage,
  }) =>
    set({
      currentPage,
      fabricJsonByPage: new Map(fabricJsonByPage),
      file,
      hasUnsavedChanges: true,
      historyByPage: new Map(historyByPage),
      historyIndexByPage: new Map(historyIndexByPage),
      pendingCloudSaveAfterReload: true,
    }),

  setFile: (file) => set({ file }),
  setIsCreatePdfModalOpen: (value) =>
    set((state) => ({
      createPdfModalKey: value
        ? state.createPdfModalKey + 1
        : state.createPdfModalKey,
      isCreatePdfModalOpen: value,
    })),
  setIsCreatingShape: (value) => set({ isCreatingShape: value }),
  setIsManagePagesOpen: (value) => set({ isManagePagesOpen: value }),
  setIsRestoringHistory: (value) => set({ isRestoringHistory: value }),
  setIsSignatureModalOpen: (value) => set({ isSignatureModalOpen: value }),
  setIsSignedIn: (value) => set({ isSignedIn: value }),
  setPdfDocument: (doc, pageCount) =>
    set({
      pageOrder: Array.from({ length: pageCount }, (_, i) => i + 1),
      pdfDocument: doc,
      pageCount,
    }),
  setShapeFill: (color) => set({ shapeFill: color }),
  setShapeStroke: (color) => set({ shapeStroke: color }),
  setShapeStrokeWidth: (width) => set({ shapeStrokeWidth: width }),
  setZoom: (zoom) => set({ zoom }),

  undo: (displayPage) => {
    const state = get();
    const source = resolveSourcePage(displayPage, state.pageOrder);
    const history = state.historyByPage.get(source) ?? [];
    const idx = state.historyIndexByPage.get(source) ?? -1;

    if (idx <= 0) return undefined;
    const newIdx = idx - 1;

    set((s) => {
      const newIndex = new Map(s.historyIndexByPage);

      newIndex.set(source, newIdx);

      return { historyIndexByPage: newIndex };
    });

    return history[newIdx];
  },
}));
