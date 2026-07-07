"use client";

import { useEffect, useRef, useState } from "react";

import { useUploadCloudDocumentMutation } from "@/lib/client/query/mutations";
import { CONVERT_ROUTES } from "@/lib/shared/constants/convert-routes";
import { toast } from "@/lib/shared/utils/toast";

const STORAGE_KEY = "pdfvault:pendingUpload";
const MAX_AGE_MS = 30 * 60 * 1000;

interface PendingUpload {
  fileName: string;
  fileSize?: number;
  context: string | null;
  ts: number;
  // Set only when the handoff comes from the Google Drive picker on landing.
  provider?: "gdrive" | "onedrive";
  fileId?: string;
  mimeType?: string;
  accessToken?: string;
}

/**
 * Reads the sessionStorage handoff written by the landing upload workspace.
 * Two shapes:
 *   1. `context: "convert:<slug>"` — user picked a local file on
 *      /convert/<slug> and clicked "Convert now". Shows a "Continue your
 *      conversion — re-upload X.pdf" nudge. Local File blob doesn't cross
 *      route boundaries, so the user re-picks.
 *   2. `context: "gdrive"` — user picked a file through the Google Picker on
 *      the landing UploadWorkspace. The Drive fileId + access token DO cross
 *      route boundaries via sessionStorage, so we auto-fire the
 *      `useUploadCloudDocumentMutation` on mount and don't ask the user to
 *      do anything. Toasts on success/failure, refreshes the docs list.
 */
function readPending(): PendingUpload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);

    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingUpload;

    if (Date.now() - parsed.ts > MAX_AGE_MS) {
      window.sessionStorage.removeItem(STORAGE_KEY);

      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function clearPending() {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function PendingConversionBanner() {
  const [pending, setPending] = useState<PendingUpload | null>(readPending);
  const cloudUploadMutation = useUploadCloudDocumentMutation();
  const cloudMutate = cloudUploadMutation.mutate;
  // Fire the Drive import at most once per marker. Ref-only (no setState in
  // effect) so `react-hooks/set-state-in-effect` stays happy — settlement UI
  // is driven by the mutation's own status + toast callbacks.
  const importedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pending) return;
    if (pending.context !== "gdrive") return;

    const markerKey = `${pending.fileId ?? ""}:${pending.ts}`;

    if (importedRef.current === markerKey) return;
    importedRef.current = markerKey;

    if (
      !pending.fileId ||
      !pending.accessToken ||
      !pending.fileName ||
      !pending.provider
    ) {
      toast.error({
        title: "Google Drive import incomplete",
        description: "Missing file details — please pick the file again.",
      });
      clearPending();

      return;
    }

    const fileName = pending.fileName;

    cloudMutate(
      {
        accessToken: pending.accessToken,
        fileId: pending.fileId,
        fileName,
        mimeType: pending.mimeType,
        provider: pending.provider,
      },
      {
        onSuccess: () => {
          toast.success({
            title: `${fileName} imported`,
            description: "Available in My PDFs.",
          });
          clearPending();
        },
        onError: (err) => {
          toast.error({
            title: "Google Drive import failed",
            description: err instanceof Error ? err.message : undefined,
          });
          clearPending();
        },
      },
    );
  }, [pending, cloudMutate]);

  // Hide the gdrive banner once the mutation settles (success or error). The
  // convert-flow banner still uses the local `pending` state + Dismiss.
  if (
    pending?.context === "gdrive" &&
    (cloudUploadMutation.isSuccess || cloudUploadMutation.isError)
  ) {
    return null;
  }

  if (!pending) return null;

  const dismiss = () => {
    clearPending();
    setPending(null);
  };

  if (pending.context === "gdrive") {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-[color-mix(in_oklab,var(--color-accent)_35%,transparent)] bg-[color-mix(in_oklab,var(--color-accent)_8%,var(--color-background))] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--color-foreground)]">
            Importing from Google Drive…
          </p>
          <p className="mt-0.5 truncate text-xs text-default-500">
            <span className="font-medium text-[var(--color-foreground)]">
              {pending.fileName}
            </span>{" "}
            — this closes automatically when the import finishes.
          </p>
        </div>
      </div>
    );
  }

  const slug = pending.context?.startsWith("convert:")
    ? pending.context.slice("convert:".length)
    : null;
  const route = slug ? CONVERT_ROUTES[slug] : null;
  const title = route?.title ?? "Continue your conversion";

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
