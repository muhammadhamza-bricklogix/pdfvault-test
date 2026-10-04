"use client";

import type { Canvas } from "fabric";

import { useEffect, useRef } from "react";

import { serializeFabricCanvas } from "@/lib/client/pdf-editor/save-utils";
import { usePdfEditorStore } from "@/lib/client/stores";
import { toast } from "@/lib/shared/utils/toast";

type UseImageToolParams = {
  fabricCanvas: Canvas | null;
};

const ACCEPTED_TYPES = "image/png,image/jpeg,image/svg+xml,image/webp";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function useImageTool({ fabricCanvas }: UseImageToolParams) {
  const activeTool = usePdfEditorStore((s) => s.activeTool);
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const markDocumentDirty = usePdfEditorStore((s) => s.markDocumentDirty);
  const pushHistory = usePdfEditorStore((s) => s.pushHistory);
  const saveFabricJson = usePdfEditorStore((s) => s.saveFabricJson);
  const setActiveTool = usePdfEditorStore((s) => s.setActiveTool);

  const inputRef = useRef<HTMLInputElement | null>(null);

  // Create hidden file input once
  useEffect(() => {
    const input = document.createElement("input");

    input.type = "file";
    input.accept = ACCEPTED_TYPES;
    input.style.display = "none";
    document.body.appendChild(input);
    inputRef.current = input;

    return () => {
      document.body.removeChild(input);
      inputRef.current = null;
    };
  }, []);

  // Trigger file picker when image tool is activated
  useEffect(() => {
    if (activeTool !== "image" || !fabricCanvas || !inputRef.current) return;

    const input = inputRef.current;

    const handleChange = async () => {
      const file = input.files?.[0];

      if (!file) {
        setActiveTool("select");

        return;
      }

      if (file.size > MAX_IMAGE_BYTES) {
        toast.error({
          title: "Image too large",
          description: "Pick an image under 10 MB.",
        });
        input.value = "";
        setActiveTool("select");

        return;
      }

      // Convert to data URL so the image survives JSON serialization across page switches
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { FabricImage } = await import("fabric");
      const img = await FabricImage.fromURL(dataUrl);

      const canvasW = fabricCanvas.width ?? 600;
      const canvasH = fabricCanvas.height ?? 800;
      const maxW = canvasW * 0.5;
      const maxH = canvasH * 0.5;
      const scale = Math.min(
        1,
        maxW / (img.width ?? 1),
        maxH / (img.height ?? 1),
      );

      img.set({
        left: canvasW / 2,
        lockUniScaling: true,
        originX: "center",
        originY: "center",
        scaleX: scale,
        scaleY: scale,
        top: canvasH / 2,
      });

      fabricCanvas.add(img);
      fabricCanvas.setActiveObject(img);
      fabricCanvas.renderAll();

      // QA 2026-10-04 row 63: do NOT call `pushHistory` here. The
      // `fabricCanvas.add(img)` above already fires `object:added` →
      // the snapshotOnAdd listener in `use-editor-history.ts` pushes
      // a history entry. A second manual push here produces a
      // duplicate entry — the user needs TWO undos to remove one
      // image. Unlike use-shape-tool.ts, image tool does NOT set
      // `isCreatingShape`, so the auto-snapshot handler isn't gated.
      //
      // `saveFabricJson` + `markDocumentDirty` are kept as belt-and-
      // braces (both are also auto-fired by the add listeners) —
      // idempotent, matches the 2026-07-23 persistence pattern.
      saveFabricJson(currentPage, serializeFabricCanvas(fabricCanvas));
      markDocumentDirty();

      setActiveTool("select");
      input.value = "";
    };

    const handleCancel = () => {
      setTimeout(() => {
        if (!input.files?.length) {
          setActiveTool("select");
        }
      }, 300);
    };

    input.addEventListener("change", handleChange);
    window.addEventListener("focus", handleCancel, { once: true });

    input.click();

    return () => {
      input.removeEventListener("change", handleChange);
      window.removeEventListener("focus", handleCancel);
    };
  }, [
    activeTool,
    fabricCanvas,
    currentPage,
    markDocumentDirty,
    pushHistory,
    saveFabricJson,
    setActiveTool,
  ]);
}
