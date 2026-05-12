"use client";

import type {
  Canvas,
  FabricObject,
  IText,
  Rect,
  TPointerEventInfo,
} from "fabric";

import { useEffect, useRef } from "react";

import type { ExtractedTextItem } from "@/lib/client/pdf-editor/extract-text";

import { usePdfEditorStore } from "@/lib/client/stores";

// Fabric v7 renders the alphabetic baseline at `top + fontSize * _fontSizeMult`
// (see node_modules/fabric/src/shapes/Text/constants.ts). Lets us position an
// IText so its glyph baseline matches the PDF baseline — but ONLY when the
// object's origin is top-left. Fabric v7's default origin is center/center,
// which would interpret `top` as the center Y and shift the baseline up by
// `fontSize * _fontSizeMult / 2`. Every IText/Rect created here pins
// originX:'left', originY:'top' to keep the math direct.
const FABRIC_FONT_SIZE_MULT = 1.13;

type UseTextEditToolParams = {
  fabricCanvas: Canvas | null;
};

type FabricClasses = {
  IText: typeof IText;
  Rect: typeof Rect;
};

type TaggedObject = FabricObject & {
  pdfTextIndex?: number;
  pdfTextRole?: "text" | "whiteout";
};

// extract-text.ts stores `y` as the baseline; the visible glyph row spans
// roughly (y - fontSize) .. y. Smallest matching bbox wins so nested items
// resolve to the most specific click target.
function findHitItem(
  items: ExtractedTextItem[],
  x: number,
  y: number,
): { item: ExtractedTextItem; index: number } | null {
  let best: { item: ExtractedTextItem; index: number; area: number } | null =
    null;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const top = it.y - it.fontSize;
    const bottom = it.y;

    if (x >= it.x && x <= it.x + it.width && y >= top && y <= bottom) {
      const area = it.width * it.fontSize;

      if (!best || area < best.area) {
        best = { area, index: i, item: it };
      }
    }
  }

  return best ? { index: best.index, item: best.item } : null;
}

function findExistingMaterialized(
  fc: Canvas,
  index: number,
  role: "text" | "whiteout",
): TaggedObject | undefined {
  return fc.getObjects().find((o) => {
    const t = o as TaggedObject;

    return t.pdfTextIndex === index && t.pdfTextRole === role;
  }) as TaggedObject | undefined;
}

export function useTextEditTool({ fabricCanvas }: UseTextEditToolParams) {
  const activeTool = usePdfEditorStore((s) => s.activeTool);
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const items = usePdfEditorStore((s) =>
    s.extractedTextByPage.get(s.currentPage),
  );
  const pushHistory = usePdfEditorStore((s) => s.pushHistory);

  const classesRef = useRef<FabricClasses | null>(null);

  useEffect(() => {
    if (!fabricCanvas) return;
    if (activeTool !== "text-edit") return;

    let cancelled = false;

    (async () => {
      const mod = await import("fabric");

      if (cancelled) return;
      classesRef.current = { IText: mod.IText, Rect: mod.Rect };
    })();

    const fc = fabricCanvas;

    const handleMouseDown = (opt: TPointerEventInfo) => {
      if (!classesRef.current || !items) return;
      if (fc.getActiveObject()) return;

      const pointer = fc.getScenePoint(opt.e);
      const hit = findHitItem(items, pointer.x, pointer.y);

      if (!hit) return;

      const existing = findExistingMaterialized(fc, hit.index, "text");

      if (existing) {
        fc.setActiveObject(existing);
        (existing as IText & TaggedObject).enterEditing();
        fc.renderAll();

        return;
      }

      const { IText: FIText, Rect: FRect } = classesRef.current;
      const baselineY = hit.item.y;
      const emTop = baselineY - hit.item.fontSize;

      const whiteout = new FRect({
        evented: false,
        fill: "#FFFFFF",
        height: hit.item.fontSize,
        left: hit.item.x,
        originX: "left",
        originY: "top",
        selectable: false,
        top: emTop,
        width: hit.item.width,
      }) as Rect & TaggedObject;

      whiteout.pdfTextIndex = hit.index;
      whiteout.pdfTextRole = "whiteout";

      const textObj = new FIText(hit.item.str, {
        fill: "#000000",
        fontFamily: "Helvetica",
        fontSize: hit.item.fontSize,
        left: hit.item.x,
        lockScalingX: true,
        lockScalingY: true,
        originX: "left",
        originY: "top",
        top: baselineY - hit.item.fontSize * FABRIC_FONT_SIZE_MULT,
      }) as IText & TaggedObject;

      textObj.pdfTextIndex = hit.index;
      textObj.pdfTextRole = "text";

      fc.add(whiteout);
      fc.add(textObj);
      fc.setActiveObject(textObj);
      textObj.enterEditing();
      fc.renderAll();

      pushHistory(currentPage, JSON.stringify(fc.toJSON()));
    };

    fc.on("mouse:down", handleMouseDown);

    return () => {
      cancelled = true;
      fc.off("mouse:down", handleMouseDown);
    };
  }, [activeTool, fabricCanvas, items, currentPage, pushHistory]);
}
