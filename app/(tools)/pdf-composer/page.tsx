import type { Metadata } from "next";

import { PdfComposerClient } from "./_pdf-composer-client";

export const metadata: Metadata = {
  title: "PDF Composer",
};

export default function PdfComposerPage() {
  return <PdfComposerClient />;
}
