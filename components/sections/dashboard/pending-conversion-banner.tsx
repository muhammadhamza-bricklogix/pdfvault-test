"use client";

import { useState } from "react";

import { CONVERT_ROUTES } from "@/lib/shared/constants/convert-routes";

const STORAGE_KEY = "pdfvault:pendingUpload";

interface PendingUpload {
  fileName: string;
  fileSize: number;
  context: string | null;
  ts: number;
}

/**
 * Reads the sessionStorage handoff written by the /convert/[slug] upload
 * workspace when a signed-out user hits "Convert now". Surfacing it here
 * closes the loop after sign-in — the user sees "Continue converting X.pdf"
 * instead of a cold dashboard, so the file they were about to convert isn't
 * forgotten. Clears the marker on dismiss (or after 30 minutes).
 */
function readPending(): PendingUpload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);

    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingUpload;

    if (Date.now() - parsed.ts > 30 * 60 * 1000) {
      window.sessionStorage.removeItem(STORAGE_KEY);

      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function PendingConversionBanner() {
  const [pending, setPending] = useState<PendingUpload | null>(readPending);

  if (!pending) return null;

  const slug = pending.context?.startsWith("convert:")
    ? pending.context.slice("convert:".length)
    : null;
  const route = slug ? CONVERT_ROUTES[slug] : null;
  const title = route?.title ?? "Continue your conversion";

  const dismiss = () => {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setPending(null);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[color-mix(in_oklab,var(--color-accent)_35%,transparent)] bg-[color-mix(in_oklab,var(--color-accent)_8%,var(--color-background))] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--color-foreground)]">
          {title}
        </p>
        <p className="mt-0.5 truncate text-xs text-default-500">
          Signed in — re-upload{" "}
          <span className="font-medium text-[var(--color-foreground)]">
            {pending.fileName}
          </span>{" "}
          below to finish.
        </p>
      </div>
      <button
        className="self-start text-xs font-medium text-default-500 underline underline-offset-2 hover:text-[var(--color-foreground)] sm:self-auto"
        type="button"
        onClick={dismiss}
      >
        Dismiss
      </button>
    </div>
  );
}
