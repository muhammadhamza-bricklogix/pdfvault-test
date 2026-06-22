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
      className="sticky top-0 z-50 flex w-full items-center justify-center gap-2 bg-warning-100 px-4 py-2 text-warning-800 shadow-sm"
      role="status"
    >
      <HugeiconsIcon icon={CloudOffIcon} size={16} />
      <span className="text-sm font-medium">
        You&apos;re offline — viewing cached documents only. Save, rename,
        delete, and upload are disabled until you reconnect.
      </span>
    </div>
  );
}
