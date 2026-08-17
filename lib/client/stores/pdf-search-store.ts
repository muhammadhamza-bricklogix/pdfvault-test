import { create } from "zustand";

export type SearchTextItem = {
  str: string;
  transform: number[]; // [a, b, c, d, tx, ty] in PDF user space
  width: number; // advance width in PDF user space
  height: number; // font size (advance height) in PDF user space
};

export type SearchPageData = {
  items: SearchTextItem[];
  pageHeight: number; // page height at scale=1 (CSS pixels ≈ PDF points)
};

export type MatchSpan = {
  itemIndex: number;
  charStart: number; // offset within item.str where the match starts
  charEnd: number; // offset within item.str where the match ends
};

export type SearchMatch = {
  displayPage: number; // 1-based display page number
  spans: MatchSpan[]; // one or more spans (across item boundaries)
};

type PdfSearchStore = {
  isOpen: boolean;
  query: string;
  matches: SearchMatch[];
  currentMatchIndex: number;
  isIndexing: boolean;
  indexedPageCount: number;
  textIndex: Map<number, SearchPageData>;

  open: () => void;
  close: () => void;
  setQuery: (q: string) => void;
  setMatches: (m: SearchMatch[]) => void;
  setCurrentMatchIndex: (i: number) => void;
  setIsIndexing: (v: boolean) => void;
  setIndexedPageCount: (n: number) => void;
  setPageData: (page: number, data: SearchPageData) => void;
  resetIndex: () => void;
};

export const usePdfSearchStore = create<PdfSearchStore>((set) => ({
  isOpen: false,
  query: "",
  matches: [],
  currentMatchIndex: 0,
  isIndexing: false,
  indexedPageCount: 0,
  textIndex: new Map(),

  open: () => set({ isOpen: true }),
  close: () =>
    set({ isOpen: false, query: "", matches: [], currentMatchIndex: 0 }),
  setQuery: (q) => set({ query: q }),
  setMatches: (m) => set({ matches: m, currentMatchIndex: 0 }),
  setCurrentMatchIndex: (i) => set({ currentMatchIndex: i }),
  setIsIndexing: (v) => set({ isIndexing: v }),
  setIndexedPageCount: (n) => set({ indexedPageCount: n }),
  setPageData: (page, data) =>
    set((s) => {
      const next = new Map(s.textIndex);

      next.set(page, data);

      return { textIndex: next };
    }),
  resetIndex: () =>
    set({
      textIndex: new Map(),
      matches: [],
      currentMatchIndex: 0,
      isIndexing: false,
      indexedPageCount: 0,
    }),
}));
