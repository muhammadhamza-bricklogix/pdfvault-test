/**
 * Triggers a browser download for an in-memory Blob. Used by the conversion
 * pipeline after a successful `POST /conversion` returns the converted file
 * as an octet-stream.
 */
export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Defer revoke so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Parses a filename out of an HTTP `Content-Disposition` header.
 * Handles the common quoted form (`filename="name.ext"`) and the unquoted
 * fallback (`filename=name.ext`), plus the RFC 5987 encoded form
 * (`filename*=UTF-8''name.ext`). Returns null if no name is present.
 */
export function parseContentDispositionFilename(
  header: string | null | undefined,
): string | null {
  if (!header) return null;

  const star = /filename\*\s*=\s*([^']*)''([^;]+)/i.exec(header);

  if (star) {
    try {
      return decodeURIComponent(star[2]!.trim());
    } catch {
      // fall through to the plain `filename=` lookup
    }
  }

  const plain = /filename\s*=\s*(?:"([^"]+)"|([^;]+))/i.exec(header);

  if (!plain) return null;

  return (plain[1] ?? plain[2] ?? "").trim() || null;
}
