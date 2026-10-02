"use client";

import { Suspense } from "react";

import { useOnlineStatus } from "@/lib/client/hooks/use-online-status";
import { PdfEditorShell } from "@/components/sections/pdf-editor/PdfEditorShell";
import { Ds11AutoPersist } from "@/components/sections/forms/Ds11AutoPersist";
import { Ds11EditorBootstrap } from "@/components/sections/forms/Ds11EditorBootstrap";
import { Ds11FinalizeIntercept } from "@/components/sections/forms/Ds11FinalizeIntercept";
import { Ds11FormFieldsPortal } from "@/components/sections/forms/Ds11FormFieldsPortal";

const OFFLINE_BANNER_OFFSET = "top-[40px]";

export default function Ds11EditPage() {
  const isOnline = useOnlineStatus();

  return (
    <div
      className={`fixed inset-x-0 bottom-0 flex flex-col overflow-hidden ${
        isOnline ? "top-0" : OFFLINE_BANNER_OFFSET
      }`}
    >
      <Suspense fallback={null}>
        <Ds11EditorBootstrap>
          <Ds11FinalizeIntercept />
          <Ds11AutoPersist />
          <PdfEditorShell />
          <Ds11FormFieldsPortal />
        </Ds11EditorBootstrap>
      </Suspense>
    </div>
  );
}
