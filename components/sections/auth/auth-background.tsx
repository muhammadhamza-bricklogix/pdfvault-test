// Cell size for the subtle background grid shared by the auth screens
// (per the designs: ~94.5px at the 1512 artboard).
export const AUTH_GRID_CELL_PX = 94.5;

// 1px grid lines; rgba(232,232,232,0.34) over the #fdfdfd page reads as the
// ~#f7f7f7 hairlines sampled from the reference exports.
const GRID_LINES =
  "linear-gradient(to right, rgba(232,232,232,0.34) 1px, transparent 1px), linear-gradient(to bottom, rgba(232,232,232,0.34) 1px, transparent 1px)";

export type AuthBackgroundTile = {
  /** Pale filled cell position in px, relative to the offset container. */
  left: number;
  top: number;
  /** Tile fill; the references use #f5f5f5 with the odd lighter one. */
  color?: string;
};

type AuthBackgroundProps = {
  /** Grid-line phase, e.g. "0 -1px" — offsets keep the first line from
   *  rendering as a border glued to the header's bottom edge. */
  backgroundPosition: string;
  /** Sparse filled tiles traced from the design export (asymmetric, not a
   *  checkerboard — positions are per-screen data, not derived). */
  tiles: AuthBackgroundTile[];
  /** Where the grid starts, in px from the viewport top. Per the references
   *  the pattern does NOT bleed into the header band: it starts below the
   *  menu bar, so the layer is offset by the header height, not inset-0. */
  top: number;
};

/**
 * Subtle square grid with a few pale filled tiles, shared by the login and
 * signup screens. Pure CSS/DOM (no raster asset exists for it) and decorative
 * — hidden from assistive tech and never intercepts pointer events.
 */
export function AuthBackground({
  backgroundPosition,
  tiles,
  top,
}: AuthBackgroundProps) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 z-0 overflow-hidden"
      style={{ top }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: GRID_LINES,
          backgroundPosition,
          backgroundSize: `${AUTH_GRID_CELL_PX}px ${AUTH_GRID_CELL_PX}px`,
        }}
      />
      {tiles.map((tile) => (
        <span
          key={`${tile.left}-${tile.top}`}
          className="absolute"
          style={{
            backgroundColor: tile.color ?? "#f5f5f5",
            height: AUTH_GRID_CELL_PX,
            left: tile.left,
            top: tile.top,
            width: AUTH_GRID_CELL_PX,
          }}
        />
      ))}
    </div>
  );
}
