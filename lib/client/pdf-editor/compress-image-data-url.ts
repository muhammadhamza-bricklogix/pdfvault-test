/**
 * Downscale + re-encode a user-uploaded image file so its data URL fits inside
 * the editorState soft cap (~800 KB serialized). Without this, a 3 MB PNG
 * watermark or background image blows past the cap → `buildEditorStateJson`
 * silently trims `imageData` from the payload → cloud PDF has NO watermark
 * baked (Save uses `bakeOverlays: false`) → on reload the live preview can't
 * render either → user sees "my watermark / background image is gone."
 *
 * Strategy:
 *   1. Decode the file into an HTMLImageElement.
 *   2. Draw to an offscreen canvas at a size capped by `maxDim` on the
 *      longest edge (preserves aspect ratio).
 *   3. Re-encode as JPEG at `quality`. PNG sources with alpha use PNG so
 *      transparency (common for watermarks) survives.
 *   4. Return the compact data URL.
 *
 * Tuned defaults: 1600 px + JPEG 0.85 → typically <400 KB for photos even
 * when the source is 5 MB. Watermarks with alpha stay as PNG at 1200 px,
 * which usually settles under 500 KB. Both leave headroom under the
 * editorState cap.
 */
export type CompressImageOptions = {
  maxDim?: number;
  jpegQuality?: number;
  /** Force output format regardless of source. */
  forceFormat?: "image/jpeg" | "image/png";
};

const DEFAULT_MAX_DIM = 1600;
const DEFAULT_JPEG_QUALITY = 0.85;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err instanceof Event ? new Error("Failed to decode image") : err);
    };
    img.src = url;
  });
}

/**
 * Sniff the file's mime type. PNG sources are kept as PNG so alpha survives;
 * everything else becomes JPEG. `forceFormat` overrides.
 */
function pickOutputFormat(
  file: File,
  forceFormat?: CompressImageOptions["forceFormat"],
): "image/jpeg" | "image/png" {
  if (forceFormat) return forceFormat;
  const type = file.type.toLowerCase();

  if (type === "image/png") return "image/png";

  return "image/jpeg";
}

export async function compressImageDataUrl(
  file: File,
  options: CompressImageOptions = {},
): Promise<string> {
  const {
    maxDim = DEFAULT_MAX_DIM,
    jpegQuality = DEFAULT_JPEG_QUALITY,
    forceFormat,
  } = options;

  const img = await loadImage(file);

  const sourceW = img.naturalWidth || img.width;
  const sourceH = img.naturalHeight || img.height;

  if (!sourceW || !sourceH) {
    throw new Error("Image has zero dimensions");
  }

  const scale = Math.min(1, maxDim / Math.max(sourceW, sourceH));
  const targetW = Math.max(1, Math.round(sourceW * scale));
  const targetH = Math.max(1, Math.round(sourceH * scale));

  const canvas = document.createElement("canvas");

  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("Could not get 2D canvas context");

  ctx.drawImage(img, 0, 0, targetW, targetH);
  const format = pickOutputFormat(file, forceFormat);
  const quality = format === "image/jpeg" ? jpegQuality : undefined;

  return canvas.toDataURL(format, quality);
}
