import type { Color, PDFPage } from "pdf-lib";
import type { FontCache } from "./font-mapping";

import {
  beginText,
  degrees,
  endText,
  LineCapStyle,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  rotateAndSkewTextDegreesAndTranslate,
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

  // For angle == 0 the original formula puts pdfY at fontHeight (font ascend
  // height, NOT fontSize) below the top — preserving that for upright text
  // avoids drift. For rotated text we apply the same ascend shift but along
  // the rotated axis. `ascendFabric` is the ascend in Fabric units so that
  // (top + ascendFabric) → top + fontHeight at PDF scale, matching the
  // upright formula exactly when angle == 0.
  const ascendFabric = fontHeight / ctx.scaleY;
  let fabricBaselineX = left;
  let fabricBaselineY = top + ascendFabric;

  if (angle === 90) {
    fabricBaselineX = left + ascendFabric;
    fabricBaselineY = top;
  } else if (angle === 180) {
    fabricBaselineX = left;
    fabricBaselineY = top - ascendFabric;
  } else if (angle === 270) {
    fabricBaselineX = left - ascendFabric;
    fabricBaselineY = top;
  }

  const pdfX = toPdfX(fabricBaselineX, ctx);
  const pdfY = ctx.pdfHeight - toPdfDim(fabricBaselineY, ctx.scaleY);

  // Unit advance vector in PDF coords for the text-flow direction.
  // For Fabric angle R (CW in screen), PDF math rotation is -R.
  //   angle 0   → ( 1,  0)
  //   angle 90  → ( 0, -1)
  //   angle 180 → (-1,  0)
  //   angle 270 → ( 0,  1)
  const angleRad = (-angle * Math.PI) / 180;
  const advanceX = Math.cos(angleRad);
  const advanceY = Math.sin(angleRad);
  // Next-line offset is the advance vector rotated −90° (lines flow below the
  // current one in screen terms). 0: (0,-1); 90: (-1,0); 180: (0,1); 270: (1,0).
  const nextLineX = advanceY;
  const nextLineY = -advanceX;

  // Compute what pdf-lib/fontkit thinks the text width is
  const pdfLibTextWidth = font.widthOfTextAtSize(text, pdfFontSize);
  // Use Fabric's obj.width as the target — it's what the user sees on screen.
  // This correctly reflects both unedited text AND user edits (added/removed words).
  const fabricObjWidth = toPdfDim(objWidth, ctx.scaleX);
  const targetWidth = fabricObjWidth;

  if (editorType === "editModeText") {
    console.log(
      `[DrawIText] "${text.slice(0, 40)}" | fabricObjWidth=${fabricObjWidth.toFixed(2)} targetWidth=${targetWidth.toFixed(2)} pdfLibWidth=${pdfLibTextWidth.toFixed(2)} | gap(target-pdfLib)=${(targetWidth - pdfLibTextWidth).toFixed(2)} gap(fabric-pdfLib)=${(fabricObjWidth - pdfLibTextWidth).toFixed(2)}`,
    );
  }

  const lines = text.split("\n");
  const lineHeight = (obj.lineHeight as number) ?? 1.16;
  const pdfLineHeight = pdfFontSize * lineHeight;

  // For extracted PDF text, split by spaces and position each word individually.
  // pdf.js font subsets often omit the space glyph (PDF uses positioning operators
  // instead of space characters), so rendering the full string collapses spaces to
  // zero width. Instead, we measure each word with fontkit, compute the leftover
  // width (fabricWidth - totalWordWidth) and distribute it evenly as inter-word gaps.
  if (editorType === "editModeText" && targetWidth > 0) {
    const fontKey = page.node.newFontDictionary(font.name, font.ref);

    // Text matrix factory: identity rotation for angle 0, rotation matrix
    // otherwise. PDF rotations are CCW-positive while Fabric angle is
    // CW-positive in screen, so we pass -angle.
    const textMatrixAt = (x: number, y: number) =>
      angle === 0
        ? setTextMatrix(1, 0, 0, 1, x, y)
        : rotateAndSkewTextDegreesAndTranslate(-angle, 0, 0, x, y);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!line) continue;

      // Per-line baseline: advance from (pdfX, pdfY) along the next-line
      // direction. For angle 0 this collapses to pdfY - i * pdfLineHeight.
      const lineX = pdfX + i * pdfLineHeight * nextLineX;
      const lineY = pdfY + i * pdfLineHeight * nextLineY;
      const words = line.split(" ");

      if (words.length <= 1) {
        // Single word — no space issue, draw directly
        page.pushOperators(
          pushGraphicsState(),
          beginText(),
          setFillingColor(color),
          setFontAndSize(fontKey, pdfFontSize),
          textMatrixAt(lineX, lineY),
          showText(font.encodeText(line)),
          endText(),
          popGraphicsState(),
        );
      } else {
        // Multiple words — measure each, distribute remaining width as spaces.
        // Filter out empty strings from split (leading/trailing spaces produce
        // them) to avoid inflating the space count. Trailing space in the
        // original text is positional padding between PDF fragments — it must
        // NOT be redistributed among visible word gaps.
        const nonEmptyWords = words.filter((w) => w.length > 0);

        if (nonEmptyWords.length <= 1) {
          // After filtering, only one word — draw directly
          const singleWord = nonEmptyWords[0] || line;

          page.pushOperators(
            pushGraphicsState(),
            beginText(),
            setFillingColor(color),
            setFontAndSize(fontKey, pdfFontSize),
            textMatrixAt(lineX, lineY),
            showText(font.encodeText(singleWord)),
            endText(),
            popGraphicsState(),
          );
        } else {
          const wordWidths = nonEmptyWords.map((w) =>
            font.widthOfTextAtSize(w, pdfFontSize),
          );
          const totalWordWidth = wordWidths.reduce((a, b) => a + b, 0);

          // Count leading spaces to offset the cursor start
          let leadingSpaces = 0;

          for (let s = 0; s < words.length; s++) {
            if (words[s] === "") leadingSpaces++;
            else break;
          }

          // Estimate width of one space from the original text metrics:
          // total spaces in text = words.length - 1 (from split)
          // internal gaps = nonEmptyWords.length - 1
          const totalSpaces = words.length - 1;
          // Total space to fill = fabricWidth - word widths
          const totalSpaceWidth = targetWidth - totalWordWidth;

          // Distribute space width only among ALL original spaces (including
          // leading/trailing) to compute per-space width, then use that for
          // internal gaps. Leading/trailing spaces just offset the cursor.
          const perSpaceWidth =
            totalSpaces > 0 ? Math.max(0, totalSpaceWidth / totalSpaces) : 0;

          // 2D cursor — advances along the text-flow direction.
          const startOffset = leadingSpaces * perSpaceWidth;
          let cursorX = lineX + startOffset * advanceX;
          let cursorY = lineY + startOffset * advanceY;

          for (let w = 0; w < nonEmptyWords.length; w++) {
            page.pushOperators(
              pushGraphicsState(),
              beginText(),
              setFillingColor(color),
              setFontAndSize(fontKey, pdfFontSize),
              textMatrixAt(cursorX, cursorY),
              showText(font.encodeText(nonEmptyWords[w])),
              endText(),
              popGraphicsState(),
            );

            // Advance cursor: word width + one space gap (except after last word)
            const step =
              wordWidths[w] +
              (w < nonEmptyWords.length - 1 ? perSpaceWidth : 0);

            cursorX += step * advanceX;
            cursorY += step * advanceY;
          }
        }
      }
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
