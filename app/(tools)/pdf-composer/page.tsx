import type { Metadata } from "next";

import { Suspense } from "react";

import { FlowOneConvertPendingOverlay } from "@/components/sections/pdf-editor/FlowOneConvertPendingOverlay";
import { PdfEditorShell } from "@/components/sections/pdf-editor/PdfEditorShell";
import { PendingEditorFileHydrator } from "@/components/shared/pending-editor-file-hydrator";

export const metadata: Metadata = {
  title: "PDF Composer",
};

export default function PdfComposerPage() {
  return (
    <Suspense fallback={null}>
      <PendingEditorFileHydrator />
      <PdfEditorShell />
      {/* Flow 1 (guest X→PDF spec 2026-09-09) post-signup landing.
          Only renders when `?convert-pending=1` is present; runs the
          conversion, then swaps URL to `?id=<docId>` so the editor
          loader takes over and fires the paywall on the converted
          doc. See the component doc-comment for the full flow. */}
      <FlowOneConvertPendingOverlay />
    </Suspense>
  );
}
