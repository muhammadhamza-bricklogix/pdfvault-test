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
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const pageCount = usePdfEditorStore((s) => s.pageCount);
  const watermarkConfig = usePdfEditorStore((s) => s.watermarkConfig);

  // Track whether we've loaded the Fabric classes
  const fabricClassesRef = useRef<{
    FabricImage: typeof import("fabric").FabricImage;
    FabricText: typeof import("fabric").FabricText;
  } | null>(null);

  // Clean up previews when watermark is disabled or canvas unmounts
  useEffect(() => {
    if (fabricCanvas && !watermarkConfig.enabled) {
      clearWatermarkPreviews(fabricCanvas);
      fabricCanvas.renderAll();
    }

    return () => {
      if (fabricCanvas) {
        clearWatermarkPreviews(fabricCanvas);
        fabricCanvas.renderAll();
      }
    };
  }, [fabricCanvas, watermarkConfig.enabled]);

  // Main preview rendering effect
  useEffect(() => {
    if (!fabricCanvas || !watermarkConfig.enabled) return;

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

        // If the effect was cancelled mid-render (page switched, tool changed)
        // the canvas may have been disposed — bail before reordering.
        if (cancelled) return;

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

      if (cancelled) return;

      fabricCanvas.renderAll();
    };

    renderPreview();

    return () => {
      cancelled = true;
    };
  }, [currentPage, fabricCanvas, pageCount, watermarkConfig]);
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
    // Measure first so we can size the auto-fit + rotated bbox correctly.
    const measure = new FabricText(config.text, {
      fontFamily: config.fontFamily,
      fontSize: config.fontSize,
    });
    let w = measure.width ?? 1;
    let h = measure.height ?? 1;

    let scaleFactor = 1;

    if (config.scaleToPage) {
      const maxWidth = canvasWidth - PADDING * 2;

      scaleFactor = Math.min(1, maxWidth / w);
    }

    w *= scaleFactor;
    h *= scaleFactor;

    // Shrink further if the rotated bbox would extend past the canvas edges.
    const autoFit = fitScaleForRotated(
      w,
      h,
      config.rotation,
      canvasWidth,
      canvasHeight,
    );

    scaleFactor *= autoFit;
    w *= autoFit;
    h *= autoFit;

    const { height: rotH } = rotatedBboxSize(w, h, config.rotation);
    const { left, originX, originY, top } = resolvePosition(
      config.position,
      canvasWidth,
      canvasHeight,
      rotH,
    );

    const obj = new FabricText(config.text, {
      ...baseProps,
      left,
      originX,
      originY,
      top,
    });

    if (scaleFactor < 1) {
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
    let scaleFactor = 1;

    if (config.scaleToPage) {
      scaleFactor = Math.min(
        (canvasWidth - PADDING * 2) / imgWidth,
        (canvasHeight - PADDING * 2) / imgHeight,
        1,
      );
    }

    let w = imgWidth * scaleFactor;
    let h = imgHeight * scaleFactor;

    // Shrink further so the rotated bbox stays inside the canvas.
    const autoFit = fitScaleForRotated(
      w,
      h,
      config.rotation,
      canvasWidth,
      canvasHeight,
    );

    scaleFactor *= autoFit;
    w *= autoFit;
    h *= autoFit;

    const { height: rotH } = rotatedBboxSize(w, h, config.rotation);
    const { left, originX, originY, top } = resolvePosition(
      config.position,
      canvasWidth,
      canvasHeight,
      rotH,
    );

    img.set({
      ...baseProps,
      left,
      originX,
      originY,
      top,
    });

    if (scaleFactor < 1) {
      img.set({ scaleX: scaleFactor, scaleY: scaleFactor });
    }

    canvas.add(img);
  }
}

// ---------------------------------------------------------------------------
// Position resolver
// ---------------------------------------------------------------------------

function rotatedBboxSize(
  w: number,
  h: number,
  angleDeg: number,
): { height: number; width: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const s = Math.abs(Math.sin(rad));

  return { height: w * s + h * c, width: w * c + h * s };
}

function fitScaleForRotated(
  w: number,
  h: number,
  angleDeg: number,
  canvasWidth: number,
  canvasHeight: number,
): number {
  const { width: rotW, height: rotH } = rotatedBboxSize(w, h, angleDeg);
  const maxW = Math.max(1, canvasWidth - PADDING * 2);
  const maxH = Math.max(1, canvasHeight - PADDING * 2);

  return Math.min(1, maxW / rotW, maxH / rotH);
}

// With originX="center" + originY="center", Fabric rotates the object around
// its own center — so (left, top) IS the rotated bbox center. We just need to
// pick that center so the rotated bbox sits inside the canvas minus PADDING.
function resolvePosition(
  position: string,
  canvasWidth: number,
  canvasHeight: number,
  rotH: number,
): {
  left: number;
  originX: TOriginX;
  originY: TOriginY;
  top: number;
} {
  const originX: TOriginX = "center";
  const originY: TOriginY = "center";

  switch (position) {
    case "top":
      return {
        left: canvasWidth / 2,
        originX,
        originY,
        top: PADDING + rotH / 2,
      };
    case "bottom":
      return {
        left: canvasWidth / 2,
        originX,
        originY,
        top: canvasHeight - PADDING - rotH / 2,
      };
    case "center":
    default:
      return {
        left: canvasWidth / 2,
        originX,
        originY,
        top: canvasHeight / 2,
      };
  }
}
