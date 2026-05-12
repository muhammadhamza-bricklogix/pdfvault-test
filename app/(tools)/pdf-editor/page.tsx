import type { Metadata } from "next";

import { Suspense } from "react";

import { PdfEditorShell } from "@/components/sections/pdf-editor/PdfEditorShell";

// Fabric.js expects browser APIs (e.g. DOMMatrix) during module init; skip SSG.
export const dynamic = "force-dynamic";

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
