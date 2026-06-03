"use client";

import type { Canvas as FabricCanvas } from "fabric";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import { persistEditorDocument } from "@/lib/client/pdf-editor/persist-editor-document";
import { ROUTES } from "@/lib/shared/constants/routes";
import { toast } from "@/lib/shared/utils/toast";

/**
 * Listens for `editor:save` (dispatched by the Save button) and uploads the
 * flattened PDF to the user's library.
 */
export function useSaveEditor(fabricCanvas: FabricCanvas | null) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const isSavingRef = useRef(false);
  const fabricRef = useRef(fabricCanvas);

  useEffect(() => {
    fabricRef.current = fabricCanvas;
  }, [fabricCanvas]);

  const handleSave = useCallback(async () => {
    if (isSavingRef.current) return;

    isSavingRef.current = true;

    const loadingKey = toast.loading({
      title: "Saving…",
      description: "Saving your PDF to your library.",
    });

    try {
      const result = await persistEditorDocument({
        fabricCanvas: fabricRef.current,
      });

      if (!result.ok) {
        if (result.reason === "no-changes") {
          toast.info({
            title: "Already saved",
            description: "No changes since your last save.",
          });
        } else if (result.reason === "no-file") {
          toast.error({
            title: "Nothing to save",
            description: "Open a PDF before saving.",
          });
        } else if (result.reason === "not-signed-in") {
          toast.error({
            title: "Sign in required",
            description: "Sign in to save your edits to the cloud.",
          });
        } else if (result.reason === "not-loaded") {
          toast.error({
            title: "PDF still loading",
            description:
              "Wait for the document to finish loading, then try again.",
          });
        } else {
          toast.error({
            title: "Save failed",
            description: "We couldn't save your edits. Please try again.",
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
        title: "Saved",
        description: "Your PDF was saved to your library.",
      });
    } finally {
      toast.close(loadingKey);
      isSavingRef.current = false;
    }
  }, [router, searchParams]);

  useEffect(() => {
    const onSave = () => {
      void handleSave();
    };

    window.addEventListener("editor:save", onSave);

    return () => {
      window.removeEventListener("editor:save", onSave);
    };
  }, [handleSave]);
}
