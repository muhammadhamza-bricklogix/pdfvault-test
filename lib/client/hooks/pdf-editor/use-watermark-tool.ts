"use client";

import type { Canvas, FabricObject, TOriginX, TOriginY } from "fabric";

import { useEffect, useRef } from "react";

import { usePdfEditorStore } from "@/lib/client/stores";
import {
  calculateTilePositions,
  shouldWatermarkPage,
} from "@/lib/client/pdf-editor/watermark-utils";

type UseWatermarkToolParams = {
  fabricCanvas: Canvas | null;
};

const WATERMARK_EDITOR_TYPE = "watermarkPreview";
const PADDING = 40;

/**
 * Removes all watermark preview objects from the canvas.
 * Wraps mutations in the `isRestoringHistory` flag so the history hook ignores them.
 */
function clearWatermarkPreviews(canvas: Canvas) {
  const { setIsRestoringHistory } = usePdfEditorStore.getState();

  setIsRestoringHistory(true);

  const objects = canvas.getObjects();
  const toRemove = objects.filter(
    (obj) =>
      (obj as FabricObject & { editorType?: string }).editorType ===
      WATERMARK_EDITOR_TYPE,
  );

  for (const obj of toRemove) {
    canvas.remove(obj);
  }

  setIsRestoringHistory(false);
}

export function useWatermarkTool({ fabricCanvas }: UseWatermarkToolParams) {
  const activeTool = usePdfEditorStore((s) => s.activeTool);
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const pageCount = usePdfEditorStore((s) => s.pageCount);
  const watermarkConfig = usePdfEditorStore((s) => s.watermarkConfig);

  // Track whether we've loaded the Fabric classes
  const fabricClassesRef = useRef<{
    FabricImage: typeof import("fabric").FabricImage;
    FabricText: typeof import("fabric").FabricText;
  } | null>(null);

  // Clean up previews when the tool deactivates or canvas unmounts
  useEffect(() => {
    return () => {
      if (fabricCanvas) {
        clearWatermarkPreviews(fabricCanvas);
        fabricCanvas.renderAll();
      }
    };
  }, [fabricCanvas, activeTool]);

  // Main preview rendering effect
  useEffect(() => {
    if (!fabricCanvas || activeTool !== "watermark") return;

    let cancelled = false;

    const renderPreview = async () => {
      // Lazy-load Fabric classes
      if (!fabricClassesRef.current) {
        const { FabricImage, FabricText } = await import("fabric");

        if (cancelled) return;
        fabricClassesRef.current = { FabricImage, FabricText };
      }

      const { FabricImage, FabricText } = fabricClassesRef.current;
      const config = usePdfEditorStore.getState().watermarkConfig;

      // Clear existing previews before re-rendering
      clearWatermarkPreviews(fabricCanvas);

      if (!config.enabled) {
        fabricCanvas.renderAll();

        return;
      }

      // Check if current page should have a watermark
      if (
        !shouldWatermarkPage(
          currentPage,
          pageCount,
          config.pageScope,
          config.customPageRange,
        )
      ) {
        fabricCanvas.renderAll();

        return;
      }

      const canvasWidth = fabricCanvas.getWidth() / fabricCanvas.getZoom();
      const canvasHeight = fabricCanvas.getHeight() / fabricCanvas.getZoom();

      const { setIsRestoringHistory } = usePdfEditorStore.getState();

      setIsRestoringHistory(true);

      try {
        if (config.type === "text" && config.text.trim()) {
          await renderTextPreviews(
            fabricCanvas,
            FabricText,
            config,
            canvasWidth,
            canvasHeight,
          );
        } else if (config.type === "image" && config.imageData) {
          await renderImagePreviews(
            fabricCanvas,
            FabricImage,
            config,
            canvasWidth,
            canvasHeight,
          );
        }

        // Apply z-order based on layer setting — underlay sends watermark
        // behind all other Fabric objects, overlay brings it to front.
        const wmObjects = fabricCanvas
          .getObjects()
          .filter(
            (obj) =>
              (obj as FabricObject & { editorType?: string }).editorType ===
              WATERMARK_EDITOR_TYPE,
          );

        for (const obj of wmObjects) {
          if (config.layer === "underlay") {
            fabricCanvas.sendObjectToBack(obj);
          } else {
            fabricCanvas.bringObjectToFront(obj);
          }
        }
      } finally {
        setIsRestoringHistory(false);
      }

      fabricCanvas.renderAll();
    };

    renderPreview();

    return () => {
      cancelled = true;
    };
  }, [activeTool, currentPage, fabricCanvas, pageCount, watermarkConfig]);
}

// ---------------------------------------------------------------------------
// Text watermark preview
// ---------------------------------------------------------------------------

async function renderTextPreviews(
  canvas: Canvas,
  FabricText: typeof import("fabric").FabricText,
  config: ReturnType<typeof usePdfEditorStore.getState>["watermarkConfig"],
  canvasWidth: number,
  canvasHeight: number,
) {
  const baseProps = {
    angle: config.rotation,
    editorType: WATERMARK_EDITOR_TYPE,
    evented: false,
    fill: config.color,
    fontFamily: config.fontFamily,
    fontSize: config.fontSize,
    hasControls: false,
    hasBorders: false,
    opacity: config.opacity,
    selectable: false,
  };

  if (config.position === "tiled") {
    // Estimate text dimensions for tiling
    const tempText = new FabricText(config.text, {
      fontFamily: config.fontFamily,
      fontSize: config.fontSize,
    });
    const textWidth = tempText.width ?? config.fontSize * config.text.length;
    const textHeight = tempText.height ?? config.fontSize;

    const positions = calculateTilePositions(
      canvasWidth,
      canvasHeight,
      textWidth,
      textHeight,
      config.tiledSpacing,
    );

    for (const pos of positions) {
      const obj = new FabricText(config.text, {
        ...baseProps,
        left: pos.x,
        originX: "left",
        originY: "top",
        top: pos.y,
      });

      canvas.add(obj);
    }
  } else {
    const { left, originX, originY, top } = resolvePosition(
      config.position,
      canvasWidth,
      canvasHeight,
    );

    const obj = new FabricText(config.text, {
      ...baseProps,
      left,
      originX,
      originY,
      top,
    });

    if (config.scaleToPage) {
      const objWidth = obj.width ?? 1;
      const maxWidth = canvasWidth - PADDING * 2;
      const scaleFactor = Math.min(1, maxWidth / objWidth);

      obj.set({ scaleX: scaleFactor, scaleY: scaleFactor });
    }

    canvas.add(obj);
  }
}

// ---------------------------------------------------------------------------
// Image watermark preview
// ---------------------------------------------------------------------------

async function renderImagePreviews(
  canvas: Canvas,
  FabricImage: typeof import("fabric").FabricImage,
  config: ReturnType<typeof usePdfEditorStore.getState>["watermarkConfig"],
  canvasWidth: number,
  canvasHeight: number,
) {
  if (!config.imageData) return;

  const img = await FabricImage.fromURL(config.imageData);

  if (!img) return;

  const imgWidth = img.width ?? 100;
  const imgHeight = img.height ?? 100;

  const baseProps = {
    angle: config.rotation,
    editorType: WATERMARK_EDITOR_TYPE,
    evented: false,
    hasControls: false,
    hasBorders: false,
    opacity: config.opacity,
    selectable: false,
  };

  if (config.position === "tiled") {
    const scaleFactor = config.scaleToPage
      ? Math.min(
          (canvasWidth - PADDING * 2) / imgWidth,
          (canvasHeight - PADDING * 2) / imgHeight,
          1,
        )
      : 1;
    const scaledW = imgWidth * scaleFactor;
    const scaledH = imgHeight * scaleFactor;

    const positions = calculateTilePositions(
      canvasWidth,
      canvasHeight,
      scaledW,
      scaledH,
      config.tiledSpacing,
    );

    for (const pos of positions) {
      const tileImg = await FabricImage.fromURL(config.imageData!);

      if (!tileImg) continue;

      tileImg.set({
        ...baseProps,
        left: pos.x,
        originX: "left",
        originY: "top",
        scaleX: scaleFactor,
        scaleY: scaleFactor,
        top: pos.y,
      });
      canvas.add(tileImg);
    }
  } else {
    const { left, originX, originY, top } = resolvePosition(
      config.position,
      canvasWidth,
      canvasHeight,
    );

    img.set({
      ...baseProps,
      left,
      originX,
      originY,
      top,
    });

    if (config.scaleToPage) {
      const scaleFactor = Math.min(
        (canvasWidth - PADDING * 2) / imgWidth,
        (canvasHeight - PADDING * 2) / imgHeight,
        1,
      );

      img.set({ scaleX: scaleFactor, scaleY: scaleFactor });
    }

    canvas.add(img);
  }
}

// ---------------------------------------------------------------------------
// Position resolver
// ---------------------------------------------------------------------------

function resolvePosition(
  position: string,
  canvasWidth: number,
  canvasHeight: number,
): {
  left: number;
  originX: TOriginX;
  originY: TOriginY;
  top: number;
} {
  switch (position) {
    case "top-left":
      return {
        left: PADDING,
        originX: "left",
        originY: "top",
        top: PADDING,
      };
    case "top-right":
      return {
        left: canvasWidth - PADDING,
        originX: "right",
        originY: "top",
        top: PADDING,
      };
    case "bottom-left":
      return {
        left: PADDING,
        originX: "left",
        originY: "bottom",
        top: canvasHeight - PADDING,
      };
    case "bottom-right":
      return {
        left: canvasWidth - PADDING,
        originX: "right",
        originY: "bottom",
        top: canvasHeight - PADDING,
      };
    case "center":
    default:
      return {
        left: canvasWidth / 2,
        originX: "center",
        originY: "center",
        top: canvasHeight / 2,
      };
  }
}
