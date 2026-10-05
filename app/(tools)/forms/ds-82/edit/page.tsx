"use client";

import { Suspense } from "react";

import { useOnlineStatus } from "@/lib/client/hooks/use-online-status";
import { PdfEditorShell } from "@/components/sections/pdf-editor/PdfEditorShell";
import { Ds82AutoPersist } from "@/components/sections/forms/Ds82AutoPersist";
import { Ds82EditorBootstrap } from "@/components/sections/forms/Ds82EditorBootstrap";
import { Ds82FinalizeIntercept } from "@/components/sections/forms/Ds82FinalizeIntercept";
import { Ds82FormFieldsPortal } from "@/components/sections/forms/Ds82FormFieldsPortal";

const OFFLINE_BANNER_OFFSET = "top-[40px]";

export default function Ds82EditPage() {
  const isOnline = useOnlineStatus();

  return (
    <div
      className={`fixed inset-x-0 bottom-0 flex flex-col overflow-hidden ${
        isOnline ? "top-0" : OFFLINE_BANNER_OFFSET
      }`}
    >
      <Suspense fallback={null}>
        <Ds82EditorBootstrap>
          <Ds82FinalizeIntercept />
          <Ds82AutoPersist />
          <PdfEditorShell />
          <Ds82FormFieldsPortal />
        </Ds82EditorBootstrap>
      </Suspense>
    </div>
  );
}
