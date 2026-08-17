"use client";

import { CloudOffIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { useOnlineStatus } from "@/lib/client/hooks/use-online-status";

/**
 * Top-of-page strip that tells the user they're disconnected. Rendered
 * unconditionally near the root so it can paint over any route. While the
 * user is online it returns null and contributes no DOM. Pairs with
 * `useOnlineStatus()` used at button sites to disable mutating actions.
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      aria-live="polite"
      className="sticky top-0 z-50 flex h-10 w-full items-center justify-center gap-2 bg-warning-100 px-4 text-warning-800 shadow-sm"
      role="status"
      // Fixed 40px height so downstream layouts (e.g. the editor's fullscreen
      // `fixed inset-0` container) can safely inset from the top by 40px and
      // stop the banner from overlapping their top bar. Long-form guidance
      // moves to a title tooltip so mobile stays single-line.
    >
      <HugeiconsIcon icon={CloudOffIcon} size={16} />
      <span
        className="truncate text-sm font-medium"
        title="You're offline — viewing cached documents only. Save, rename, delete, and upload are disabled until you reconnect."
      >
        <span className="sm:hidden">You&apos;re offline — cached only</span>
        <span className="hidden sm:inline">
          You&apos;re offline — viewing cached documents only. Save, rename,
          delete, and upload are disabled until you reconnect.
        </span>
      </span>
    </div>
  );
}
