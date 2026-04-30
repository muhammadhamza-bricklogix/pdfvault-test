"use client";

import type { Document } from "@/lib/shared/types/documents.types";
import type { UploadStage } from "@/lib/shared/types/upload-progress.types";

import { uploadToastQueue, useUploadToastStore } from "./queue";

const SUCCESS_AUTO_DISMISS_MS = 6000;

export type StartUploadToastInput = {
  trackingId: string;
  filename: string;
  onOpen?: (documentId: string) => void;
  onRetry?: () => void;
  onCancel?: () => void;
  /** When `true`, opens the toast in `queued` state (waiting on concurrency). */
  queued?: boolean;
};

function add(trackingId: string): string {
  return uploadToastQueue.add({ trackingId }, { timeout: 0 });
}

export const uploadToasts = {
  start(input: StartUploadToastInput) {
    const initialStage: UploadStage = input.queued ? "queued" : "starting";
    const initialMessage = input.queued ? "Waiting…" : "Preparing upload…";

    useUploadToastStore.getState().upsert({
      trackingId: input.trackingId,
      filename: input.filename,
      status: input.queued ? "queued" : "uploading",
      progress: 0,
      stage: initialStage,
      message: initialMessage,
      onOpen: input.onOpen,
      onRetry: input.onRetry,
      onCancel: input.onCancel,
    });

    const key = add(input.trackingId);

    useUploadToastStore.getState().setToastKey(input.trackingId, key);
  },
  /** Move a queued toast to active state (still 0%). */
  beginActive(trackingId: string) {
    useUploadToastStore.getState().patch(trackingId, {
      status: "uploading",
      stage: "starting",
      message: "Preparing upload…",
    });
  },
  setProgress(
    trackingId: string,
    progress: number,
    stage?: UploadStage,
    message?: string,
  ) {
    const patch: Partial<{
      progress: number;
      stage: UploadStage;
      message: string;
    }> = { progress };

    if (stage) patch.stage = stage;
    if (message) patch.message = message;
    useUploadToastStore.getState().patch(trackingId, patch);
  },
  succeed(trackingId: string, doc: Document) {
    useUploadToastStore.getState().patch(trackingId, {
      status: "success",
      stage: "complete",
      progress: 100,
      message: "Upload complete",
      documentId: doc.id,
    });
    setTimeout(() => uploadToasts.close(trackingId), SUCCESS_AUTO_DISMISS_MS);
  },
  fail(trackingId: string, error: unknown) {
    const message = error instanceof Error ? error.message : "Upload failed";

    useUploadToastStore.getState().patch(trackingId, {
      status: "error",
      stage: "error",
      message,
      errorMessage: message,
    });
  },
  close(trackingId: string) {
    const { toastKeyById } = useUploadToastStore.getState();
    const key = toastKeyById[trackingId];

    if (key) uploadToastQueue.close(key);
    useUploadToastStore.getState().remove(trackingId);
  },
};
