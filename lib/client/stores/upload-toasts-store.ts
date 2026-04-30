"use client";

import type { UploadStage } from "@/lib/shared/types/upload-progress.types";

import { create } from "zustand";

export type UploadToastStatus = "uploading" | "success" | "error" | "queued";

export type UploadToastState = {
  trackingId: string;
  filename: string;
  status: UploadToastStatus;
  /** 0-100 */
  progress: number;
  stage: UploadStage;
  message: string;
  errorMessage?: string;
  documentId?: string;
  onOpen?: (documentId: string) => void;
  onRetry?: () => void;
  onCancel?: () => void;
};

type Store = {
  byId: Record<string, UploadToastState>;
  /** trackingId → toast queue key (so we can close the toast). */
  toastKeyById: Record<string, string>;
  upsert: (state: UploadToastState) => void;
  patch: (trackingId: string, patch: Partial<UploadToastState>) => void;
  setToastKey: (trackingId: string, key: string) => void;
  remove: (trackingId: string) => void;
};

export const useUploadToastStore = create<Store>((set) => ({
  byId: {},
  toastKeyById: {},
  upsert: (state) =>
    set((s) => ({
      byId: { ...s.byId, [state.trackingId]: state },
    })),
  patch: (trackingId, patch) =>
    set((s) => {
      const existing = s.byId[trackingId];

      if (!existing) return s;

      return {
        byId: { ...s.byId, [trackingId]: { ...existing, ...patch } },
      };
    }),
  setToastKey: (trackingId, key) =>
    set((s) => ({ toastKeyById: { ...s.toastKeyById, [trackingId]: key } })),
  remove: (trackingId) =>
    set((s) => {
      const { [trackingId]: _omit, ...byId } = s.byId;
      const { [trackingId]: _omitKey, ...toastKeyById } = s.toastKeyById;

      void _omit;
      void _omitKey;

      return { byId, toastKeyById };
    }),
}));
