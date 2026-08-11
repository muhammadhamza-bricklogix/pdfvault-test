"use client";

import { usePdfSearchStore } from "@/lib/client/stores/pdf-search-store";

type Props = {
  currentPage: number;
  zoom: number;
};

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
 * Character-level x-offsets within a single item are approximated
 * proportionally (uniform glyph-width assumption).
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

          // Proportional x-offset for partial item matches.
          const totalChars = item.str.length || 1;
          const preX = fullWidth * (span.charStart / totalChars);
          const spanW = Math.max(
            fullWidth * ((span.charEnd - span.charStart) / totalChars),
            4,
          );

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
