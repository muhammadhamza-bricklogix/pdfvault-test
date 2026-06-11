import type { PDFDocumentProxy } from "pdfjs-dist";
import type { FontData } from "@/lib/client/pdf-editor/text-extraction";

import { create } from "zustand";

const MAX_HISTORY = 50;

export type ActiveTool =
  | "backgroundImage"
  | "draw"
  | "eraser"
  | "highlight"
  | "image"
  | "redact"
  | "select"
  | "shape"
  | "signature"
  | "text"
  | "watermark"
  | "whiteout";
export type EditorMode = "edit" | "editText";
export type ShapeType = "arrow" | "ellipse" | "line" | "rect";

/** Resolves a display slot (1..N) to a stable source PDF page index (1..N). */
function resolveSourcePage(displayPage: number, pageOrder: number[]): number {
  if (!pageOrder.length) return displayPage;

  return pageOrder[displayPage - 1] ?? displayPage;
}
export type WatermarkPosition = "bottom" | "center" | "tiled" | "top";

export type WatermarkConfig = {
  color: string;
  customPageRange: string;
  enabled: boolean;
  fontFamily: string;
  fontSize: number;
  imageData: string | null;
  layer: "overlay" | "underlay";
  opacity: number;
  pageScope: "all" | "custom" | "even" | "odd";
  position: WatermarkPosition;
  rotation: number;
  scaleToPage: boolean;
  text: string;
  tiledSpacing: number;
  type: "image" | "text";
};

const DEFAULT_WATERMARK_CONFIG: WatermarkConfig = {
  color: "#888888",
  customPageRange: "",
  enabled: false,
  fontFamily: "Helvetica",
  fontSize: 48,
  imageData: null,
  layer: "overlay",
  opacity: 0.3,
  pageScope: "all",
  position: "center",
  rotation: -45,
  scaleToPage: false,
  text: "CONFIDENTIAL",
  tiledSpacing: 200,
  type: "text",
};

export type BackgroundImageFit = "contain" | "cover" | "stretch";

export type BackgroundImageConfig = {
  customPageRange: string;
  enabled: boolean;
  fit: BackgroundImageFit;
  imageData: string | null;
  opacity: number;
  pageScope: "all" | "custom" | "even" | "odd";
};

const DEFAULT_BACKGROUND_IMAGE_CONFIG: BackgroundImageConfig = {
  customPageRange: "",
  enabled: false,
  fit: "cover",
  imageData: null,
  opacity: 1,
  pageScope: "all",
};

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
  /**
   * Signatures of the watermark / background-image configs that were
   * baked into the last successful save. Used by `buildEditedPdfBytes` to
   * skip re-applying an overlay that's already in the source PDF — without
   * this, every Save with `enabled: true` stacks another copy on top and
   * the page degrades to jet-black after 3-4 round-trips.
   *
   * Reset to `null` whenever the user edits any non-`enabled` field of the
   * corresponding config (so user-initiated changes always re-bake).
   * Session-scoped — fresh page loads start at `null`, which is fine
   * because the default config has `enabled: false` anyway.
   */
  lastBakedWatermarkSignature: string | null;
  lastBakedBackgroundImageSignature: string | null;
  isCompressModalOpen: boolean;
  isFindReplaceOpen: boolean;
  isPasswordModalOpen: boolean;
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
  watermarkConfig: WatermarkConfig;
  backgroundImageConfig: BackgroundImageConfig;
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
  /**
   * Commits a freshly-saved file as the new editor baseline. Replaces `file`
   * with the merged bytes pdf-lib just produced (so subsequent reads — Manage
   * Pages thumbnails, exports, etc. — see the user's edits) and clears the
   * Fabric overlay state that those bytes already encode. Without the clear
   * we'd double-render any shapes/highlights: once via the baked PDF and
   * again via the surviving Fabric overlay.
   */
  applyPostSaveReset: (savedFile: File) => void;
  markDocumentDirty: () => void;
  setFile: (file: File | null) => void;
  setIsCompressModalOpen: (value: boolean) => void;
  setIsFindReplaceOpen: (value: boolean) => void;
  setIsPasswordModalOpen: (value: boolean) => void;
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
  setWatermarkConfig: (config: Partial<WatermarkConfig>) => void;
  setBackgroundImageConfig: (config: Partial<BackgroundImageConfig>) => void;
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
  lastBakedWatermarkSignature: null,
  lastBakedBackgroundImageSignature: null,
  isCompressModalOpen: false,
  isFindReplaceOpen: false,
  isPasswordModalOpen: false,
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
  watermarkConfig: { ...DEFAULT_WATERMARK_CONFIG },
  backgroundImageConfig: { ...DEFAULT_BACKGROUND_IMAGE_CONFIG },
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
      lastBakedWatermarkSignature: null,
      lastBakedBackgroundImageSignature: null,
      isCompressModalOpen: false,
      isFindReplaceOpen: false,
      isPasswordModalOpen: false,
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
      watermarkConfig: { ...DEFAULT_WATERMARK_CONFIG },
      backgroundImageConfig: { ...DEFAULT_BACKGROUND_IMAGE_CONFIG },
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

  applyPostSaveReset: (savedFile) =>
    set({
      file: savedFile,
      fabricJsonByPage: new Map(),
      hasUnsavedChanges: false,
      historyByPage: new Map(),
      historyIndexByPage: new Map(),
      lastBakedWatermarkSignature: null,
      lastBakedBackgroundImageSignature: null,
    }),

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
  setIsCompressModalOpen: (value) => set({ isCompressModalOpen: value }),
  setIsFindReplaceOpen: (value) => set({ isFindReplaceOpen: value }),
  setIsPasswordModalOpen: (value) => set({ isPasswordModalOpen: value }),
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
  setWatermarkConfig: (config) =>
    set((state) => {
      // Invalidate the last-baked signature whenever a render-affecting field
      // changes, but NOT when the user is only flipping the Switch — toggle
      // off and back on without other edits shouldn't force a re-bake.
      const touchesSignature = Object.keys(config).some((k) => k !== "enabled");

      return {
        watermarkConfig: { ...state.watermarkConfig, ...config },
        ...(touchesSignature ? { lastBakedWatermarkSignature: null } : {}),
        // A render-affecting watermark change is a real document edit — mark
        // dirty so persistEditorDocument's hasUnsavedChanges short-circuit
        // (lines 71-73) doesn't return "no-changes" and silently swallow the
        // first save after a watermark upload.
        ...(touchesSignature ? { hasUnsavedChanges: true } : {}),
      };
    }),
  setBackgroundImageConfig: (config) =>
    set((state) => {
      const touchesSignature = Object.keys(config).some((k) => k !== "enabled");

      return {
        backgroundImageConfig: {
          ...state.backgroundImageConfig,
          ...config,
        },
        ...(touchesSignature
          ? { lastBakedBackgroundImageSignature: null }
          : {}),
        // Same dirty-flip as the watermark setter — without this the upload
        // is silently skipped by the hasUnsavedChanges short-circuit.
        ...(touchesSignature ? { hasUnsavedChanges: true } : {}),
      };
    }),
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
