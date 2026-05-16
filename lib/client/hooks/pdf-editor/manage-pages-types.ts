export type PageRotation = 0 | 90 | 180 | 270;

export type DraftPage =
  | {
      heightPt: number;
      id: string;
      kind: "blank";
      rotation: PageRotation;
      widthPt: number;
    }
  | {
      id: string;
      importKey: string;
      importPageIndex: number;
      kind: "imported";
      rotation: PageRotation;
    }
  | {
      id: string;
      kind: "source";
      rotation: PageRotation;
      sourcePageIndex: number;
    };

export type ManagePagesDraftSnapshot = {
  importedPdfs: Map<string, ArrayBuffer>;
  pages: DraftPage[];
  selectedIds: string[];
};

export const DEFAULT_BLANK_PAGE = {
  heightPt: 842,
  widthPt: 595,
} as const;
