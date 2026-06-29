/**
 * Data-driven decorative tile grid for the hero background.
 *
 * The whole pattern is generated from the config below — nothing is hardcoded
 * in pixels. Change `COLUMNS`, `CELL_PX`, or `FILLED_TILES` and the grid + the
 * light grid-lines stay aligned automatically.
 *
 * - The grid is `COLUMNS` equal (1fr) columns wide and responsive: cells shrink
 *   with the viewport but stay identical to one another.
 * - Grid lines are drawn with repeating gradients aligned to the same column
 *   fraction and row height, so they always line up with the filled tiles.
 * - Filled tiles are placed by 1-based { col, row } with optional spans, in the
 *   hero-box border colour (Gray 3). "Big" tiles are simply a 2×2 span.
 */

const COLUMNS = 16;
const CELL_PX = 90;

type FilledTile = {
  col: number;
  row: number;
  colSpan?: number;
  rowSpan?: number;
};

// Filled-cell map. Cells are uniform (the reference PDF shows identical-size
// tiles); only the listed cells get the light-grey fill.
const FILLED_TILES: FilledTile[] = [
  // Row 1: the 6th tile and one near the right.
  { col: 6, row: 1 },
  { col: 14, row: 1 },
  // Row 2: only the 3rd tile.
  { col: 3, row: 2 },
  // Row 3: only the 2nd tile.
  { col: 2, row: 3 },
  // Row 4: the 4th from the left and the 4th from the right.
  { col: 4, row: 4 },
  { col: COLUMNS - 3, row: 4 },
];

export function HeroTileGrid() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {/* Light, thin grid lines — aligned to the same column fraction + row height. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(to right, var(--pv-gray-3) 0 1px, transparent 1px calc(100% / ${COLUMNS})), repeating-linear-gradient(to bottom, var(--pv-gray-3) 0 1px, transparent 1px ${CELL_PX}px)`,
          opacity: 0.3,
        }}
      />

      {/* Filled tiles on the same grid system. */}
      <div
        className="absolute inset-0 grid"
        style={{
          gridTemplateColumns: `repeat(${COLUMNS}, 1fr)`,
          gridAutoRows: `${CELL_PX}px`,
        }}
      >
        {FILLED_TILES.map((tile) => (
          <span
            key={`${tile.col}-${tile.row}`}
            className="bg-[var(--pv-gray-3)]"
            style={{
              gridColumn: `${tile.col} / span ${tile.colSpan ?? 1}`,
              gridRow: `${tile.row} / span ${tile.rowSpan ?? 1}`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
