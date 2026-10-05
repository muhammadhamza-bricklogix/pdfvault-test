/**
 * Detect the DS-82's fillable boxes from a rendered page.
 *
 * The official DS-82 has no AcroForm widgets, and its labels are drawn as glyph
 * outlines rather than text, so neither the field list nor the text layer can
 * tell us where the boxes are. What the form does have is a strong visual
 * convention: every entry box is WHITE on a lavender panel. Scanning the render
 * for white rectangles recovers the geometry far more reliably than trying to
 * pick ruled borders out of ~23k vector path segments, most of which are letter
 * shapes.
 *
 * Coordinates are reported in PDF user space (origin bottom-left) so they can be
 * pasted straight into the field table that `build-ds82-template.mjs` consumes.
 *
 * Usage:
 *   node scripts/ds82-detect-boxes.mjs <png> <pageHeightPt> [--scale=2] [--min-w=18] [--min-h=9]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createCanvas, loadImage } from "@napi-rs/canvas";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flags = Object.fromEntries(
  args
    .filter((a) => a.startsWith("--"))
    .map((a) => a.replace(/^--/, "").split("=")),
);
const positional = args.filter((a) => !a.startsWith("--"));

const pngPath = path.resolve(ROOT, positional[0] ?? "tmp/ds82-render/page-5.png");
const pageHeightPt = Number(positional[1] ?? 792);
const scale = Number(flags.scale ?? 2);
const minW = Number(flags["min-w"] ?? 18);
const minH = Number(flags["min-h"] ?? 9);

const img = await loadImage(fs.readFileSync(pngPath));
const canvas = createCanvas(img.width, img.height);
const ctx = canvas.getContext("2d");

ctx.drawImage(img, 0, 0);

const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height);

/** A pixel counts as "inside a box" when it is near-white. */
const isWhite = (x, y) => {
  const i = (y * width + x) * 4;

  return data[i] > 243 && data[i + 1] > 243 && data[i + 2] > 243;
};

// Flood-fill white regions. Comb fields carry thin grey tick marks inside them,
// so the fill tolerates a 1px non-white gap by probing two pixels ahead.
const seen = new Uint8Array(width * height);
const regions = [];

for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    if (seen[y * width + x] || !isWhite(x, y)) continue;

    let minX = x;
    let maxX = x;
    let minY = y;
    let maxY = y;
    let count = 0;
    const stack = [[x, y]];

    seen[y * width + x] = 1;

    while (stack.length) {
      const [cx, cy] = stack.pop();

      count += 1;
      if (cx < minX) minX = cx;
      if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy;
      if (cy > maxY) maxY = cy;

      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [2, 0],
        [-2, 0],
      ]) {
        const nx = cx + dx;
        const ny = cy + dy;

        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (seen[ny * width + nx] || !isWhite(nx, ny)) continue;
        seen[ny * width + nx] = 1;
        stack.push([nx, ny]);
      }
    }

    const w = (maxX - minX + 1) / scale;
    const h = (maxY - minY + 1) / scale;

    // Reject slivers and the big white margins outside the panel.
    if (w < minW || h < minH || h > 60) continue;
    // Reject regions that are mostly empty bounding box (L-shapes, margins).
    if (count / ((maxX - minX + 1) * (maxY - minY + 1)) < 0.55) continue;

    regions.push({
      x: Math.round((minX / scale) * 10) / 10,
      // PNG y grows downward; PDF user space grows upward.
      y: Math.round((pageHeightPt - (maxY + 1) / scale) * 10) / 10,
      w: Math.round(w * 10) / 10,
      h: Math.round(h * 10) / 10,
    });
  }
}

regions.sort((a, b) => b.y - a.y || a.x - b.x);

/**
 * Page 5's entry boxes are COMBS — one cell per character, divided by thin grey
 * ticks. The fill therefore returns each cell separately, and a logical field is
 * the run of cells sitting on the same baseline with only a tick between them.
 * `--gap` is the widest tick we treat as "still the same field"; raise it if a
 * field comes back split, lower it if two neighbouring fields merge.
 */
const gap = Number(flags.gap ?? 0);

if (gap > 0) {
  const merged = [];

  for (const r of regions) {
    const prev = merged[merged.length - 1];
    const sameRow = prev && Math.abs(prev.y - r.y) <= 2 && Math.abs(prev.h - r.h) <= 2.5;
    const adjacent = prev && r.x - (prev.x + prev.w) <= gap && r.x >= prev.x;

    if (sameRow && adjacent) {
      prev.w = Math.round((r.x + r.w - prev.x) * 10) / 10;
      prev.cells = (prev.cells ?? 1) + 1;
      continue;
    }
    merged.push({ ...r });
  }
  regions.length = 0;
  regions.push(...merged);
}

console.log(`${path.basename(pngPath)} — ${regions.length} candidate boxes\n`);

let row = null;

for (const r of regions) {
  if (row === null || Math.abs(r.y - row) > 3) {
    row = r.y;
    console.log(`  --- y ≈ ${r.y} ---`);
  }
  console.log(
    `  { x: ${r.x}, y: ${r.y}, w: ${r.w}, h: ${r.h} },`.padEnd(50) +
      (r.cells ? `// ${r.cells} cells` : "//"),
  );
}
