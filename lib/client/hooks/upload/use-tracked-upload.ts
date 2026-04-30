"use client";

import type {
  UploadProgressEnvelope,
  UploadProgressEvent,
} from "@/lib/shared/types/upload-progress.types";
import type { AxiosProgressEvent } from "axios";

import { useCallback, useEffect, useRef } from "react";

import { useUploadDocumentMutation } from "@/lib/client/query/mutations/documents.mutation";
import { fetchEventSource } from "@/lib/client/sse/fetch-event-source";
import { uploadToasts } from "@/lib/client/upload-toasts/controller";
import { DOCUMENTS } from "@/lib/shared/constants/endpoints";
import { logger } from "@/lib/shared/utils/logger";

const MAX_CONCURRENT = 3;
/** Axios upload progress (browser → backend) drives 0–10% of the bar. */
const UPLOAD_PHASE_CEILING = 10;

type Job = {
  trackingId: string;
  run: () => Promise<void>;
};

type ActiveJob = {
  trackingId: string;
  abort: AbortController;
};

const queue: Job[] = [];
const active = new Map<string, ActiveJob>();

function pumpQueue() {
  while (active.size < MAX_CONCURRENT && queue.length > 0) {
    const next = queue.shift();

    if (!next) break;
    uploadToasts.beginActive(next.trackingId);
    void next.run();
  }
}

export type StartUploadInput = {
  file: File;
  /** Used when re-uploading bytes for an existing document (upsert). */
  documentId?: string;
  onOpen?: (documentId: string) => void;
};

export type StartUploadResult = {
  trackingId: string;
};

export function useTrackedUpload() {
  const mutation = useUploadDocumentMutation();
  const mutateAsyncRef = useRef(mutation.mutateAsync);
  const startRef = useRef<
    ((input: StartUploadInput) => StartUploadResult) | null
  >(null);

  useEffect(() => {
    mutateAsyncRef.current = mutation.mutateAsync;
  }, [mutation.mutateAsync]);

  const start = useCallback((input: StartUploadInput): StartUploadResult => {
    const trackingId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const abort = new AbortController();
    const isQueued = active.size >= MAX_CONCURRENT;

    uploadToasts.start({
      filename: input.file.name,
      onCancel: () => {
        abort.abort();
        uploadToasts.close(trackingId);
      },
      onOpen: input.onOpen,
      onRetry: () => {
        uploadToasts.close(trackingId);
        startRef.current?.(input);
      },
      queued: isQueued,
      trackingId,
    });

    const run = async (): Promise<void> => {
      active.set(trackingId, { abort, trackingId });

      // Open SSE before POSTing so early events aren't missed.
      const ssePromise = fetchEventSource<UploadProgressEnvelope>({
        onClose: () => undefined,
        onError: (err) => {
          logger.error("Upload SSE error", err);
        },
        onEvent: (envelope) => {
          const event: UploadProgressEvent | undefined = envelope?.data;

          if (!event) return;
          const merged = Math.max(UPLOAD_PHASE_CEILING, event.progress);

          uploadToasts.setProgress(
            trackingId,
            merged,
            event.stage,
            event.message,
          );
        },
        signal: abort.signal,
        url: DOCUMENTS.UPLOAD_PROGRESS(trackingId),
      });

      try {
        const doc = await mutateAsyncRef.current({
          documentId: input.documentId,
          file: input.file,
          options: {
            onUploadProgress: (e: AxiosProgressEvent) => {
              if (!e.total) return;
              const fraction = e.loaded / e.total;
              const bytesProgress = Math.min(
                UPLOAD_PHASE_CEILING,
                Math.round(fraction * UPLOAD_PHASE_CEILING),
              );

              uploadToasts.setProgress(trackingId, bytesProgress);
            },
            signal: abort.signal,
          },
          trackingId,
        });

        uploadToasts.succeed(trackingId, doc);
      } catch (err) {
        if (abort.signal.aborted) return;
        uploadToasts.fail(trackingId, err);
      } finally {
        abort.abort();
        await ssePromise.catch(() => undefined);
        active.delete(trackingId);
        pumpQueue();
      }
    };

    if (isQueued) {
      queue.push({ run, trackingId });
    } else {
      void run();
    }

    return { trackingId };
  }, []);

  // Sync ref so onRetry can call the latest `start` without TDZ.
  useEffect(() => {
    startRef.current = start;
  }, [start]);

  return { start };
}

export type UseTrackedUpload = ReturnType<typeof useTrackedUpload>;
