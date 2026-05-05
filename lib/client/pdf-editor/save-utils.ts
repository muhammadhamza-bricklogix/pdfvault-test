import type { Canvas as FabricCanvas } from "fabric";

export type ParsedFabricJson = {
  height: number;
  objects?: unknown[];
  width: number;
  [key: string]: unknown;
};

/**
 * Serializes a Fabric canvas to a JSON string and embeds the canvas dimensions
 * (which `Canvas.toJSON()` does NOT include in v7). Without this, the saved
 * payload has no width/height and cannot be re-rendered offscreen later.
 */
export function serializeFabricCanvas(canvas: FabricCanvas): string {
  return JSON.stringify({
    ...canvas.toJSON(),
    height: canvas.getHeight(),
    width: canvas.getWidth(),
  });
}

export function parseFabricJson(json: string): ParsedFabricJson | null {
  const parsed = JSON.parse(json) as ParsedFabricJson;

  if (!parsed.objects?.length) return null;
  if (!parsed.width || !parsed.height) return null;

  return parsed;
}

/**
 * Renders a Fabric JSON snapshot to a PNG data URL via a temporary offscreen
 * canvas. The width/height in the JSON match the live editor canvas at the
 * time the snapshot was taken, so object coordinates are valid as-is.
 */
export async function renderFabricJsonToPng(
  parsed: ParsedFabricJson,
): Promise<string> {
  const { Canvas } = await import("fabric");

  const el = document.createElement("canvas");

  el.width = Math.round(parsed.width);
  el.height = Math.round(parsed.height);
  el.style.position = "fixed";
  el.style.left = "-9999px";
  el.style.top = "-9999px";
  document.body.appendChild(el);

  const fc = new Canvas(el, {
    backgroundColor: "transparent",
    enableRetinaScaling: false,
    height: el.height,
    width: el.width,
  });

  try {
    await fc.loadFromJSON(parsed);
    fc.renderAll();

    return fc.toDataURL({ format: "png", multiplier: 1 });
  } finally {
    fc.dispose();

    if (document.body.contains(el)) {
      document.body.removeChild(el);
    }
  }
}

/** Decodes a `data:image/png;base64,...` URL into raw PNG bytes. */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1];

  if (!base64) {
    throw new Error("Invalid data URL: missing base64 payload");
  }

  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);

  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  return bytes;
}
