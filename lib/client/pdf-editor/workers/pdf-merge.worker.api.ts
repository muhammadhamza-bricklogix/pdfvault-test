"use client";

import type {
  BackgroundImageConfig,
  WatermarkConfig,
} from "@/lib/client/stores/pdf-editor-store";
import type { FontData } from "@/lib/client/pdf-editor/text-extraction";

type MergeWorkerInput = {
  backgroundImageConfig: BackgroundImageConfig | null;
  fabricJsonByPage: Map<number, string>;
  fontDataMap: Map<string, FontData>;
  pageOrder: number[];
  rasterScale?: number;
  sourceBytes: ArrayBuffer;
  watermarkConfig: WatermarkConfig | null;
};

let workerInstance: Worker | null = null;
let requestId = 0;
const pending = new Map<
  number,
  { reject: (reason?: unknown) => void; resolve: (bytes: Uint8Array) => void }
>();

function getWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;

  if (!workerInstance) {
    try {
      workerInstance = new Worker(
        new URL("./pdf-merge.worker.ts", import.meta.url),
      );
      workerInstance.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const response = event.data;
        const request = pending.get(response.id);

        if (!request) return;

        pending.delete(response.id);

        if (response.ok) {
          request.resolve(response.bytes);
        } else {
          request.reject(new Error(response.error));
        }
      };
      workerInstance.onerror = (err) => {
        // Errors without an id are unrecoverable; clear pending so callers
        // fall back instead of hanging. Reset the instance so the next call
        // can attempt to spin up a fresh worker.
        pending.forEach((req) =>
          req.reject(new Error(err.message || "Worker error")),
        );
        pending.clear();
        workerInstance = null;
      };
    } catch {
      return null;
    }
  }

  return workerInstance;
}

type WorkerResponse =
  | { error: string; id: number; ok: false }
  | { bytes: Uint8Array; id: number; ok: true };

/**
 * Runs the pdf-lib merge pipeline in a Web Worker.
 *
 * Falls back to a main-thread error if the worker cannot be created. The
 * caller is responsible for deciding whether to retry on the main thread
 * (e.g. when background-image rendering is required).
 */
export async function mergeInWorker(
  input: MergeWorkerInput,
): Promise<Uint8Array> {
  const worker = getWorker();

  if (!worker) {
    throw new Error("Web Workers not available in this environment");
  }

  const id = ++requestId;

  return new Promise<Uint8Array>((resolve, reject) => {
    pending.set(id, { resolve, reject });

    worker.postMessage(
      {
        type: "BUILD",
        id,
        backgroundImageConfig: input.backgroundImageConfig,
        fabricJsonByPage: Array.from(input.fabricJsonByPage.entries()),
        fontDataMap: Array.from(input.fontDataMap.entries()),
        pageOrder: input.pageOrder,
        rasterScale: input.rasterScale,
        sourceBytes: input.sourceBytes,
        watermarkConfig: input.watermarkConfig,
      },
      [input.sourceBytes],
    );
  });
}
