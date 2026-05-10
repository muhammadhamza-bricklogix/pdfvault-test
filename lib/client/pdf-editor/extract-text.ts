import type { PDFPageProxy } from "pdfjs-dist";

import { Util } from "pdfjs-dist";

export type ExtractedTextItem = {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
};

export async function extractTextItems(
  page: PDFPageProxy,
  zoom: number,
): Promise<ExtractedTextItem[]> {
  const viewport = page.getViewport({ scale: zoom });
  const { items } = await page.getTextContent();

  const result: ExtractedTextItem[] = [];

  for (const item of items) {
    if (!("str" in item) || !("transform" in item)) continue;
    if (item.str.trim().length === 0) continue;

    const m = Util.transform(viewport.transform, item.transform);
    const fontSize = Math.hypot(m[2], m[3]);
    const x = m[4];
    const y = m[5];
    const width = item.width * viewport.scale;
    const height = fontSize;

    console.log("Extracted text item:", {
      str: item.str,
      x,
      y,
      width,
      height,
      fontSize,
      fontName: item.fontName,
    });

    result.push({
      fontName: item.fontName,
      fontSize,
      height,
      str: item.str,
      width,
      x,
      y,
    });
  }

  return result;
}
