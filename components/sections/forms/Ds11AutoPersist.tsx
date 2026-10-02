"use client";

import { useEffect } from "react";

import { formsService } from "@/lib/shared/api/services/forms.service";
import { useFormEditorStore } from "@/lib/client/stores";
import { logger } from "@/lib/shared/utils/logger";

const DRAFT_PREFIX = "pv_ds11_draft:";
const ACTIVE_KEY = "pv_ds11_active";
const LOCAL_DEBOUNCE_MS = 400;
const DB_DEBOUNCE_MS = 1200;

let activeInstanceId: string | null = null;

function newInstanceId(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

  return `new:${rand}`;
}

function draftKey(instanceId: string): string {
  return `${DRAFT_PREFIX}${instanceId}`;
}

export function getDs11InstanceId(): string | null {
  return activeInstanceId;
}

function readActiveKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

/** The library row this draft is already bound to, if it has one. */
export function getDs11BoundDocumentId(): string | null {
  const id = activeInstanceId ?? readActiveKey();

  return id && id.startsWith("doc:") ? id.slice(4) : null;
}

export function readDs11Draft(
  instanceId: string | null,
): Record<string, string> | null {
  if (typeof window === "undefined" || !instanceId) return null;
  try {
    const raw = localStorage.getItem(draftKey(instanceId));

    return raw ? (JSON.parse(raw) as Record<string, string>) : null;
  } catch {
    return null;
  }
}

export function writeDs11Draft(
  instanceId: string | null,
  values: Record<string, string>,
) {
  if (typeof window === "undefined" || !instanceId) return;
  try {
    localStorage.setItem(draftKey(instanceId), JSON.stringify(values));
    localStorage.setItem(ACTIVE_KEY, instanceId);
  } catch {
    // Ignore storage quota / access errors
  }
}

export function clearDs11Draft(instanceId: string | null) {
  if (typeof window === "undefined" || !instanceId) return;
  try {
    localStorage.removeItem(draftKey(instanceId));
    if (localStorage.getItem(ACTIVE_KEY) === instanceId) {
      localStorage.removeItem(ACTIVE_KEY);
    }
  } catch {
    // Ignore storage access errors
  }
}

/**
 * Wipes every DS-11 draft. Used on sign-out: these drafts hold Social Security
 * numbers, dates of birth and parents' details, so they must not outlive the
 * session on a shared machine.
 */
export function clearAllDs11Drafts() {
  if (typeof window === "undefined") return;
  try {
    const doomed: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);

      if (k && (k.startsWith(DRAFT_PREFIX) || k === ACTIVE_KEY)) doomed.push(k);
    }
    doomed.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Ignore storage access errors
  }
  activeInstanceId = null;
}

export function beginDs11Draft(opts: {
  resumeDocId?: string | null;
  forceNew?: boolean;
}): string {
  if (opts.resumeDocId) {
    activeInstanceId = `doc:${opts.resumeDocId}`;
  } else if (opts.forceNew) {
    activeInstanceId = newInstanceId();
  } else {
    let existing: string | null = null;

    try {
      existing = localStorage.getItem(ACTIVE_KEY);
    } catch {
      existing = null;
    }
    activeInstanceId = existing ?? newInstanceId();
  }

  try {
    localStorage.setItem(ACTIVE_KEY, activeInstanceId);
  } catch {
    // Ignore storage access errors
  }

  return activeInstanceId;
}

export function bindDs11DraftToDocument(documentId: string) {
  const previous = activeInstanceId;
  const next = `doc:${documentId}`;

  if (previous === next) return;

  const carried = readDs11Draft(previous);

  activeInstanceId = next;
  if (carried) writeDs11Draft(next, carried);
  if (previous) clearDs11Draft(previous);

  try {
    localStorage.setItem(ACTIVE_KEY, next);
  } catch {
    // Ignore storage access errors
  }
}

// Only the server mirror retires on finalize; the local draft keeps updating.
let ds11SessionFinalized = false;

export function markDs11SessionFinalized() {
  ds11SessionFinalized = true;
}

export function resetDs11SessionFinalized() {
  ds11SessionFinalized = false;
}

export function Ds11AutoPersist() {
  useEffect(() => {
    let localTimeout: number | null = null;
    let dbTimeout: number | null = null;
    const snap = () => useFormEditorStore.getState().values;
    let latest = snap();

    const writeLocal = () => writeDs11Draft(activeInstanceId, latest);

    const flushLocalNow = () => {
      if (localTimeout !== null) {
        window.clearTimeout(localTimeout);
        localTimeout = null;
      }
      writeLocal();
    };

    const patchDb = () => {
      const { sessionId } = useFormEditorStore.getState();

      if (!sessionId || ds11SessionFinalized) return;
      formsService.patchFormSession(sessionId, latest).catch((err: unknown) => {
        logger.captureError(err, "ds-11.auto_persist_patch", { sessionId });
      });
    };

    const flushDbNow = () => {
      if (dbTimeout !== null) {
        window.clearTimeout(dbTimeout);
        dbTimeout = null;
      }
      patchDb();
    };

    const flushLocalDebounced = () => {
      localTimeout = null;
      writeLocal();
    };

    const flushDbDebounced = () => {
      dbTimeout = null;
      patchDb();
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
      writeLocal();
    };

    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onPageHide);

    return () => {
      unsub();
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onPageHide);

      // Do not re-read the store here: the parent's cleanup resets it
      // first, so `latest` from the subscription is the last real value.
      const hasValues = Object.values(latest).some(
        (v) => typeof v === "string" && v.trim() !== "",
      );

      if (!hasValues) {
        if (localTimeout !== null) window.clearTimeout(localTimeout);
        if (dbTimeout !== null) window.clearTimeout(dbTimeout);

        return;
      }

      flushLocalNow();
      flushDbNow();
    };
  }, []);

  return null;
}
