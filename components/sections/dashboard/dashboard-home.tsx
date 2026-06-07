"use client";

import { Configuration01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@heroui/react";
import { useState } from "react";

import { ToolsModal } from "@/components/sections/pdf-editor/ToolsModal";

import { DocumentsTable } from "./documents-table";
import { UploadCta } from "./upload-cta";

export function DashboardHome() {
  const [isToolsOpen, setIsToolsOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            My Documents
          </h1>
          <p className="text-sm text-default-500">
            Open, rename, download, or delete your saved PDFs. Select multiple
            rows to download or delete in one step.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            className="flex-1 sm:flex-none"
            variant="secondary"
            onPress={() => setIsToolsOpen(true)}
          >
            <HugeiconsIcon icon={Configuration01Icon} size={16} />
            Tools
          </Button>
          <UploadCta />
        </div>
      </div>

      <DocumentsTable />

      <ToolsModal isOpen={isToolsOpen} onClose={() => setIsToolsOpen(false)} />
    </div>
  );
}
