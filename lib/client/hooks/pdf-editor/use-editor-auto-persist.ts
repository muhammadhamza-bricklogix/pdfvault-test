"use client";

import type { Canvas as FabricCanvas } from "fabric";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { persistEditorDocument } from "@/lib/client/pdf-editor/persist-editor-document";
import { usePdfEditorStore } from "@/lib/client/stores";
import { ROUTES } from "@/lib/shared/constants/routes";
import { toast } from "@/lib/shared/utils/toast";

/**
 * After Manage Pages rebuilds the PDF, pdf.js reloads asynchronously.
 * Upload the merged document once the new proxy is ready.
 */
export function useEditorAutoPersist(fabricCanvas: FabricCanvas | null) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pendingCloudSaveAfterReload = usePdfEditorStore(
    (s) => s.pendingCloudSaveAfterReload,
  );
  const pdfDocument = usePdfEditorStore((s) => s.pdfDocument);
  const file = usePdfEditorStore((s) => s.file);
  const clearPendingCloudSaveAfterReload = usePdfEditorStore(
    (s) => s.clearPendingCloudSaveAfterReload,
  );

  const fabricRef = useRef(fabricCanvas);

  useEffect(() => {
    fabricRef.current = fabricCanvas;
  }, [fabricCanvas]);

  useEffect(() => {
    if (!pendingCloudSaveAfterReload || !pdfDocument || !file) return;

    clearPendingCloudSaveAfterReload();

    void (async () => {
      // `force: true` — Manage Pages rebuilds the source PDF bytes outside of
      // the hasUnsavedChanges system (it swaps `file` directly), so the cloud
      // copy will be stale even though the flag may be false. Skipping here
      // would lose the rebuilt pages.
      const result = await persistEditorDocument({
        fabricCanvas: fabricRef.current,
        force: true,
      });

      if (!result.ok) {
        if (result.reason === "not-signed-in") {
          toast.info({
            title: "Sign in to save",
            description:
              "Page changes are applied locally. Sign in to save to the cloud.",
          });
        } else if (result.reason === "error") {
          toast.error({
            title: "Could not save pages",
            description:
              "Your page changes were applied but cloud save failed. Use Save to retry.",
          });
        }

        return;
      }

      const id = result.document.id;

      if (searchParams.get("id") !== id) {
        const params = new URLSearchParams(searchParams.toString());

        params.set("id", id);
        router.replace(`${ROUTES.TOOLS.PDF_EDITOR}?${params.toString()}`);
      }

      toast.success({
        title: "Pages saved",
        description: "Your page changes were saved to your library.",
      });
    })();
  }, [
    clearPendingCloudSaveAfterReload,
    file,
    pdfDocument,
    pendingCloudSaveAfterReload,
    router,
    searchParams,
  ]);
}
