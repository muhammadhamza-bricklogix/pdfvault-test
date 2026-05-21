import type { PDFPageProxy } from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

export type FontData = {
  bold: boolean;
  bytes: Uint8Array;
  italic: boolean;
  /** The pdf.js identifier (e.g. "g_d2_f1") — matches Fabric fontFamily */
  loadedName: string;
};

export type TextBlock = {
  color: string;
  fontFamily: string;
  fontSize: number;
  fontStyle: "italic" | "normal";
  fontWeight: "bold" | "normal";
  height: number;
  /** The real PDF font name (e.g. "JJMAVV+CMBX12") for reference */
  pdfFontName: string;
  /** Page rotation (0/90/180/270) so the editor can rotate Fabric IText to match. */
  rotation: 0 | 90 | 180 | 270;
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
    } else if (op === OPS.setFillRGBColor) {
      // pdf.js may pass either a pre-formatted "#rrggbb" string OR
      // three separate 0–1 floats.
      const a0 = args[0];

      if (typeof a0 === "string" && a0.startsWith("#")) {
        currentFillColor = a0;
      } else if (
        typeof a0 === "number" &&
        typeof args[1] === "number" &&
        typeof args[2] === "number"
      ) {
        currentFillColor = rgbToHex(a0, args[1] as number, args[2] as number);
      }
    } else if (op === OPS.setFillGray) {
      const g = args[0];

      if (typeof g === "number") {
        currentFillColor = rgbToHex(g, g, g);
      } else if (typeof g === "string" && g.startsWith("#")) {
        currentFillColor = g;
      }
    } else if (op === OPS.setFillCMYKColor) {
      const a0 = args[0];

      if (typeof a0 === "string" && a0.startsWith("#")) {
        currentFillColor = a0;
      } else if (
        typeof a0 === "number" &&
        typeof args[1] === "number" &&
        typeof args[2] === "number" &&
        typeof args[3] === "number"
      ) {
        // Quick CMYK→RGB conversion (no ICC profile).
        const c = a0;
        const m = args[1] as number;
        const y = args[2] as number;
        const k = args[3] as number;
        const r = (1 - c) * (1 - k);
        const gr = (1 - m) * (1 - k);
        const b = (1 - y) * (1 - k);

        currentFillColor = rgbToHex(r, gr, b);
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
  // Normalize page rotation to one of the four canonical PDF angles.
  const rawRotation = (page.rotate ?? 0) as number;
  const pageRotation: 0 | 90 | 180 | 270 =
    rawRotation === 90 || rawRotation === 180 || rawRotation === 270
      ? rawRotation
      : 0;
  const [textContent, colors] = await Promise.all([
    page.getTextContent(),
    extractSequentialTextColors(page),
  ]);

  // Map showText-op colors → text items. We try 1:1 by item index when the
  // counts line up; otherwise we fall back to the document-wide mode color
  // (handles uniformly-colored docs) and finally to black.
  const sameLength = colors.length === textContent.items.length;
  const uniqueColors = new Set(colors);
  const fallbackColor = uniqueColors.size === 1 ? colors[0]! : "#000000";

  const colorForItem = (itemIndex: number): string => {
    if (sameLength) return colors[itemIndex] ?? fallbackColor;

    return fallbackColor;
  };

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

  for (let itemIndex = 0; itemIndex < textContent.items.length; itemIndex++) {
    const item = textContent.items[itemIndex];

    if (!("str" in item)) continue;

    const textItem = item as TextItem;
    const { str, transform, fontName } = textItem;

    if (!str.trim()) continue;

    // Font size is the magnitude of the text matrix's d-axis (its y vector),
    // i.e. `sqrt(c² + d²)`. For upright text d == fontSize and c == 0 so this
    // collapses to `abs(d)`. For rotated text (e.g. pages from Manage Pages
    // that bake a 90° transform), d collapses to 0 and the size lives in c —
    // taking the hypot keeps the filter from skipping those items entirely.
    const fontSize = Math.hypot(transform[2] as number, transform[3] as number);

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

    const resolvedFamily = resolveFontFamily(fontName, styleFontFamily);

    console.log(
      `[TextExtract] "${str.slice(0, 40)}" | font=${fontName} resolved=${resolvedFamily} real=${fontInfo.realName} w=${fontInfo.weight} s=${fontInfo.style} | transform=[${transform.map((v: number) => v.toFixed(2)).join(",")}] | pdfX=${(transform[4] as number).toFixed(2)} pdfY=${(transform[5] as number).toFixed(2)} | vpX=${vpX.toFixed(2)} vpY=${vpY.toFixed(2)} | fontSize=${fontSize.toFixed(2)} | textItem.width=${textItem.width.toFixed(2)} vpWidth=${vpWidth.toFixed(2)} vpHeight=${vpHeight.toFixed(2)} | finalX=${Math.round(vpX)} finalY=${Math.round(y)} | viewport.scale=${viewport.scale}`,
    );

    blocks.push({
      color: colorForItem(itemIndex),
      fontFamily: resolvedFamily,
      fontSize,
      fontStyle: fontInfo.style,
      fontWeight: fontInfo.weight,
      height: vpHeight,
      pdfFontName: fontInfo.realName,
      rotation: pageRotation,
      text: str,
      width: vpWidth,
      x: Math.round(vpX),
      y: Math.round(y),
    });
  }

  return blocks;
}

/**
 * Extracts binary font data from pdf.js for the given font identifiers.
 *
 * pdf.js converts embedded PDF fonts to OpenType format and exposes the bytes
 * via `commonObjs.get(fontName).data`. We copy these bytes (they're views that
 * become invalid when the page is destroyed) so they can be embedded into the
 * output PDF via pdf-lib + fontkit.
 *
 * Fonts without binary data (Type3, system fonts, missing) are skipped —
 * they'll fall back to StandardFonts during export.
 */
export function extractFontData(
  page: PDFPageProxy,
  fontNames: Set<string>,
): FontData[] {
  const result: FontData[] = [];

  // Array.from() instead of `for...of` so we stay compatible with the
  // project's TS `target: "es5"` (otherwise TS2802 trips on Set iteration).
  Array.from(fontNames).forEach((fontName) => {
    try {
      if (!page.commonObjs.has(fontName)) {
        console.warn(`[FontExtract] commonObjs missing: ${fontName}`);

        return;
      }

      // fontExtraProperties must be true in getDocument() options,
      // otherwise pdf.js clears font data after loading into document.fonts.
      const fontObj = page.commonObjs.get(fontName) as Record<string, unknown>;

      if (!fontObj) {
        console.warn(`[FontExtract] fontObj is null: ${fontName}`);

        return;
      }

      const data = (fontObj as any).data as Uint8Array | undefined;

      if (!data || data.byteLength === 0) {
        console.warn(`[FontExtract] No binary data for: ${fontName}`);

        return;
      }

      result.push({
        bold: ((fontObj as any).bold as boolean) ?? false,
        bytes: new Uint8Array(data),
        italic: ((fontObj as any).italic as boolean) ?? false,
        loadedName: fontName,
      });
    } catch (err) {
      console.error(`[FontExtract] Error reading font ${fontName}:`, err);
    }
  });

  return result;
}
