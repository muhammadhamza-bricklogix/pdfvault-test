"use client";

import { useOnlineStatus } from "@/lib/client/hooks/use-online-status";

/**
 * Same fullscreen shell as `/pdf-composer` (`app/(tools)/pdf-composer/layout.tsx`).
 * The pdf-editor UI (`<PdfEditorShell />`) assumes a `fixed inset-0` host so
 * pdf.js + Fabric can own scroll/gesture inside their own container. When
 * offline, the global `OfflineBanner` (sticky top-0, z-50, mounted in
 * `AppProviders`) paints on top of this container's top strip; we inset by
 * the banner height so the top bar stays reachable.
 */
const OFFLINE_BANNER_OFFSET = "top-[40px]";

export default function W9FormLayout({
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
