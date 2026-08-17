"use client";

import { useOnlineStatus } from "@/lib/client/hooks/use-online-status";

/**
 * `fixed inset-0` gives the editor a fullscreen shell so pdf.js + Fabric can
 * own scroll/gesture inside their own container. The trade-off: the global
 * `OfflineBanner` (sticky top-0, z-50 — mounted in `AppProviders`) paints on
 * top of this container's top strip when offline and covers the hamburger.
 * We inset from the top by the banner height so the top bar stays reachable.
 * When online this is a no-op — `useOnlineStatus()` reports `true` on SSR and
 * the initial client paint, so hydration matches.
 */
const OFFLINE_BANNER_OFFSET = "top-[40px]";

export default function PdfEditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isOnline = useOnlineStatus();

  return (
    <div
      className={`fixed inset-x-0 bottom-0 flex flex-col overflow-hidden ${
        isOnline ? "top-0" : OFFLINE_BANNER_OFFSET
      }`}
    >
      {children}
    </div>
  );
}
