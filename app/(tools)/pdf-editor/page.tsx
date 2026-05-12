import type { Metadata } from "next";

import { Suspense } from "react";

import { PdfEditorShell } from "@/components/sections/pdf-editor/PdfEditorShell";

export const metadata: Metadata = {
  title: "PDF Editor",
};

export default function PdfEditorPage() {
  return (
    <Suspense fallback={null}>
      <PdfEditorShell />
    </Suspense>
  );
}
