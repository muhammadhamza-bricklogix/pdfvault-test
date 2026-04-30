"use client";

import type { UploadProgressEvent } from "@/lib/shared/types/upload-progress.types";

import { ToastQueue } from "@heroui/react";

import { useUploadToastStore } from "@/lib/client/stores/upload-toasts-store";

export { useUploadToastStore } from "@/lib/client/stores/upload-toasts-store";
export type {
  UploadToastState,
  UploadToastStatus,
} from "@/lib/client/stores/upload-toasts-store";

/** HeroUI ToastQueue holds only the tracking id; the renderer subscribes to
 * the zustand store for live updates. */
export type UploadToastContent = {
  trackingId: string;
};

export const uploadToastQueue = new ToastQueue<UploadToastContent>({
  maxVisibleToasts: 5,
});

export function applyProgressEvent(
  trackingId: string,
  event: UploadProgressEvent,
) {
  useUploadToastStore.getState().patch(trackingId, {
    stage: event.stage,
    progress: event.progress,
    message: event.message,
  });
}
