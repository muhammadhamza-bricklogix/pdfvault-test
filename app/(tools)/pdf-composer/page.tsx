import type { Metadata } from "next";

import { Suspense } from "react";

import { FlowOneConvertPendingOverlay } from "@/components/sections/pdf-editor/FlowOneConvertPendingOverlay";
import { PdfEditorShell } from "@/components/sections/pdf-editor/PdfEditorShell";
import { PendingEditorFileHydrator } from "@/components/shared/pending-editor-file-hydrator";
import { resolveComposerLocale } from "@/lib/server/i18n/resolve-locale";

export const metadata: Metadata = {
  title: "PDF Composer",
};

export default async function PdfComposerPage() {
  // Server-resolve the user's locale so `ComposerI18nProvider` renders
  // the correct language on the very first paint. Without this, German
  // users hit the composer at `/pdf-composer` (no `/de/` prefix), the
  // SSR pass falls back to "en", and the interface flashes English
  // before the client-side cookie read swaps to German (QA F-63).
  const initialLocale = await resolveComposerLocale();

  return (
    <Suspense fallback={null}>
      <PendingEditorFileHydrator />
      <PdfEditorShell initialLocale={initialLocale} />
      {/* Flow 1 (guest X→PDF spec 2026-09-09) post-signup landing.
          Only renders when `?convert-pending=1` is present; runs the
          conversion, then swaps URL to `?id=<docId>` so the editor
          loader takes over and fires the paywall on the converted
          doc. See the component doc-comment for the full flow. */}
      <FlowOneConvertPendingOverlay />
    </Suspense>
  );
}
