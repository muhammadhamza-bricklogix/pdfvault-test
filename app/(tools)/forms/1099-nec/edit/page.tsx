"use client";

import { Suspense } from "react";

import { useOnlineStatus } from "@/lib/client/hooks/use-online-status";
import { PdfEditorShell } from "@/components/sections/pdf-editor/PdfEditorShell";
import { NecAutoPersist } from "@/components/sections/forms/NecAutoPersist";
import { NecEditorBootstrap } from "@/components/sections/forms/NecEditorBootstrap";
import { NecFinalizeIntercept } from "@/components/sections/forms/NecFinalizeIntercept";
import { NecFormFieldsPortal } from "@/components/sections/forms/NecFormFieldsPortal";

const OFFLINE_BANNER_OFFSET = "top-[40px]";

export default function Nec1099EditPage() {
  const isOnline = useOnlineStatus();

  return (
    <div
      className={`fixed inset-x-0 bottom-0 flex flex-col overflow-hidden ${
        isOnline ? "top-0" : OFFLINE_BANNER_OFFSET
      }`}
    >
      <Suspense fallback={null}>
        <NecEditorBootstrap>
          <NecFinalizeIntercept />
          <NecAutoPersist />
          <PdfEditorShell />
          <NecFormFieldsPortal />
        </NecEditorBootstrap>
      </Suspense>
    </div>
  );
}
