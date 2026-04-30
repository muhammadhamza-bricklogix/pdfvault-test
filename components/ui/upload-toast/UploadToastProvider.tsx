"use client";
import { useEffect } from "react";
import { Toast } from "@heroui/react";

import { useUploadToastStore } from "@/lib/client/stores/upload-toasts-store";
import { uploadToasts } from "@/lib/client/upload-toasts/controller";
import { uploadToastQueue } from "@/lib/client/upload-toasts/queue";

import { UploadToastRenderer } from "./UploadToastRenderer";

type UploadToastPreviewApi = {
  close: () => void;
  error: () => void;
  queued: () => void;
  success: () => void;
  uploading: (progress?: number, message?: string) => void;
};

type UploadToastPreviewWindow = Window & {
  uploadToastPreview?: UploadToastPreviewApi;
};

/**
 * Mounts a dedicated `Toast.Provider` for upload progress toasts (separate
 * from the global toast region). Pinned bottom-right and rendered via a
 * custom layout (illustration + filename + progress + actions).
 */
export function UploadToastProvider() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const previewWindow = window as UploadToastPreviewWindow;
    const trackingId = "upload-toast-preview";
    const filename = "Meridian_Profits_App_PRD.pdf";

    const openBaseToast = (queued = false) => {
      uploadToasts.close(trackingId);
      uploadToasts.start({ filename, queued, trackingId });
    };

    previewWindow.uploadToastPreview = {
      close: () => {
        uploadToasts.close(trackingId);
      },
      error: () => {
        openBaseToast();
        useUploadToastStore.getState().patch(trackingId, {
          errorMessage:
            "Could not reach the server. Check your connection and try again.",
          message:
            "Could not reach the server. Check your connection and try again.",
          progress: 100,
          stage: "error",
          status: "error",
        });
      },
      queued: () => {
        openBaseToast(true);
      },
      success: () => {
        openBaseToast();
        useUploadToastStore.getState().patch(trackingId, {
          documentId: "preview-document-id",
          message: "Upload complete",
          progress: 100,
          stage: "complete",
          status: "success",
        });
      },
      uploading: (progress = 42, message = "Uploading to cloud") => {
        openBaseToast();
        useUploadToastStore.getState().patch(trackingId, {
          message,
          progress,
          stage: "uploading_s3",
          status: "uploading",
        });
      },
    };

    return () => {
      delete previewWindow.uploadToastPreview;
      uploadToasts.close(trackingId);
    };
  }, []);

  return (
    <Toast.Provider placement="bottom end" queue={uploadToastQueue}>
      {({ toast }) => <UploadToastRenderer toast={toast} />}
    </Toast.Provider>
  );
}
