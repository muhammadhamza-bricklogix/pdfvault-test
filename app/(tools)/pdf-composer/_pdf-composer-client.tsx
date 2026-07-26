"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

import { PendingEditorFileHydrator } from "@/components/shared/pending-editor-file-hydrator";

const PdfEditorShell = dynamic(
  () =>
    import("@/components/sections/pdf-editor/PdfEditorShell").then((m) => ({
      default: m.PdfEditorShell,
    })),
  { ssr: false },
);

export function PdfComposerClient() {
  return (
    <Suspense fallback={null}>
      <PendingEditorFileHydrator />
      <PdfEditorShell />
    </Suspense>
  );
}
