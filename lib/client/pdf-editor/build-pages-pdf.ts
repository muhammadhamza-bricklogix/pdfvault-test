import type { PDFDocument as PdfLibDoc } from "pdf-lib";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { DraftPage } from "@/lib/client/hooks/pdf-editor/manage-pages-types";

import { degrees } from "pdf-lib";

import { appendPdfPage } from "@/lib/client/pdf-editor/append-pdf-page";
import { renderPageToPng } from "@/lib/client/pdf-editor/render-page-png";

type BuildPdfInput = {
  importedPdfs: Map<string, ArrayBuffer>;
  pages: DraftPage[];
  pdfDocument?: PDFDocumentProxy | null;
  sourceBytes: ArrayBuffer;
};

function hexToRgbFloats(hex: string): [number, number, number] {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);

  return [r / 255, g / 255, b / 255];
}

/**
 * Renders a pdf.js page with a transparent background then composes it on top
 * of a freshly added pdf-lib page that has been filled with `backgroundColor`.
 * Used for source/imported pages that the user has tinted via Manage Pages.
 */
async function appendColoredPageFromPdfJs(
  outputPdf: PdfLibDoc,
  pdfjsDoc: PDFDocumentProxy,
  pageIndex0: number,
  backgroundColor: string,
  override: { heightPt?: number; rotation?: number; widthPt?: number },
): Promise<void> {
  const { BlendMode, rgb } = await import("pdf-lib");
  const pdfjsPage = await pdfjsDoc.getPage(pageIndex0 + 1);
  // Render at the source's native orientation; rotation is applied via the
  // page's /Rotate metadata after compositing so the editor can still extract
  // text in its native coordinate space.
  const viewport = pdfjsPage.getViewport({ scale: 1 });

  const widthPt = override.widthPt ?? viewport.width;
  const heightPt = override.heightPt ?? viewport.height;

  const newPage = outputPdf.addPage([widthPt, heightPt]);
  const [r, g, b] = hexToRgbFloats(backgroundColor);

  // 1. Paint the color across the page.
  newPage.drawRectangle({
    color: rgb(r, g, b),
    height: heightPt,
    width: widthPt,
    x: 0,
    y: 0,
  });

  // 2. Render the source page (white bg) and composite on top via Multiply
  //    so the colored fill shows through whitespace.
  const pngBytes = await renderPageToPng(pdfjsPage, {
    suppressText: false,
    transparent: false,
  });
  const png = await outputPdf.embedPng(pngBytes);

  newPage.drawImage(png, {
    blendMode: BlendMode.Multiply,
    height: heightPt,
    width: widthPt,
    x: 0,
    y: 0,
  });

  // Compose draft delta with the source's existing /Rotate so a delta that
  // visually returns the page to upright also writes /Rotate=0 here.
  const sourceRotation = (pdfjsPage.rotate ?? 0) as number;
  const finalRotation =
    (((sourceRotation + (override.rotation ?? 0)) % 360) + 360) % 360;

  newPage.setRotation(degrees(finalRotation));
}

export async function buildPdfFromDraft({
  importedPdfs,
  pages,
  pdfDocument,
  sourceBytes,
}: BuildPdfInput): Promise<Uint8Array> {
  const { PDFDocument, rgb } = await import("pdf-lib");

  const sourcePdf = await PDFDocument.load(sourceBytes);
  const outputPdf = await PDFDocument.create();

  // pdf.js docs for imported PDFs are loaded lazily and cached per importKey.
  const importedPdfjsCache = new Map<string, PDFDocumentProxy>();

  async function getImportedPdfjs(
    importKey: string,
  ): Promise<PDFDocumentProxy | null> {
    const cached = importedPdfjsCache.get(importKey);

    if (cached) return cached;

    const bytes = importedPdfs.get(importKey);

    if (!bytes) return null;

    const pdfjs = await import("pdfjs-dist");
    const proxy = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;

    importedPdfjsCache.set(importKey, proxy);

    return proxy;
  }

  for (const entry of pages) {
    if (entry.kind === "blank") {
      const page = outputPdf.addPage([entry.widthPt, entry.heightPt]);

      if (entry.rotation) {
        page.setRotation(degrees(entry.rotation));
      }

      const [r, g, b] = entry.backgroundColor
        ? hexToRgbFloats(entry.backgroundColor)
        : [1, 1, 1];

      page.drawRectangle({
        color: rgb(r, g, b),
        height: entry.heightPt,
        width: entry.widthPt,
        x: 0,
        y: 0,
      });
      continue;
    }

    if (entry.kind === "source") {
      if (entry.backgroundColor && pdfDocument) {
        await appendColoredPageFromPdfJs(
          outputPdf,
          pdfDocument,
          entry.sourcePageIndex - 1,
          entry.backgroundColor,
          {
            heightPt: entry.heightPt,
            rotation: entry.rotation,
            widthPt: entry.widthPt,
          },
        );
        continue;
      }

      await appendPdfPage(outputPdf, sourcePdf, entry.sourcePageIndex - 1, {
        heightPt: entry.heightPt,
        rotation: entry.rotation,
        widthPt: entry.widthPt,
      });
      continue;
    }

    const importBytes = importedPdfs.get(entry.importKey);

    if (!importBytes) continue;

    if (entry.backgroundColor) {
      const importPdfjs = await getImportedPdfjs(entry.importKey);

      if (importPdfjs) {
        await appendColoredPageFromPdfJs(
          outputPdf,
          importPdfjs,
          entry.importPageIndex - 1,
          entry.backgroundColor,
          {
            heightPt: entry.heightPt,
            rotation: entry.rotation,
            widthPt: entry.widthPt,
          },
        );
        continue;
      }
    }

    const importDoc = await PDFDocument.load(importBytes);

    await appendPdfPage(outputPdf, importDoc, entry.importPageIndex - 1, {
      heightPt: entry.heightPt,
      rotation: entry.rotation,
      widthPt: entry.widthPt,
    });
  }

  // Tear down any pdf.js workers we spun up for imported PDFs so the
  // SharedArrayBuffer + message-channel memory is freed immediately.
  Array.from(importedPdfjsCache.values()).forEach((proxy) => {
    void proxy.destroy();
  });

  return outputPdf.save();
}
