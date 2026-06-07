/**
 * Verifies an uploaded file's *actual* image format by reading the first
 * bytes, rather than trusting `file.type` (which is set from the file
 * extension at picker time and can be spoofed by a rename).
 *
 * Why this matters: when the user uploads a watermark or background image,
 * the editor passes the data URL to `FabricImage.fromURL`. Fabric renders
 * SVG content via the browser's native SVG pipeline — which, on Safari,
 * still executes `<script>` tags inside the SVG. Letting `payload.svg`
 * masquerade as `safe.png` is therefore a real XSS hole. The audit note
 * flagged this on 2026-05-22 ("HIGH: Image MIME validation uses file.type
 * only — read magic bytes").
 *
 * Returns the detected kind, or `null` if the bytes don't match a
 * supported raster format. Callers reject on `null`.
 */
export type DetectedImageKind = "png" | "jpeg";

// PNG signature: 89 50 4E 47 0D 0A 1A 0A
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// JPEG SOI: FF D8 FF — last byte varies (E0 for JFIF, E1 for EXIF, etc.).
const JPEG_SIG = [0xff, 0xd8, 0xff];

export async function detectImageMagicBytes(
  file: File,
): Promise<DetectedImageKind | null> {
  const head = await file.slice(0, 8).arrayBuffer();
  const bytes = new Uint8Array(head);

  if (matches(bytes, PNG_SIG)) return "png";
  if (matches(bytes, JPEG_SIG)) return "jpeg";

  return null;
}

function matches(bytes: Uint8Array, sig: number[]): boolean {
  if (bytes.length < sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (bytes[i] !== sig[i]) return false;
  }

  return true;
}
