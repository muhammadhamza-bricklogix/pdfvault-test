/**
 * Render DS-82 pages to PNG, so the field layout can be read off the form and
 * injected widgets verified by eye.
 *
 * Renders in Node with pdfjs' legacy build plus @napi-rs/canvas (both already
 * in the dependency tree) — no browser and no native build step.
 *
 * Usage:
 *   node scripts/ds82-render-page.mjs [pdf] [outDir] [page...] [--scale=2]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createCanvas } from "@napi-rs/canvas";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith("--"));
const positional = args.filter((a) => !a.startsWith("--"));

const pdfPath = path.resolve(ROOT, positional[0] ?? "schemas/ds82-source.pdf");
const outDir = path.resolve(ROOT, positional[1] ?? "tmp/ds82-render");
const pageNos = positional.slice(2).map(Number).filter(Boolean);
const scale = Number(flags.find((f) => f.startsWith("--scale="))?.split("=")[1] ?? 2);

fs.mkdirSync(outDir, { recursive: true });

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

const doc = await pdfjs.getDocument({
  data: new Uint8Array(fs.readFileSync(pdfPath)),
  useSystemFonts: true,
  // No worker in Node; the legacy build runs inline.
  disableFontFace: true,
}).promise;

const list = pageNos.length
  ? pageNos
  : Array.from({ length: doc.numPages }, (_, i) => i + 1);

for (const n of list) {
  const page = await doc.getPage(n);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  const file = path.join(outDir, `page-${n}.png`);

  fs.writeFileSync(file, canvas.toBuffer("image/png"));
  console.log(`wrote ${file}  (${canvas.width}x${canvas.height} @ ${scale}x)`);
}
