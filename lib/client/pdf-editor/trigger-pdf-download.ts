/**
 * Browser-only helpers for downloading merged PDF bytes.
 * Uses the Uint8Array as a BlobPart so views on larger buffers are not padded.
 */
export function editedPdfFilename(originalName: string): string {
  const dot = originalName.lastIndexOf(".");
  const base = dot > 0 ? originalName.slice(0, dot) : originalName;

  return `${base} (edited).pdf`;
}

export function triggerPdfDownload(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Let the download start before revoking (some browsers cancel if revoked too early).
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
