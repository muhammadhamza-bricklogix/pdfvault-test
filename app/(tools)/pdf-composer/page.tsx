import type { Metadata } from "next";

import { Suspense } from "react";

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
    </Suspense>
  );
}
