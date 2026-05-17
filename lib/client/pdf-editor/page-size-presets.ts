export type PageSizePreset = {
  heightPt: number;
  id: string;
  label: string;
  widthPt: number;
};

/** Common page sizes for Manage Pages resize (pdf-lib points). */
export const PAGE_SIZE_PRESETS: PageSizePreset[] = [
  { heightPt: 792, id: "letter", label: "US Letter", widthPt: 612 },
  { heightPt: 1008, id: "legal", label: "US Legal", widthPt: 612 },
  { heightPt: 842, id: "a4", label: "A4", widthPt: 595 },
  { heightPt: 595, id: "a5", label: "A5", widthPt: 420 },
];
