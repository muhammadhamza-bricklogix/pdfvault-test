import type { PDFPageProxy } from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

export type TextBlock = {
  color: string;
  fontFamily: string;
  fontSize: number;
  fontStyle: "italic" | "normal";
  fontWeight: "bold" | "normal";
  height: number;
  /** The real PDF font name (e.g. "JJMAVV+CMBX12") for reference */
  pdfFontName: string;
  text: string;
  width: number;
  x: number;
  y: number;
};

/**
 * Detects font weight and style from the real PDF font name.
 *
 * PDF font names follow patterns like:
 *   "SUBSET+FamilyName-BoldItalic"
 *   "Arial,Bold"
 *   "TimesNewRomanPS-BoldMT"
 *   "CMBX12"  (Computer Modern Bold Extended)
 *   "CMTI10"  (Computer Modern Text Italic)
 */
function detectWeightAndStyle(realFontName: string): {
  style: "italic" | "normal";
  weight: "bold" | "normal";
} {
  const lower = realFontName.toLowerCase().replace(/[^a-z]/g, "");

  const isBold =
    lower.includes("bold") ||
    lower.includes("cmbx") || // Computer Modern Bold Extended
    lower.includes("cmb") || // Computer Modern Bold (but not "cmr" which has "cm" prefix)
    /\bcmb\d/.test(realFontName.toLowerCase());

  const isItalic =
    lower.includes("italic") ||
    lower.includes("oblique") ||
    lower.includes("cmti") || // Computer Modern Text Italic
    lower.includes("cmmi") || // Computer Modern Math Italic
    lower.includes("slant");

  return {
    style: isItalic ? "italic" : "normal",
    weight: isBold ? "bold" : "normal",
  };
}

/**
 * Resolves the font family for a text item.
 *
 * Strategy:
 *   1. Use the pdf.js loadedName (e.g. "g_d2_f1") directly — pdf.js already
 *      registered this as a FontFace in document.fonts with the actual
 *      embedded OpenType font data. This gives us pixel-perfect rendering.
 *   2. Verify the font exists in document.fonts; if not, fall back to a
 *      web-safe family based on the textContent style hint.
 */
function resolveFontFamily(fontName: string, styleFontFamily: string): string {
  // Check if pdf.js registered this font in document.fonts
  let found = false;

  document.fonts.forEach((face) => {
    if (face.family === fontName || face.family === `"${fontName}"`) {
      found = true;
    }
  });

  if (found) return fontName;

  // Fallback: use the generic family hint from textContent.styles
  if (styleFontFamily === "monospace") return "Courier New";
  if (styleFontFamily === "serif") return "Times New Roman";

  return "Helvetica";
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Extracts a flat sequential list of fill colors from the operator list —
 * one color per showText operation. Colors are tracked through save/restore
 * graphics state. The list is in document order.
 *
 * NOTE: Color-to-text-item mapping is not yet implemented. All text items
 * currently default to #000000. This will be addressed in a future update
 * once a reliable correlation strategy between showText ops and
 * getTextContent() items is established.
 */
async function extractSequentialTextColors(
  page: PDFPageProxy,
): Promise<string[]> {
  const { OPS } = await import("pdfjs-dist");
  const opList = await page.getOperatorList();

  let currentFillColor = "#000000";
  const gsStack: string[] = [];
  const colors: string[] = [];

  for (let i = 0; i < opList.fnArray.length; i++) {
    const op = opList.fnArray[i];
    const args = opList.argsArray[i];

    if (op === OPS.save) {
      gsStack.push(currentFillColor);
    } else if (op === OPS.restore) {
      currentFillColor = gsStack.pop() ?? "#000000";
    } else if (
      op === OPS.setFillRGBColor ||
      op === OPS.setFillGray ||
      op === OPS.setFillCMYKColor
    ) {
      const colorArg = args[0];

      if (typeof colorArg === "string" && colorArg.startsWith("#")) {
        currentFillColor = colorArg;
      } else if (typeof colorArg === "number") {
        currentFillColor = rgbToHex(colorArg, colorArg, colorArg);
      }
    } else if (
      op === OPS.showText ||
      op === OPS.showSpacedText ||
      op === OPS.nextLineShowText ||
      op === OPS.nextLineSetSpacingShowText
    ) {
      colors.push(currentFillColor);
    }
  }

  return colors;
}

/**
 * Extracts text items from a PDF page and converts their positions into
 * Fabric.js canvas coordinates (base space, zoom=1).
 *
 * Uses the actual embedded fonts loaded by pdf.js (via document.fonts)
 * instead of mapping to generic web-safe fonts.
 */
export async function extractTextBlocks(
  page: PDFPageProxy,
): Promise<TextBlock[]> {
  const viewport = page.getViewport({ scale: 1.0 });
  const [textContent] = await Promise.all([
    page.getTextContent(),
    // Color extraction runs but isn't mapped yet — keep the call so the
    // pipeline is ready when mapping is implemented.
    extractSequentialTextColors(page),
  ]);

  const blocks: TextBlock[] = [];

  // Build a map of fontName → real PDF font name + weight/style from commonObjs
  const fontInfoMap = new Map<
    string,
    { realName: string; style: "italic" | "normal"; weight: "bold" | "normal" }
  >();

  for (const item of textContent.items) {
    if (!("fontName" in item)) continue;

    const { fontName } = item as TextItem;

    if (fontInfoMap.has(fontName)) continue;

    try {
      if (page.commonObjs.has(fontName)) {
        const fontObj = page.commonObjs.get(fontName);
        const realName = (fontObj?.name as string) ?? fontName;
        const { weight, style } = detectWeightAndStyle(realName);

        fontInfoMap.set(fontName, { realName, style, weight });
      } else {
        fontInfoMap.set(fontName, {
          realName: fontName,
          style: "normal",
          weight: "normal",
        });
      }
    } catch {
      fontInfoMap.set(fontName, {
        realName: fontName,
        style: "normal",
        weight: "normal",
      });
    }
  }

  for (const item of textContent.items) {
    if (!("str" in item)) continue;

    const textItem = item as TextItem;
    const { str, transform, fontName } = textItem;

    if (!str.trim()) continue;

    const fontSize = Math.abs(transform[3]);

    if (fontSize < 2) continue;

    const [vpX, vpY] = viewport.convertToViewportPoint(
      transform[4] as number,
      transform[5] as number,
    );

    const vpHeight = fontSize * viewport.scale;
    const vpWidth = textItem.width * viewport.scale;
    const y = vpY - vpHeight;

    if (vpWidth < 2 || vpHeight < 2) continue;

    const fontInfo = fontInfoMap.get(fontName) ?? {
      realName: fontName,
      style: "normal" as const,
      weight: "normal" as const,
    };

    const styleFontFamily =
      textContent.styles[fontName]?.fontFamily ?? "sans-serif";

    blocks.push({
      color: "#000000",
      fontFamily: resolveFontFamily(fontName, styleFontFamily),
      fontSize,
      fontStyle: fontInfo.style,
      fontWeight: fontInfo.weight,
      height: vpHeight,
      pdfFontName: fontInfo.realName,
      text: str,
      width: vpWidth,
      x: Math.round(vpX),
      y: Math.round(y),
    });
  }

  return blocks;
}
