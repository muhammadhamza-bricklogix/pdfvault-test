import type { PDFDocument, PDFFont } from "pdf-lib";

export type PageNumberPosition =
  | "bottom-center"
  | "bottom-left"
  | "bottom-right"
  | "top-center"
  | "top-left"
  | "top-right";

export type PageNumberFormat =
  | "n"
  | "n-of-N"
  | "n-slash-N"
  | "page-n"
  | "page-n-of-N";

export type AddPageNumbersOptions = {
  color: { b: number; g: number; r: number };
  endPage?: number;
  fontSize: number;
  format: PageNumberFormat;
  margin: number;
  position: PageNumberPosition;
  startNumber: number;
  startPage?: number;
};

function formatLabel(
  format: PageNumberFormat,
  n: number,
  total: number,
): string {
  switch (format) {
    case "n":
      return String(n);
    case "page-n":
      return `Page ${n}`;
    case "n-of-N":
      return `${n} of ${total}`;
    case "page-n-of-N":
      return `Page ${n} of ${total}`;
    case "n-slash-N":
      return `${n}/${total}`;
  }
}

function computePosition(
  position: PageNumberPosition,
  pageWidth: number,
  pageHeight: number,
  textWidth: number,
  fontSize: number,
  margin: number,
): { x: number; y: number } {
  const isTop = position.startsWith("top");
  const y = isTop ? pageHeight - margin - fontSize : margin;

  if (position.endsWith("left")) return { x: margin, y };
  if (position.endsWith("right"))
    return { x: pageWidth - margin - textWidth, y };

  return { x: (pageWidth - textWidth) / 2, y };
}

/**
 * Stamps page numbers onto every page in the given range using pdf-lib's
 * Helvetica. Mutates `pdfDoc` in place. Caller is responsible for `.save()`.
 */
export async function addPageNumbersToPdf(
  pdfDoc: PDFDocument,
  options: AddPageNumbersOptions,
): Promise<void> {
  const { StandardFonts, rgb } = await import("pdf-lib");
  const font: PDFFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pages = pdfDoc.getPages();
  const total = pages.length;
  const first = Math.max(1, options.startPage ?? 1);
  const last = Math.min(total, options.endPage ?? total);

  if (first > last) return;

  const labelTotal = last - first + 1 + (options.startNumber - 1);

  for (let i = first - 1; i < last; i++) {
    const page = pages[i];
    const { height, width } = page.getSize();
    const n = options.startNumber + (i - (first - 1));
    const label = formatLabel(options.format, n, labelTotal);
    const textWidth = font.widthOfTextAtSize(label, options.fontSize);
    const { x, y } = computePosition(
      options.position,
      width,
      height,
      textWidth,
      options.fontSize,
      options.margin,
    );

    page.drawText(label, {
      color: rgb(options.color.r, options.color.g, options.color.b),
      font,
      size: options.fontSize,
      x,
      y,
    });
  }
}
