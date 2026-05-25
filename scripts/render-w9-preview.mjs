#!/usr/bin/env node
/**
 * Renders page 1 of public/static/forms/fw9.pdf to a PNG at
 * public/static/forms/w9-preview.png. Re-run whenever fw9.pdf changes.
 *
 * macOS-first: uses `qlmanage` (Quick Look), which renders the W-9's XFA
 * layer correctly. On Linux, swap to `pdftocairo` / `pdftoppm` / `mutool`.
 *
 * Usage: node scripts/render-w9-preview.mjs
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PDF_PATH = path.join(ROOT, "public/static/forms/fw9.pdf");
const OUT_PATH = path.join(ROOT, "public/static/forms/w9-preview.png");
const TARGET_WIDTH = 1200;

if (process.platform !== "darwin") {
  console.error(
    "This script currently requires macOS (qlmanage). On Linux, install poppler and adapt to `pdftocairo -png -r 150 fw9.pdf out`.",
  );
  process.exit(1);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "w9-preview-"));

execFileSync("qlmanage", [
  "-t",
  "-s",
  String(TARGET_WIDTH),
  "-o",
  tmpDir,
  PDF_PATH,
]);

const generated = path.join(tmpDir, "fw9.pdf.png");

if (!fs.existsSync(generated)) {
  console.error(`qlmanage did not produce ${generated}`);
  process.exit(1);
}

fs.copyFileSync(generated, OUT_PATH);
fs.rmSync(tmpDir, { recursive: true, force: true });

const { size } = fs.statSync(OUT_PATH);

console.log(
  `Wrote ${(size / 1024).toFixed(1)} KB → ${path.relative(ROOT, OUT_PATH)}`,
);
