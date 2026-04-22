import type { Metadata } from "next";

import { PdfEditorShell } from "@/components/sections/pdf-editor/PdfEditorShell";

export const metadata: Metadata = {
  title: "PDF Editor",
};

export default function PdfEditorPage() {
  return <PdfEditorShell />;
}
