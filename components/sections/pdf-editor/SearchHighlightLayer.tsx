"use client";

import { usePdfSearchStore } from "@/lib/client/stores/pdf-search-store";

type Props = {
  currentPage: number;
  zoom: number;
};

// Lazy-initialised offscreen canvas for measuring text proportions.
// Module-level singleton — safe in "use client" because this module only
// ever loads in the browser. Created on first use, reused across renders.
let _measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (_measureCtx !== null) return _measureCtx;
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.font = "16px sans-serif";
    _measureCtx = ctx;
  }

  return _measureCtx;
}

/**
 * Renders translucent highlight rects over text matches on the current page.
 * Positioned absolutely inside the `containerRef` div in PdfViewerCanvas
 * (which is `position: relative`).
 *
 * Coordinate maths:
 *   PDF coordinates: origin bottom-left, y grows upward, units = points.
 *   CSS coordinates: origin top-left, y grows downward, units = px at `zoom`.
 *
 *   For a text item with baseline at (tx, ty) in PDF space:
 *     cssLeft = tx * zoom
 *     cssTop  = (pageHeight − ty − itemHeight) * zoom
 *
 * Character-level x-offsets within a single item use canvas measureText
 * (sans-serif proxy) for variable-width font accuracy instead of the naive
 * uniform char-count assumption. Falls back to char-count when document
 * is unavailable (SSR path, though this is a client-only component).
 */
export function SearchHighlightLayer({ currentPage, zoom }: Props) {
  const { isOpen, query, matches, currentMatchIndex, textIndex } =
    usePdfSearchStore();

  if (!isOpen || !query.trim()) return null;

  const pageData = textIndex.get(currentPage);

  if (!pageData) return null;

  const pageMatches = matches.filter((m) => m.displayPage === currentPage);

  if (pageMatches.length === 0) return null;

  const { items, pageHeight } = pageData;
  const ctx = getMeasureCtx();

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {pageMatches.map((match) => {
        const globalIdx = matches.indexOf(match);
        const isActive = globalIdx === currentMatchIndex;

        return match.spans.map((span, si) => {
          const item = items[span.itemIndex];

          if (!item || item.height <= 0) return null;

          const tx = item.transform[4];
          const ty = item.transform[5];

          // Convert PDF → CSS coordinates at current zoom.
          const cssLeft = tx * zoom;
          const cssTop = (pageHeight - ty - item.height) * zoom;
          const fullWidth = item.width * zoom;
          const cssHeight = Math.max(item.height * zoom, 8);

          // Use canvas measureText (sans-serif proxy) to compute proportional
          // widths for variable-width fonts instead of the naive char-count
          // ratio. This fixes highlight overflow when unmatched chars are wider
          // than matched chars (e.g. "CAT" in "CAT5" where "5" occupies more
          // advance width than its 1/4 char-count share). Falls back to uniform
          // char-count when the context is unavailable.
          const str = item.str;
          let preRatio = span.charStart / (str.length || 1);
          let spanRatio = (span.charEnd - span.charStart) / (str.length || 1);

          if (ctx && str.length > 1) {
            const totalW = ctx.measureText(str).width;

            if (totalW > 0) {
              preRatio =
                span.charStart > 0
                  ? ctx.measureText(str.slice(0, span.charStart)).width / totalW
                  : 0;
              spanRatio =
                ctx.measureText(str.slice(span.charStart, span.charEnd)).width /
                totalW;
            }
          }

          const preX = fullWidth * preRatio;
          const spanW = Math.max(fullWidth * spanRatio, 4);

          return (
            <div
              key={`${globalIdx}-${si}`}
              className="absolute rounded-sm"
              style={{
                height: cssHeight + 4,
                left: cssLeft + preX,
                top: cssTop - 2,
                transition: "background 0.12s",
                width: spanW,
                background: isActive
                  ? "rgba(255, 115, 0, 0.38)"
                  : "rgba(255, 210, 0, 0.38)",
                outline: isActive
                  ? "1.5px solid rgba(255, 115, 0, 0.65)"
                  : "none",
              }}
            />
          );
        });
      })}
    </div>
  );
}
