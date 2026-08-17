// Tiny module-level cache for the last pointer position on the current
// Fabric canvas, in BASE (zoom = 1) coordinates. Fed by a mouse:move
// listener in `PdfViewerCanvas.tsx`, consumed by tools that want to place
// their object at the last cursor spot (signature, image, watermark, …).
//
// Kept out of the Zustand store on purpose — this changes every mouse
// move and would churn re-renders for every selector reader.

type LastPointer = {
  x: number;
  y: number;
  page: number;
};

let last: LastPointer | null = null;

export function setLastPointer(x: number, y: number, page: number) {
  last = { x, y, page };
}

export function getLastPointer(): LastPointer | null {
  return last;
}

export function clearLastPointer() {
  last = null;
}
