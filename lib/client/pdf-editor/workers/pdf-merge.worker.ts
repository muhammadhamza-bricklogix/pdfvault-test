/**
 * Web Worker for the PDF merge pipeline.
 *
 * Offloads the CPU-heavy pdf-lib draw/save work from the main thread. The
 * worker does NOT have access to the live pdf.js document proxy, so it cannot
 * render background-image pages — callers must either pre-render those or fall
 * back to main-thread merge when a background image is enabled.
 */

import type {
  BackgroundImageConfig,
  WatermarkConfig,
} from "@/lib/client/stores/pdf-editor-store";
import type { FontData } from "@/lib/client/pdf-editor/text-extraction";

import { mergeFabricEditsIntoPdf } from "@/lib/client/pdf-editor/merge-pdf";

type BuildMessage = {
  type: "BUILD";
  id: number;
  backgroundImageConfig: BackgroundImageConfig | null;
  fabricJsonByPage: [number, string][];
  fontDataMap: [string, FontData][];
  pageOrder: number[];
  rasterScale?: number;
  sourceBytes: ArrayBuffer;
  watermarkConfig: WatermarkConfig | null;
};

type WorkerResponse =
  | { error: string; id: number; ok: false }
  | { bytes: Uint8Array; id: number; ok: true };

async function handleBuild(
  payload: Omit<BuildMessage, "type" | "id">,
): Promise<Uint8Array> {
  return mergeFabricEditsIntoPdf({
    backgroundImageConfig: payload.backgroundImageConfig,
    fabricJsonByPage: new Map(payload.fabricJsonByPage),
    fontDataMap: new Map(payload.fontDataMap),
    pageOrder: payload.pageOrder,
    rasterScale: payload.rasterScale,
    sourceBytes: payload.sourceBytes,
    watermarkConfig: payload.watermarkConfig,
  });
}

self.onmessage = async (event: MessageEvent<BuildMessage>) => {
  const message = event.data;

  if (message.type !== "BUILD") return;

  const {
    id,
    backgroundImageConfig,
    fabricJsonByPage,
    fontDataMap,
    pageOrder,
    rasterScale,
    sourceBytes,
    watermarkConfig,
  } = message;

  try {
    const bytes = await handleBuild({
      backgroundImageConfig,
      fabricJsonByPage,
      fontDataMap,
      pageOrder,
      rasterScale,
      sourceBytes,
      watermarkConfig,
    });

    (self as unknown as Worker).postMessage(
      { id, ok: true, bytes } as WorkerResponse,
      [bytes.buffer],
    );
  } catch (err) {
    (self as unknown as Worker).postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    } as WorkerResponse);
  }
};

export {};
