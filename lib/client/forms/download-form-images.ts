import { renderPdfPagesToImages } from "@/lib/client/forms/render-pdf-pages-to-images";
import { conversionService } from "@/lib/shared/api/services/conversion.service";

export type FormImageFormat = "png" | "jpg";

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function baseNameFor(userFilename: string | undefined, fallback: string) {
  return (userFilename?.trim() || fallback).replace(/\.[^./\\]+$/, "");
}

async function zipImagesAndDownload(
  entries: { name: string; blob: Blob }[],
  baseName: string,
) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  entries.forEach((entry) => zip.file(entry.name, entry.blob));

  triggerBlobDownload(
    await zip.generateAsync({ type: "blob" }),
    `${baseName}.zip`,
  );
}

async function looksLikeZipArchive(blob: Blob): Promise<boolean> {
  const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());

  return (
    head[0] === 0x50 &&
    head[1] === 0x4b &&
    (head[2] === 0x03 || head[2] === 0x05 || head[2] === 0x07) &&
    (head[3] === 0x04 || head[3] === 0x06 || head[3] === 0x08)
  );
}

async function downloadPagesAsZipClientSide(
  pdfBytes: Uint8Array,
  format: FormImageFormat,
  baseName: string,
) {
  const images = await renderPdfPagesToImages(pdfBytes, format);

  if (images.length === 0) {
    throw new Error("No pages could be rendered from the stamped form.");
  }

  await zipImagesAndDownload(
    images.map((img) => ({
      name:
        images.length === 1
          ? `${baseName}.${format}`
          : `${baseName}-page-${img.page}.${format}`,
      blob: img.blob,
    })),
    baseName,
  );
}

async function deliverConversionResult(
  blob: Blob,
  responseFileName: string,
  format: FormImageFormat,
  baseName: string,
  onFallback: () => Promise<void>,
) {
  const mimeGuess = blob.type ?? "";

  if (/zip/i.test(mimeGuess) || /\.zip$/i.test(responseFileName ?? "")) {
    triggerBlobDownload(blob, `${baseName}.zip`);

    return;
  }

  if (mimeGuess.startsWith("image/")) {
    await zipImagesAndDownload(
      [{ name: `${baseName}.${format}`, blob }],
      baseName,
    );

    return;
  }

  if (await looksLikeZipArchive(blob)) {
    triggerBlobDownload(blob, `${baseName}.zip`);

    return;
  }

  await onFallback();
}

export async function downloadStampedFormAsImages({
  stampedPdfUrl,
  format,
  userFilename,
  fallbackBaseName,
}: {
  stampedPdfUrl: string;
  format: FormImageFormat;
  userFilename?: string;
  fallbackBaseName: string;
}): Promise<void> {
  const res = await fetch(stampedPdfUrl);

  if (!res.ok) {
    throw new Error(`Couldn't fetch the stamped form (HTTP ${res.status}).`);
  }

  const pdfBytes = new Uint8Array(await res.arrayBuffer());
  const pdfFile = new File([pdfBytes], `${fallbackBaseName}.pdf`, {
    type: "application/pdf",
  });
  const baseName = baseNameFor(userFilename, fallbackBaseName);

  const result = await conversionService.convert({
    file: pdfFile,
    type: format === "png" ? "pdf_to_png" : "pdf_to_jpg",
  });

  await deliverConversionResult(
    result.blob,
    result.fileName,
    format,
    baseName,
    () => downloadPagesAsZipClientSide(pdfBytes, format, baseName),
  );
}
