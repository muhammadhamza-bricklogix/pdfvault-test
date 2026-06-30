import Image from "next/image";

/**
 * Hero background layer — the designer's transparent geometric grid export
 * (`/landing/hero-grid.png`, native 4320×2160 RGBA).
 *
 * The asset is pure-black at a very low alpha (empty field ≈ 10%, filled cells
 * ≈ 15%). Rendered raw it reads dark/grey, so it MUST be inverted: over the
 * white hero surface, `filter: invert(1)` turns the empty field pure white and
 * the filled cells into ≈ `#F7F7F7`, grid lines into ≈ `#FDFDFD` — matching the
 * reference exactly. Do not recreate this in CSS; it is a real designer asset.
 *
 * It renders at a fixed 1440×720, pinned to the top-centre of the hero, and is
 * cropped (never squashed) by the section's `overflow-hidden` at narrower
 * widths — `max-w-none` defeats the global `img { max-width: 100% }` so the
 * 90px grid scale is preserved on small screens. Kept inert and behind content
 * (`pointer-events-none`, `select-none`, `z-[-1]` inside the hero's isolated
 * stacking context).
 */
export function HeroBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-0 z-[-1] -translate-x-1/2 select-none"
    >
      <Image
        priority
        alt=""
        className="block h-[720px] w-[1440px] max-w-none object-fill invert"
        height={720}
        src="/landing/hero-grid.png"
        width={1440}
      />
    </div>
  );
}
