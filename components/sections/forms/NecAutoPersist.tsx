"use client";

import { useEffect } from "react";

import { formsService } from "@/lib/shared/api/services/forms.service";
import { useFormEditorStore } from "@/lib/client/stores";
import { logger } from "@/lib/shared/utils/logger";

const STORAGE_KEY = "pv_nec_1099_pending";
const LOCAL_DEBOUNCE_MS = 400;
const DB_DEBOUNCE_MS = 1200;

export function savePendingNecState(values: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch {
    // Ignore storage quota errors
  }
}

export function readPendingNecState(): Record<string, string> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function NecAutoPersist() {
  useEffect(() => {
    let localTimeout: number | null = null;
    let dbTimeout: number | null = null;
    const snap = () => useFormEditorStore.getState().values;
    let latest = snap();

    const flushLocalNow = () => {
      if (localTimeout !== null) {
        window.clearTimeout(localTimeout);
        localTimeout = null;
      }
      savePendingNecState(latest);
    };

    const flushDbNow = () => {
      if (dbTimeout !== null) {
        window.clearTimeout(dbTimeout);
        dbTimeout = null;
      }
      const { sessionId } = useFormEditorStore.getState();

      if (!sessionId) return;
      formsService
        .patchFormSession(sessionId, latest)
        .catch((err: unknown) => {
          logger.captureError(err, "nec.auto_persist_patch", { sessionId });
        });
    };

    const flushLocalDebounced = () => {
      localTimeout = null;
      savePendingNecState(latest);
    };

    const flushDbDebounced = () => {
      dbTimeout = null;
      const { sessionId } = useFormEditorStore.getState();

      if (!sessionId) return;
      formsService
        .patchFormSession(sessionId, latest)
        .catch((err: unknown) => {
          logger.captureError(err, "nec.auto_persist_patch", { sessionId });
        });
    };

    const unsub = useFormEditorStore.subscribe((state, prev) => {
      if (state.values === prev.values) return;
      latest = snap();

      if (localTimeout === null) {
        localTimeout = window.setTimeout(
          flushLocalDebounced,
          LOCAL_DEBOUNCE_MS,
        );
      }
      if (dbTimeout === null) {
        dbTimeout = window.setTimeout(flushDbDebounced, DB_DEBOUNCE_MS);
      }
    });

    const onPageHide = () => {
      latest = snap();
      savePendingNecState(latest);
    };

    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onPageHide);

    return () => {
      unsub();
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onPageHide);
      latest = snap();
      flushLocalNow();
      flushDbNow();
    };
  }, []);

  return null;
}
