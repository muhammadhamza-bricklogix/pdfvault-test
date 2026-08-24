"use client";

import { create } from "zustand";

export type PendingConversionStatus = "converting" | "uploading" | "error";

export interface PendingConversion {
  tempId: string;
  file: File;
  filename: string;
  sizeBytes: number;
  status: PendingConversionStatus;
  errorMessage?: string;
  startedAt: number;
}

interface PendingConversionsState {
  items: PendingConversion[];
  add: (item: Omit<PendingConversion, "status" | "startedAt">) => void;
  setStatus: (
    tempId: string,
    status: PendingConversionStatus,
    errorMessage?: string,
  ) => void;
  remove: (tempId: string) => void;
}

export const usePendingConversionsStore = create<PendingConversionsState>(
  (set) => ({
    items: [],
    add: (item) =>
      set((s) => ({
        items: [
          ...s.items,
          { ...item, status: "converting", startedAt: Date.now() },
        ],
      })),
    setStatus: (tempId, status, errorMessage) =>
      set((s) => ({
        items: s.items.map((i) =>
          i.tempId === tempId ? { ...i, status, errorMessage } : i,
        ),
      })),
    remove: (tempId) =>
      set((s) => ({ items: s.items.filter((i) => i.tempId !== tempId) })),
  }),
);
