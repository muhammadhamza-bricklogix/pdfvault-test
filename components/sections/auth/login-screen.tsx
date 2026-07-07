import Image from "next/image";
import Link from "next/link";

import { ROUTES } from "@/lib/shared/constants/routes";

import { LoginCard } from "./login-card";
import { LoginLanguageMenu } from "./login-language-menu";

// Cell size for the subtle background grid (per the design: ~94.5px at 1512).
const CELL_PX = 94.5;

// Sparse pale-gray filled tiles, traced from the reference distribution
// (asymmetric, not a checkerboard). 1-based { col, row } on the CELL_PX lattice.
const FILLED_TILES: { col: number; row: number }[] = [
  { col: 4, row: 1 },
  { col: 11, row: 1 },
  { col: 2, row: 2 },
  { col: 3, row: 4 },
  { col: 10, row: 3 },
  { col: 9, row: 5 },
  { col: 3, row: 6 },
  { col: 6, row: 7 },
  { col: 13, row: 6 },
];

/**
 * Subtle square grid with a few pale filled tiles. Pure CSS/DOM (no raster
 * asset exists for it) and decorative — hidden from assistive tech and never
 * intercepts pointer events. Per the reference, the pattern does NOT bleed
 * into the header band: it starts below the menu bar (clean strip up top),
 * so the layer is offset by the header height rather than inset-0. The -1px
 * background offset keeps the first horizontal line from rendering as a
 * border glued to the header's bottom edge.
 */
function LoginBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 top-[56px] z-0 overflow-hidden"
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(232,232,232,0.34) 1px, transparent 1px), linear-gradient(to bottom, rgba(232,232,232,0.34) 1px, transparent 1px)",
          backgroundPosition: "0 -1px",
          backgroundSize: `${CELL_PX}px ${CELL_PX}px`,
        }}
      />
      {FILLED_TILES.map((tile) => (
        <span
          key={`${tile.col}-${tile.row}`}
          className="absolute bg-[#f5f5f5]"
          style={{
            left: (tile.col - 1) * CELL_PX,
            top: (tile.row - 1) * CELL_PX,
            width: CELL_PX,
            height: CELL_PX,
          }}
        />
      ))}
    </div>
  );
}

export function LoginScreen() {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#fdfdfd]">
      <LoginBackground />

      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-[1226px] items-center justify-between px-6 pt-4 sm:px-10">
          <Link
            aria-label="PDFVault home"
            className="inline-flex"
            href={ROUTES.PUBLIC.HOME}
          >
            <Image
              priority
              alt="PDFVault"
              className="h-[26px] w-auto object-contain"
              height={26}
              src="/landing/logo-with-text.png"
              width={104}
            />
          </Link>
          <LoginLanguageMenu />
        </div>
      </header>

      <main className="relative z-10 flex min-h-[100dvh] items-center justify-center px-4 py-24">
        <LoginCard />
      </main>
    </div>
  );
}
