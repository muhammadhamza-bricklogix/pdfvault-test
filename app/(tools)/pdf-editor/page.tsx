import type { Metadata } from "next";

import { PdfEditorPageClient } from "./PdfEditorPageClient";

export const metadata: Metadata = {
  title: "PDF Editor",
};

export default function PdfEditorPage() {
  return <PdfEditorPageClient />;
}
