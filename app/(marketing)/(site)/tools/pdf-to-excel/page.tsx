import type { Metadata } from "next";

import { ToolUploadSection } from "@/components/sections/tools/tool-upload-section";
import { TOOLS } from "@/lib/shared/constants/tools";

const tool = TOOLS["pdf-to-excel"];

export const metadata: Metadata = {
  title: tool.title,
  description: tool.description,
};

export default function PdfToExcelPage() {
  return <ToolUploadSection tool={tool} />;
}
