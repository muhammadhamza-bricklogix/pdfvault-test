"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const PdfEditorShell = dynamic(
  () =>
    import("@/components/sections/pdf-editor/PdfEditorShell").then(
      (mod) => mod.PdfEditorShell,
    ),
  { loading: () => null, ssr: false },
);

export function PdfEditorPageClient() {
  return (
    <Suspense fallback={null}>
      <PdfEditorShell />
    </Suspense>
  );
}
