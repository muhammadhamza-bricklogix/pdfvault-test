import type { PDFPageProxy } from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

export type TextBlock = {
  color: string;
  fontFamily: string;
  fontSize: number;
  height: number;
  text: string;
  width: number;
  x: number;
  y: number;
};

/**
 * Parses a PDF.js font name string and returns a Fabric-compatible font family.
 *
 * PDF font names come in many forms:
 *   - Standard:   "Helvetica", "Times-Roman", "Courier"
 *   - Subset:     "BCDERF+Arial", "ABCDEF+TimesNewRoman,Bold"
 *   - Internal:   "g_d0_f1" (generic fallback)
 *
 * We strip the subset prefix (everything before "+"), then match against
 * known family keywords to return one of the three standard families.
 */
function mapPdfFontFamily(fontName: string): string {
  const stripped = fontName.includes("+")
    ? fontName.slice(fontName.indexOf("+") + 1)
    : fontName;

  const lower = stripped.toLowerCase().replace(/[^a-z]/g, "");

  if (lower.includes("courier") || lower.includes("mono")) {
    return "Courier New";
  }

  if (
    lower.includes("times") ||
    lower.includes("georgia") ||
    lower.includes("garamond") ||
    lower.includes("palatino")
  ) {
    return "Times New Roman";
  }

  if (
    lower.includes("arial") ||
    lower.includes("helvetica") ||
    lower.includes("verdana") ||
    lower.includes("calibri") ||
    lower.includes("trebuchet") ||
    lower.includes("tahoma")
  ) {
    return "Helvetica";
  }

  // Unknown / internal font names → safe sans-serif fallback
  return "Helvetica";
}

/**
 * Extracts text items from a PDF page and converts their positions into
 * Fabric.js canvas coordinates (base space, zoom=1).
 *
 * The Fabric canvas uses the same dimensions as a pdf.js viewport at scale=1,
 * so the viewport transform handles all coordinate conversion for us.
 *
 * The transform matrix from `getTextContent()` is a 6-element affine matrix:
 *   [scaleX, skewY, skewX, scaleY, translateX, translateY]
 *
 * In PDF coordinate space (origin bottom-left, Y up), translateX/Y give the
 * text baseline position. The viewport's `convertToViewportPoint` flips Y
 * and scales to match our canvas coordinate system.
 */
export async function extractTextBlocks(
  page: PDFPageProxy,
): Promise<TextBlock[]> {
  const viewport = page.getViewport({ scale: 1.0 });
  const textContent = await page.getTextContent();
  const blocks: TextBlock[] = [];

  // --- DEBUG LOGGING ---
  console.group("[text-extraction] Page info");
  console.log("viewport scale:", viewport.scale);
  console.log("viewport width:", viewport.width, "height:", viewport.height);
  console.log(
    "page rotation:",
    page.rotate,
    "userUnit:",
    page.userUnit,
  );
  console.log("total textContent items:", textContent.items.length);
  console.groupEnd();

  let loggedCount = 0;

  for (const item of textContent.items) {
    // Skip marked-content items (they have `type` instead of `str`)
    if (!("str" in item)) continue;

    const textItem = item as TextItem;
    const { str, transform, fontName } = textItem;

    // Skip empty or whitespace-only text
    if (!str.trim()) continue;

    // transform = [scaleX, skewY, skewX, scaleY, translateX, translateY]
    const fontSize = Math.abs(transform[3]);

    // Skip tiny text (likely artifacts or metadata)
    if (fontSize < 2) continue;

    // Convert PDF text origin (baseline, bottom-left) to viewport coords (top-left)
    // translateX, translateY are the baseline position in PDF space
    const [vpX, vpY] = viewport.convertToViewportPoint(
      transform[4] as number,
      transform[5] as number,
    );

    // The height of the text in viewport space
    const vpHeight = fontSize * viewport.scale;

    // Width from getTextContent is in PDF space — scale to viewport
    const vpWidth = textItem.width * viewport.scale;

    // vpY points to the baseline in viewport coords; move up by the text height
    // to get the top-left corner
    const y = vpY - vpHeight;

    // --- DEBUG: Log first 5 items ---
    if (loggedCount < 5) {
      console.group(`[text-extraction] Item ${loggedCount}: "${str.slice(0, 30)}"`);
      console.log("transform:", JSON.stringify(transform));
      console.log("fontName:", fontName, "→", mapPdfFontFamily(fontName));
      console.log("fontSize (from transform[3]):", fontSize);
      console.log("textItem.width:", textItem.width, "textItem.height:", textItem.height);
      console.log("PDF coords: x=", transform[4], "y=", transform[5]);
      console.log("viewport coords: vpX=", vpX, "vpY=", vpY);
      console.log("final Fabric coords: x=", vpX, "y=", y);
      console.log("final size: w=", vpWidth, "h=", vpHeight);
      console.groupEnd();
      loggedCount++;
    }

    // Filter out blocks that are too small to be useful
    if (vpWidth < 2 || vpHeight < 2) continue;

    blocks.push({
      color: "#000000",
      fontFamily: mapPdfFontFamily(fontName),
      fontSize,
      height: vpHeight,
      text: str,
      width: vpWidth,
      x: vpX,
      y,
    });
  }

  console.log("[text-extraction] Total blocks extracted:", blocks.length);

  return blocks;
}
