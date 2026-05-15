import type { Color, PDFFont, PDFPage } from "pdf-lib";
import type { FontCache } from "./font-mapping";

import {
  beginText,
  degrees,
  endText,
  LineCapStyle,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  setFillingColor,
  setFontAndSize,
  setTextMatrix,
  showText,
} from "pdf-lib";

import { hexToPdfColor } from "./color-utils";
import {
  toPdfDim,
  toPdfX,
  toPdfY,
  type CoordinateContext,
} from "./coordinate-transform";
import {
  fabricPathToSvgString,
  transformPathCoords,
  triangleToSvgPath,
} from "./svg-path-utils";

type FabricObj = Record<string, any>;

// ---------------------------------------------------------------------------
// Origin resolution — Fabric objects can have originX/Y of "left"/"center"/"right"
// We need the true top-left corner for PDF drawing.
// ---------------------------------------------------------------------------

function resolveTopLeft(obj: FabricObj): { left: number; top: number } {
  const left = (obj.left as number) || 0;
  const top = (obj.top as number) || 0;
  const width = ((obj.width as number) || 0) * ((obj.scaleX as number) ?? 1);
  const height = ((obj.height as number) || 0) * ((obj.scaleY as number) ?? 1);
  const originX = (obj.originX as string) || "left";
  const originY = (obj.originY as string) || "top";

  let resolvedLeft = left;
  let resolvedTop = top;

  if (originX === "center") resolvedLeft = left - width / 2;
  else if (originX === "right") resolvedLeft = left - width;

  if (originY === "center") resolvedTop = top - height / 2;
  else if (originY === "bottom") resolvedTop = top - height;

  return { left: resolvedLeft, top: resolvedTop };
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export async function drawIText(
  obj: FabricObj,
  page: PDFPage,
  ctx: CoordinateContext,
  fontCache: FontCache,
): Promise<void> {
  const text = obj.text as string | undefined;

  if (!text) return;

  const fontFamily = (obj.fontFamily as string) || "Helvetica";
  const fontWeight = (obj.fontWeight as string) || "normal";
  const fontStyle = (obj.fontStyle as string) || "normal";
  const objScaleX = (obj.scaleX as number) ?? 1;
  const objScaleY = (obj.scaleY as number) ?? 1;
  const baseFontSize = (obj.fontSize as number) || 16;
  const fontSize = baseFontSize * objScaleY;
  const opacity = (obj.opacity as number) ?? 1;
  const angle = (obj.angle as number) || 0;

  // The object's bounding box width in Fabric units (what the user sees as the text container)
  const objWidth = ((obj.width as number) || 0) * objScaleX;
  const editorType = (obj.editorType as string) || "";

  const { left, top } = resolveTopLeft(obj);

  const font = await fontCache.getFont(fontFamily, fontWeight, fontStyle);
  const color = hexToPdfColor(obj.fill as string) ?? rgb(0, 0, 0);

  const pdfFontSize = toPdfDim(fontSize, ctx.scaleY);
  const fontHeight = font.heightAtSize(pdfFontSize, { descender: false });

  // For extracted PDF text items, skip maxWidth — their position is controlled
  // by precise x/y coordinates, not text wrapping. maxWidth would cause pdf-lib
  // to compress text when its font metrics differ from the original PDF's.
  const pdfMaxWidth =
    editorType === "editModeText"
      ? undefined
      : objWidth > 0
        ? toPdfDim(objWidth, ctx.scaleX)
        : undefined;

  const pdfX = toPdfX(left, ctx);
  const pdfY = ctx.pdfHeight - toPdfDim(top, ctx.scaleY) - fontHeight;

  // Compute what pdf-lib thinks the text width is vs what Fabric reported
  const pdfLibTextWidth = font.widthOfTextAtSize(text, pdfFontSize);
  const fabricReportedWidth = toPdfDim(objWidth, ctx.scaleX);

  if (editorType === "editModeText") {
    console.log(`[DrawIText] "${text.slice(0, 40)}" | font=${fontFamily} w=${fontWeight} s=${fontStyle} | fabricLeft=${left} fabricTop=${top} | objWidth=${objWidth} scaleX=${objScaleX} scaleY=${objScaleY} | baseFontSize=${baseFontSize} computedFontSize=${fontSize} | pdfFontSize=${pdfFontSize.toFixed(2)} | pdfX=${pdfX.toFixed(2)} pdfY=${pdfY.toFixed(2)} | fontHeight=${fontHeight.toFixed(2)} | pdfLibTextWidth=${pdfLibTextWidth.toFixed(2)} fabricWidth(pdf)=${fabricReportedWidth.toFixed(2)} | maxWidth=${pdfMaxWidth?.toFixed(2) ?? "none"} | ctx: fabricW=${ctx.fabricWidth} fabricH=${ctx.fabricHeight} pdfW=${ctx.pdfWidth} pdfH=${ctx.pdfHeight} scX=${ctx.scaleX.toFixed(4)} scY=${ctx.scaleY.toFixed(4)}`);
  }

  const lines = text.split("\n");
  const lineHeight = (obj.lineHeight as number) ?? 1.16;
  const pdfLineHeight = pdfFontSize * lineHeight;

  // For extracted PDF text, use raw operators with horizontal scaling to match
  // the original text width. pdf-lib/fontkit calculates narrower widths than
  // the browser's font renderer for the same font bytes, so we stretch to
  // compensate.
  if (editorType === "editModeText" && pdfLibTextWidth > 0 && fabricReportedWidth > 0) {
    const hScale = fabricReportedWidth / pdfLibTextWidth;

    // Register font on the page and get its PDF resource name
    const fontKey = page.node.newFontDictionary(font.name, font.ref);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!line) continue;

      const lineY = pdfY - i * pdfLineHeight;
      const encodedText = font.encodeText(line);

      page.pushOperators(
        pushGraphicsState(),
        beginText(),
        setFillingColor(color),
        setFontAndSize(fontKey, pdfFontSize),
        setTextMatrix(hScale, 0, 0, 1, pdfX, lineY),
        showText(encodedText),
        endText(),
        popGraphicsState(),
      );
    }
  } else {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!line) continue; // skip blank lines (Y still advances via index)

      page.drawText(line, {
        color,
        font,
        maxWidth: pdfMaxWidth,
        opacity,
        rotate: angle ? degrees(-angle) : undefined,
        size: pdfFontSize,
        x: pdfX,
        y: pdfY - i * pdfLineHeight,
      });
    }
  }

  // Underline simulation
  if (obj.underline) {
    const underlineOffset = pdfFontSize * 0.1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!line) continue;

      const lineWidth = font.widthOfTextAtSize(line, pdfFontSize);
      const lineY = pdfY - i * pdfLineHeight - underlineOffset;

      page.drawLine({
        color,
        end: { x: pdfX + lineWidth, y: lineY },
        opacity,
        start: { x: pdfX, y: lineY },
        thickness: Math.max(0.5, pdfFontSize * 0.05),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Rectangle
// ---------------------------------------------------------------------------

export function drawRect(
  obj: FabricObj,
  page: PDFPage,
  ctx: CoordinateContext,
): void {
  const width = ((obj.width as number) || 0) * ((obj.scaleX as number) ?? 1);
  const height = ((obj.height as number) || 0) * ((obj.scaleY as number) ?? 1);
  const opacity = (obj.opacity as number) ?? 1;
  const angle = (obj.angle as number) || 0;

  const { left, top } = resolveTopLeft(obj);

  const pdfX = toPdfX(left, ctx);
  const pdfY = toPdfY(top, height, ctx);
  const pdfW = toPdfDim(width, ctx.scaleX);
  const pdfH = toPdfDim(height, ctx.scaleY);

  const editorType = obj.editorType as string | undefined;

  let fillColor: Color | null = null;
  let borderColor: Color | null = null;
  let borderWidth = 0;

  if (editorType === "whiteout") {
    fillColor = rgb(1, 1, 1);
  } else if (editorType === "highlight") {
    fillColor = hexToPdfColor(obj.fill as string);
  } else {
    fillColor = hexToPdfColor(obj.fill as string);
    borderColor = hexToPdfColor(obj.stroke as string);
    borderWidth = toPdfDim(
      (obj.strokeWidth as number) || 0,
      (ctx.scaleX + ctx.scaleY) / 2,
    );
  }

  page.drawRectangle({
    borderColor: borderColor ?? undefined,
    borderWidth: borderWidth || undefined,
    color: fillColor ?? undefined,
    height: pdfH,
    opacity,
    rotate: angle ? degrees(-angle) : undefined,
    width: pdfW,
    x: pdfX,
    y: pdfY,
  });
}

// ---------------------------------------------------------------------------
// Ellipse
// ---------------------------------------------------------------------------

export function drawEllipse(
  obj: FabricObj,
  page: PDFPage,
  ctx: CoordinateContext,
): void {
  const rx = ((obj.rx as number) || 0) * ((obj.scaleX as number) ?? 1);
  const ry = ((obj.ry as number) || 0) * ((obj.scaleY as number) ?? 1);
  const opacity = (obj.opacity as number) ?? 1;
  const angle = (obj.angle as number) || 0;

  const { left, top } = resolveTopLeft(obj);

  // Ellipse top-left resolved → center = left+rx, top+ry
  const centerX = left + rx;
  const centerY = top + ry;

  const pdfCenterX = toPdfX(centerX, ctx);
  const pdfCenterY = ctx.pdfHeight - toPdfDim(centerY, ctx.scaleY);
  const pdfRx = toPdfDim(rx, ctx.scaleX);
  const pdfRy = toPdfDim(ry, ctx.scaleY);

  const fillColor = hexToPdfColor(obj.fill as string);
  const borderColor = hexToPdfColor(obj.stroke as string);
  const borderWidth = toPdfDim(
    (obj.strokeWidth as number) || 0,
    (ctx.scaleX + ctx.scaleY) / 2,
  );

  page.drawEllipse({
    borderColor: borderColor ?? undefined,
    borderWidth: borderWidth || undefined,
    color: fillColor ?? undefined,
    opacity,
    rotate: angle ? degrees(-angle) : undefined,
    x: pdfCenterX,
    xScale: pdfRx,
    y: pdfCenterY,
    yScale: pdfRy,
  });
}

// ---------------------------------------------------------------------------
// Line
// ---------------------------------------------------------------------------

export function drawLine(
  obj: FabricObj,
  page: PDFPage,
  ctx: CoordinateContext,
): void {
  const x1 = (obj.x1 as number) || 0;
  const y1 = (obj.y1 as number) || 0;
  const x2 = (obj.x2 as number) || 0;
  const y2 = (obj.y2 as number) || 0;
  const scaleX = (obj.scaleX as number) ?? 1;
  const scaleY = (obj.scaleY as number) ?? 1;
  const opacity = (obj.opacity as number) ?? 1;

  const { left, top } = resolveTopLeft(obj);

  // Fabric Line stores x1,y1,x2,y2 relative to the object center.
  // The object's left,top positions the bounding box top-left.
  // The actual endpoints in canvas space:
  const startX = left + (x1 - Math.min(x1, x2)) * scaleX;
  const startY = top + (y1 - Math.min(y1, y2)) * scaleY;
  const endX = left + (x2 - Math.min(x1, x2)) * scaleX;
  const endY = top + (y2 - Math.min(y1, y2)) * scaleY;

  const color = hexToPdfColor(obj.stroke as string);
  const thickness = toPdfDim(
    (obj.strokeWidth as number) || 1,
    (ctx.scaleX + ctx.scaleY) / 2,
  );

  page.drawLine({
    color: color ?? rgb(0, 0, 0),
    end: {
      x: toPdfX(endX, ctx),
      y: ctx.pdfHeight - toPdfDim(endY, ctx.scaleY),
    },
    lineCap: LineCapStyle.Round,
    opacity,
    start: {
      x: toPdfX(startX, ctx),
      y: ctx.pdfHeight - toPdfDim(startY, ctx.scaleY),
    },
    thickness,
  });
}

// ---------------------------------------------------------------------------
// Path (freehand drawing)
// ---------------------------------------------------------------------------

export function drawPath(
  obj: FabricObj,
  page: PDFPage,
  ctx: CoordinateContext,
): void {
  const pathArray = obj.path as (number | string)[][] | undefined;

  if (!pathArray?.length) return;

  const scaleX = (obj.scaleX as number) ?? 1;
  const scaleY = (obj.scaleY as number) ?? 1;
  const opacity = (obj.opacity as number) ?? 1;

  const { left, top } = resolveTopLeft(obj);

  // Fabric Path stores path coords relative to the path's own bounding box.
  // pathOffset is the center of the path in its local coordinate system.
  const pathOffsetX = (obj.pathOffset?.x as number) || 0;
  const pathOffsetY = (obj.pathOffset?.y as number) || 0;

  // Transform path coords: scale by object's scale and canvas-to-PDF scale,
  // then Y-flip for PDF coordinate system.
  const totalScaleX = scaleX * ctx.scaleX;
  const totalScaleY = scaleY * ctx.scaleY;

  const transformed = transformPathCoords(pathArray, totalScaleX, -totalScaleY);
  const svgPath = fabricPathToSvgString(transformed);

  // Position: the path's origin in PDF space.
  // left/top is the bounding box top-left in Fabric (after origin resolution).
  // pathOffset is the center of the path data — we need to translate so that
  // the transformed path lands at the correct position.
  const pdfX = toPdfX(left, ctx) + toPdfDim(pathOffsetX * scaleX, ctx.scaleX);
  const pdfY =
    ctx.pdfHeight -
    toPdfDim(top, ctx.scaleY) -
    toPdfDim(pathOffsetY * scaleY, ctx.scaleY);

  const strokeColor = hexToPdfColor(obj.stroke as string);
  const fillColor = hexToPdfColor(obj.fill as string);
  const borderWidth = toPdfDim(
    (obj.strokeWidth as number) || 1,
    (ctx.scaleX + ctx.scaleY) / 2,
  );

  page.drawSvgPath(svgPath, {
    borderColor: strokeColor ?? rgb(0, 0, 0),
    borderLineCap: LineCapStyle.Round,
    borderWidth: borderWidth,
    color: fillColor ?? undefined,
    opacity,
    x: pdfX,
    y: pdfY,
  });
}

// ---------------------------------------------------------------------------
// Triangle (standalone or arrowhead)
// ---------------------------------------------------------------------------

export function drawTriangle(
  obj: FabricObj,
  page: PDFPage,
  ctx: CoordinateContext,
): void {
  const width = ((obj.width as number) || 0) * ((obj.scaleX as number) ?? 1);
  const height = ((obj.height as number) || 0) * ((obj.scaleY as number) ?? 1);
  const angle = (obj.angle as number) || 0;
  const opacity = (obj.opacity as number) ?? 1;

  // Triangle uses originX/Y "center" — resolveTopLeft gives us top-left,
  // but drawSvgPath for triangle is centered at (0,0), so we need center.
  const originX = (obj.originX as string) || "left";
  const originY = (obj.originY as string) || "top";
  const rawLeft = (obj.left as number) || 0;
  const rawTop = (obj.top as number) || 0;

  let centerX = rawLeft;
  let centerY = rawTop;

  if (originX === "left") centerX = rawLeft + width / 2;
  else if (originX === "right") centerX = rawLeft - width / 2;

  if (originY === "top") centerY = rawTop + height / 2;
  else if (originY === "bottom") centerY = rawTop - height / 2;

  const svgPath = triangleToSvgPath(
    toPdfDim(width, ctx.scaleX),
    toPdfDim(height, ctx.scaleY),
  );

  const pdfX = toPdfX(centerX, ctx);
  const pdfY = ctx.pdfHeight - toPdfDim(centerY, ctx.scaleY);

  const fillColor = hexToPdfColor(obj.fill as string);
  const borderColor = hexToPdfColor(obj.stroke as string);
  const borderWidth = toPdfDim(
    (obj.strokeWidth as number) || 0,
    (ctx.scaleX + ctx.scaleY) / 2,
  );

  page.drawSvgPath(svgPath, {
    borderColor: borderColor ?? undefined,
    borderWidth: borderWidth || undefined,
    color: fillColor ?? undefined,
    opacity,
    rotate: angle ? degrees(-angle) : undefined,
    x: pdfX,
    y: pdfY,
  });
}

// ---------------------------------------------------------------------------
// Group (arrows: Line + Triangle composite)
// ---------------------------------------------------------------------------

export async function drawGroup(
  obj: FabricObj,
  page: PDFPage,
  ctx: CoordinateContext,
  fontCache: FontCache,
): Promise<boolean> {
  const children = obj.objects as FabricObj[] | undefined;

  if (!children?.length) return false;

  // The group's left/top positions the group bounding box center in Fabric
  const groupLeft = (obj.left as number) || 0;
  const groupTop = (obj.top as number) || 0;
  const groupScaleX = (obj.scaleX as number) ?? 1;
  const groupScaleY = (obj.scaleY as number) ?? 1;

  for (const child of children) {
    const childType = (child.type as string).toLowerCase();

    // Apply group transform: children are positioned relative to group center.
    // Group's left/top is the center of the group in Fabric canvas space.
    // Child's left/top is offset from group center.
    const resolvedChild = {
      ...child,
      left: groupLeft + ((child.left as number) || 0) * groupScaleX,
      scaleX: ((child.scaleX as number) ?? 1) * groupScaleX,
      scaleY: ((child.scaleY as number) ?? 1) * groupScaleY,
      top: groupTop + ((child.top as number) || 0) * groupScaleY,
    };

    switch (childType) {
      case "line":
        drawLine(resolvedChild, page, ctx);
        break;
      case "triangle":
        drawTriangle(resolvedChild, page, ctx);
        break;
      case "rect":
        drawRect(resolvedChild, page, ctx);
        break;
      case "ellipse":
        drawEllipse(resolvedChild, page, ctx);
        break;
      case "i-text":
      case "itext":
      case "text":
      case "textbox":
        await drawIText(resolvedChild, page, ctx, fontCache);
        break;
      case "path":
        drawPath(resolvedChild, page, ctx);
        break;
      default:
        // Unknown child type — signal that this group can't be fully vectorized
        return false;
    }
  }

  return true;
}
