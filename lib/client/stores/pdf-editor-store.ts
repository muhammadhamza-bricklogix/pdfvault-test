import type { PDFDocumentProxy } from "pdfjs-dist";
import type { FontData } from "@/lib/client/pdf-editor/text-extraction";

import { create } from "zustand";

import { toast } from "@/lib/shared/utils/toast";

const MAX_HISTORY = 50;

export type ActiveTool =
  | "backgroundImage"
  | "draw"
  | "editText"
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
  /**
   * Presigned S3 URL for the currently open cloud document. When set,
   * `usePdfLoader` passes this URL directly to pdf.js (range requests) instead
   * of loading the full ArrayBuffer — the editor becomes usable after the first
   * range fetch (~200KB) rather than after the full download.
   *
   * Cleared in `clearFile` and `applyPostSaveReset` so post-save reloads use
   * the local saved bytes (ArrayBuffer path) which are already in memory.
   */
  pdfSourceUrl: string | null;
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
  isFormFieldsModalOpen: boolean;
  isManagePagesOpen: boolean;
  isPageNumbersModalOpen: boolean;
  isRestoringHistory: boolean;
  /**
   * True while the post-sign-in hydrator is uploading a restored file
   * to /documents/upload and waiting for the fresh document id. Used
   * by PdfEditorShell to render the loading skeleton (not the empty
   * drop-zone) during the save. Cleared once the id is in hand and
   * the URL has been updated.
   */
  isRestoringSession: boolean;
  isSignatureModalOpen: boolean;
  isSignedIn: boolean;
  /**
   * Source page indexes that have had their text successfully extracted
   * into the Fabric IText overlay (driven by the "Edit Text" tool). Once
   * a page is in this set we know:
   *   • `usePageRenderer` must `suppressText` so pdf.js's native text
   *     doesn't double-paint over our IText
   *   • `useEditTextMode` must skip its extract effect (text is already
   *     on the canvas)
   * Cleared on `clearFile` and `applyPostSaveReset` since the underlying
   * PDF bytes change in both cases.
   */
  extractedPages: Set<number>;
  pageCount: number;
  pageOrder: number[];
  pdfDocument: PDFDocumentProxy | null;
  shapeFill: string;
  shapeStroke: string;
  shapeStrokeWidth: number;
  /** Composite (PDF + Fabric) snapshots keyed by display-page number. Updated
   *  live as the user edits so the thumbnail sidebar reflects text changes. */
  thumbnailSnapshots: Map<number, string>;
  watermarkConfig: WatermarkConfig;
  backgroundImageConfig: BackgroundImageConfig;
  zoom: number;

  addBlankPage: () => Promise<void>;
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
  replaceFabricJsonByPage: (map: Map<number, string>) => void;
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
   *
   * When the save materialized a sidebar reorder, the caller passes
   * `remappedState` to atomically swap the source-keyed editor state with
   * the new display-slot-keyed state that matches the just-saved bytes.
   * Without this, the next save would re-materialize using a stale Map.
   */
  applyPostSaveReset: (
    savedFile: File,
    remappedState?: {
      extractedPages: Set<number>;
      fabricJsonByPage: Map<number, string>;
      historyByPage: Map<number, string[]>;
      historyIndexByPage: Map<number, number>;
    },
  ) => void;
  markDocumentDirty: () => void;
  setFile: (file: File | null) => void;
  setPdfSourceUrl: (url: string | null) => void;
  setIsCompressModalOpen: (value: boolean) => void;
  setIsFindReplaceOpen: (value: boolean) => void;
  setIsFormFieldsModalOpen: (value: boolean) => void;
  setIsPageNumbersModalOpen: (value: boolean) => void;
  setIsPasswordModalOpen: (value: boolean) => void;
  setIsCreatePdfModalOpen: (value: boolean) => void;
  setIsManagePagesOpen: (value: boolean) => void;
  setIsCreatingShape: (value: boolean) => void;
  setIsRestoringHistory: (value: boolean) => void;
  setIsRestoringSession: (value: boolean) => void;
  setIsSignatureModalOpen: (value: boolean) => void;
  setIsSignedIn: (value: boolean) => void;
  markPageExtracted: (sourcePage: number) => void;
  setPdfDocument: (doc: PDFDocumentProxy | null, pageCount: number) => void;
  setShapeFill: (color: string) => void;
  setShapeStroke: (color: string) => void;
  setShapeStrokeWidth: (width: number) => void;
  setWatermarkConfig: (config: Partial<WatermarkConfig>) => void;
  setBackgroundImageConfig: (config: Partial<BackgroundImageConfig>) => void;
  setZoom: (zoom: number) => void;
  setThumbnailSnapshot: (displayPage: number, dataUrl: string) => void;
  clearThumbnailSnapshots: () => void;
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
  pdfSourceUrl: null,
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
  isFormFieldsModalOpen: false,
  isPageNumbersModalOpen: false,
  isPasswordModalOpen: false,
  isCreatePdfModalOpen: false,
  isCreatingShape: false,
  isManagePagesOpen: false,
  isRestoringHistory: false,
  isRestoringSession: false,
  isSignatureModalOpen: false,
  isSignedIn: false,
  extractedPages: new Set(),
  pageCount: 0,
  pageOrder: [],
  pdfDocument: null,
  shapeFill: "transparent",
  shapeStroke: "#000000",
  shapeStrokeWidth: 2,
  thumbnailSnapshots: new Map(),
  watermarkConfig: { ...DEFAULT_WATERMARK_CONFIG },
  backgroundImageConfig: { ...DEFAULT_BACKGROUND_IMAGE_CONFIG },
  zoom: 1.0,

  addBlankPage: async () => {
    const state = get();
    const currentFile = state.file;

    if (!currentFile) {
      toast.info({
        title: "No PDF open",
        description: "Open or create a PDF before adding a page.",
      });

      return;
    }

    const { PDFDocument } = await import("pdf-lib");
    const bytes = new Uint8Array(await currentFile.arrayBuffer());
    const pdfDoc = await PDFDocument.load(bytes);

    // Default to A4 if the document has no pages; otherwise copy the last
    // page's dimensions so the new blank page matches the existing doc.
    const existingCount = pdfDoc.getPageCount();
    const dims =
      existingCount > 0
        ? pdfDoc.getPage(existingCount - 1).getSize()
        : { width: 612, height: 792 };

    pdfDoc.addPage([dims.width, dims.height]);

    const newBytes = await pdfDoc.save();
    const newFile = new File([newBytes as BlobPart], currentFile.name, {
      type: "application/pdf",
    });

    const newPageCount = existingCount + 1;

    set({
      file: newFile,
      pageCount: newPageCount,
      pageOrder: Array.from({ length: newPageCount }, (_, i) => i + 1),
      currentPage: newPageCount,
      hasUnsavedChanges: true,
      // The new page has no extracted text / overlays yet.
      extractedPages: new Set(),
    });
  },

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
      pdfSourceUrl: null,
      hasUnsavedChanges: false,
      pendingCloudSaveAfterReload: false,
      fontDataByLoadedName: new Map(),
      historyByPage: new Map(),
      historyIndexByPage: new Map(),
      lastBakedWatermarkSignature: null,
      lastBakedBackgroundImageSignature: null,
      isCompressModalOpen: false,
      isFindReplaceOpen: false,
      isFormFieldsModalOpen: false,
      isPageNumbersModalOpen: false,
      isPasswordModalOpen: false,
      isCreatePdfModalOpen: false,
      isCreatingShape: false,
      isManagePagesOpen: false,
      isRestoringHistory: false,
      isRestoringSession: false,
      isSignatureModalOpen: false,
      extractedPages: new Set(),
      pageCount: 0,
      pageOrder: [],
      pdfDocument: null,
      shapeFill: "transparent",
      shapeStroke: "#000000",
      shapeStrokeWidth: 2,
      thumbnailSnapshots: new Map(),
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

  replaceFabricJsonByPage: (map) =>
    set({ fabricJsonByPage: new Map(map), hasUnsavedChanges: true }),

  markDocumentDirty: () => set({ hasUnsavedChanges: true }),

  clearDocumentDirty: () => set({ hasUnsavedChanges: false }),

  applyPostSaveReset: (savedFile, remappedState) =>
    set((state) => ({
      file: savedFile,
      // KEEP fabricJsonByPage + extractedPages. The merge pipeline whites-out
      // the source word and draws the modified text on top, which makes the
      // saved file VISUALLY correct in any PDF viewer — but pdf.js's text
      // extraction can still SEE the source text under the whiteout (it lives
      // in the content stream). Re-extracting after save would surface both
      // the source word AND the modified one as Fabric ITexts at the same
      // position → visible double layer in the editor.
      //
      // By preserving the pre-save Fabric snapshot (with modified entries
      // already marked pristine by `applyPristineSweep` inside
      // `persistEditorDocument`), the editor reuses the in-memory ITexts
      // instead of re-extracting, so the visible state matches what the
      // user just saved. See QA report 2026-06-17.
      //
      // When `remappedState` is provided (sidebar-reorder save), the merge
      // just produced bytes carrying the new page order PLUS overlays baked
      // (except `pageNumber`, which is overlay-only per 2026-06-19 (d)). The
      // source-page-keyed editor state in `state.*` no longer matches the
      // file — swap in the display-slot-keyed remapped state.
      //
      // No `pendingCloudSaveAfterReload` flip: the single upload above
      // already carries the user's full save (reorder + edits + page-number
      // overlays via `editorState`). Manage Pages still sets this flag
      // separately because its `applyManagePagesSave` doesn't upload at all
      // — it relies on `useEditorAutoPersist` to drive the only cloud save.
      fabricJsonByPage: remappedState
        ? new Map(remappedState.fabricJsonByPage)
        : state.fabricJsonByPage,
      extractedPages: remappedState
        ? new Set(remappedState.extractedPages)
        : state.extractedPages,
      hasUnsavedChanges: false,
      // History is cleared on identity saves anyway, but when remapped the
      // pre-save history was keyed by old source pages — swap to the remapped
      // version so undo/redo references the right pages of the new file.
      historyByPage: remappedState
        ? new Map(remappedState.historyByPage)
        : new Map(),
      historyIndexByPage: remappedState
        ? new Map(remappedState.historyIndexByPage)
        : new Map(),
      // After save, reload uses local bytes (ArrayBuffer path) — clear the URL
      // so usePdfLoader doesn't re-trigger range requests against an expired
      // presigned URL.
      pdfSourceUrl: null,
      lastBakedWatermarkSignature: null,
      lastBakedBackgroundImageSignature: null,
      // Snapshots are keyed by display page; after save the baked PDF is the
      // source of truth, so re-render thumbnails from the new bytes.
      thumbnailSnapshots: new Map(),
    })),

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
  setPdfSourceUrl: (url) => set({ pdfSourceUrl: url }),
  setIsCompressModalOpen: (value) => set({ isCompressModalOpen: value }),
  setIsFindReplaceOpen: (value) => set({ isFindReplaceOpen: value }),
  setIsFormFieldsModalOpen: (value) => set({ isFormFieldsModalOpen: value }),
  setIsPageNumbersModalOpen: (value) => set({ isPageNumbersModalOpen: value }),
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
  setIsRestoringSession: (value) => set({ isRestoringSession: value }),
  setIsSignatureModalOpen: (value) => set({ isSignatureModalOpen: value }),
  setIsSignedIn: (value) => set({ isSignedIn: value }),
  markPageExtracted: (sourcePage) =>
    set((state) => {
      if (state.extractedPages.has(sourcePage)) return {};
      const next = new Set(state.extractedPages);

      next.add(sourcePage);

      return { extractedPages: next };
    }),
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

  setThumbnailSnapshot: (displayPage, dataUrl) =>
    set((state) => {
      const next = new Map(state.thumbnailSnapshots);

      next.set(displayPage, dataUrl);

      return { thumbnailSnapshots: next };
    }),

  clearThumbnailSnapshots: () => set({ thumbnailSnapshots: new Map() }),

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
