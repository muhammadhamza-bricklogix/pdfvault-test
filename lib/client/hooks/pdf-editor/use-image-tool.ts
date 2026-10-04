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

    const resetToolAndInput = () => {
      // Row 76: on every exit path (success, error, cancel) clear the
      // input + flip back to Select. The previous version left tool stuck
      // on "image" after a FileReader / FabricImage error — the hidden
      // input never got a reset event, so the next tool-strip click
      // registered as a no-op until the user picked a different tool
      // first ("dead clicks"). Deterministic reset here guarantees the
      // Image tile responds immediately on the next click.
      input.value = "";
      setActiveTool("select");
    };

    const handleChange = async () => {
      const file = input.files?.[0];

      if (!file) {
        resetToolAndInput();

        return;
      }

      if (file.size > MAX_IMAGE_BYTES) {
        toast.error({
          title: "Image too large",
          description: "Pick an image under 10 MB.",
        });
        resetToolAndInput();

        return;
      }

      // Row 110/112/118: persistent loading toast so the UI doesn't go
      // silent during the FileReader + Fabric decode. Larger images
      // (several MB) can take 1-2 seconds and the previous version let
      // the user double-click thinking the first attempt was dropped.
      // Closed in every exit path (success + each error) so a stuck
      // loader can't outlive its action.
      const loadingKey = toast.loading({
        title: "Loading image…",
        description: file.name,
      });

      // Row 75: wrap FileReader + FabricImage decode in try/catch so a
      // corrupt / zero-byte / non-decodable file surfaces a clear toast
      // ("Invalid image" / "Couldn't read image") instead of silently
      // failing. Also catches the Fabric v7 case where fromURL resolves
      // with a 0×0 image for an unreadable src — treated as corrupt.
      let dataUrl: string;

      try {
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();

          reader.onload = () => {
            const result = reader.result;

            if (typeof result === "string" && result.length > 0) {
              resolve(result);
            } else {
              reject(new Error("empty-result"));
            }
          };
          reader.onerror = () =>
            reject(reader.error ?? new Error("reader-error"));
          reader.readAsDataURL(file);
        });
      } catch {
        toast.close(loadingKey);
        toast.error({
          title: "Couldn't read image",
          description: `"${file.name}" couldn't be opened. The file may be corrupt.`,
        });
        resetToolAndInput();

        return;
      }

      let img: Awaited<ReturnType<typeof import("fabric").FabricImage.fromURL>>;

      try {
        const { FabricImage } = await import("fabric");

        img = await FabricImage.fromURL(dataUrl);
      } catch {
        toast.close(loadingKey);
        toast.error({
          title: "Invalid image",
          description: `"${file.name}" couldn't be decoded. Please pick a valid PNG, JPG, WEBP, or SVG.`,
        });
        resetToolAndInput();

        return;
      }

      // Even if fromURL didn't throw, Fabric v7 can resolve with a 0×0
      // image for a non-image data URL (eg. text misreported as image/png
      // by the OS). Treat that as corrupt too so we don't drop a blank
      // overlay on the canvas.
      if (!img.width || !img.height || img.width < 1 || img.height < 1) {
        toast.close(loadingKey);
        toast.error({
          title: "Invalid image",
          description: `"${file.name}" didn't decode to a usable image.`,
        });
        resetToolAndInput();

        return;
      }

      toast.close(loadingKey);

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

      resetToolAndInput();
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
