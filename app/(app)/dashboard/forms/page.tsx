import type { Metadata } from "next";

import {
  PvPageHeader,
  UploadPdfButton,
} from "@/components/sections/dashboard/pv-page-header";
import { PvFormsGrid } from "@/components/sections/dashboard/pv-forms-grid";

export const metadata: Metadata = {
  title: "Forms — PDFVault",
  description: "Fill IRS forms online. Type values, sign, and export a PDF.",
};

export default function DashboardFormsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PvPageHeader
        action={<UploadPdfButton />}
        backHref="/dashboard"
        subtitle="Fill IRS forms in your browser and export a clean PDF"
        title="Forms"
      />
      <PvFormsGrid />
    </div>
  );
}
