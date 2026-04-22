import type { PDFDocumentProxy } from "pdfjs-dist";

import { create } from "zustand";

type PdfEditorStore = {
  currentPage: number;
  file: File | null;
  isSignedIn: boolean;
  pageCount: number;
  pdfDocument: PDFDocumentProxy | null;
  zoom: number;
  setCurrentPage: (page: number) => void;
  setFile: (file: File) => void;
  setIsSignedIn: (value: boolean) => void;
  setPdfDocument: (doc: PDFDocumentProxy, pageCount: number) => void;
  setZoom: (zoom: number) => void;
};

export const usePdfEditorStore = create<PdfEditorStore>((set) => ({
  currentPage: 1,
  file: null,
  isSignedIn: false,
  pageCount: 0,
  pdfDocument: null,
  zoom: 1.0,
  setCurrentPage: (page) => set({ currentPage: page }),
  setFile: (file) => set({ file }),
  setIsSignedIn: (value) => set({ isSignedIn: value }),
  setPdfDocument: (doc, pageCount) => set({ pdfDocument: doc, pageCount }),
  setZoom: (zoom) => set({ zoom }),
}));
