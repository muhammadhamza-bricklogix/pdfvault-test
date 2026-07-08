import type { Metadata } from "next";

import {
  PvPageHeader,
  UploadPdfButton,
} from "@/components/sections/dashboard/pv-page-header";
import { PvToolsGrid } from "@/components/sections/dashboard/pv-tools-grid";

export const metadata: Metadata = {
  title: "Tools — PDFVault",
  description: "Tools that you can use to make changes on your PDF.",
};

export default function DashboardToolsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PvPageHeader
        action={<UploadPdfButton />}
        subtitle="Tools that you can use to make changes on your PDF"
        title="Tools"
      />
      <PvToolsGrid />
    </div>
  );
}
