import type { Metadata } from "next";

import { SplitPdfTool } from "@/components/sections/split-pdf/SplitPdfTool";

export const metadata: Metadata = {
  title: "Split PDF",
  description:
    "Split a PDF into separate documents by custom page ranges or in even chunks. Runs entirely in your browser — no uploads.",
};

export default function SplitPdfPage() {
  return <SplitPdfTool />;
}
