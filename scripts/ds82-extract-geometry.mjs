/**
 * DS-82 geometry probe.
 *
 * The official DS-82 (eforms.state.gov, rev 04-2025) ships with an EMPTY
 * /Fields array — it is a print-and-write form, unlike the DS-11 which carries
 * 84 AcroForm widgets. `scripts/build-ds82-template.mjs` injects a widget layer
 * so the rest of the pipeline (extract -> build schema -> stamp -> fill) works
 * exactly as it does for DS-11. This script supplies the measurements that
 * injection needs.
 *
 * All of the artwork — the ruled boxes AND the labels, which are drawn as glyph
 * outlines rather than text — lives inside a /Form XObject per page, so the
 * page's own content stream is little more than `/Fm0 Do`. We therefore walk
 * into the XObjects, carrying the CTM through q/Q/cm and each XObject's own
 * /Matrix, and report every path in PAGE space.
 *
 * Usage:
 *   node scripts/ds82-extract-geometry.mjs [page...]     # default: 5 6
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

import { PDFDocument, PDFName, PDFDict, PDFArray } from "pdf-lib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PDF_PATH = path.join(ROOT, "schemas/ds82-source.pdf");

/** a x b, PDF matrix order. */
const mul = (a, b) => [
  a[0] * b[0] + a[1] * b[2],
  a[0] * b[1] + a[1] * b[3],
  a[2] * b[0] + a[3] * b[2],
  a[2] * b[1] + a[3] * b[3],
  a[4] * b[0] + a[5] * b[2] + b[4],
  a[4] * b[1] + a[5] * b[3] + b[5],
];
const apply = (m, x, y) => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];

function decode(stream) {
  if (!stream?.getContents) return "";
  const raw = Buffer.from(stream.getContents());
  const filter = stream.dict?.get(PDFName.of("Filter"))?.toString() ?? "";

  try {
    return filter.includes("FlateDecode")
      ? zlib.inflateSync(raw).toString("latin1")
      : raw.toString("latin1");
  } catch {
    return "";
  }
}

function pageStream(page) {
  const contents = page.node.context.lookup(page.node.get(PDFName.of("Contents")));

  if (contents instanceof PDFArray) {
    let out = "";

    for (let i = 0; i < contents.size(); i += 1) out += decode(contents.lookup(i)) + "\n";

    return out;
  }

  return decode(contents);
}

/**
 * Walk a content stream, collecting stroked/filled paths in page space.
 *
 * `Do` is handled INSIDE the operator loop, not in a second pass: the CTM at the
 * moment of the invocation is what positions the XObject, and a second pass
 * would lose it (every box then lands tens of points off).
 */
function walk(text, resources, ctm, out, depth = 0) {
  if (depth > 8) return;

  // No bare `.` alternative: it would match the spaces between operands, and
  // every one of them would clear the operand stack before its operator ran.
  const tokens =
    text.match(/\/[^\s/[\]<>(){}]+|[-+]?[0-9]*\.?[0-9]+|[A-Za-z'"*]+/g) ?? [];
  const stack = [];
  let m = ctm;
  let operands = [];
  let names = [];
  let cur = null;
  let start = null;

  const nums = (n) => operands.slice(-n).map(Number);

  for (const tok of tokens) {
    if (/^[-+]?\d*\.?\d+$/.test(tok)) {
      operands.push(tok);
      continue;
    }
    if (tok.startsWith("/")) {
      names.push(tok.slice(1));
      continue;
    }

    switch (tok) {
      case "q":
        stack.push(m);
        break;
      case "Q":
        m = stack.pop() ?? m;
        break;
      case "cm":
        if (operands.length >= 6) m = mul(nums(6), m);
        break;
      case "re":
        if (operands.length >= 4) {
          const [x, y, w, h] = nums(4);
          const a = apply(m, x, y);
          const b = apply(m, x + w, y + h);

          out.rects.push({
            x: Math.min(a[0], b[0]),
            y: Math.min(a[1], b[1]),
            w: Math.abs(b[0] - a[0]),
            h: Math.abs(b[1] - a[1]),
          });
          cur = null;
        }
        break;
      case "m":
        if (operands.length >= 2) {
          cur = apply(m, ...nums(2));
          start = cur;
        }
        break;
      case "l":
        if (operands.length >= 2 && cur) {
          const p = apply(m, ...nums(2));

          out.lines.push({ x1: cur[0], y1: cur[1], x2: p[0], y2: p[1] });
          cur = p;
        }
        break;
      case "h":
        if (cur && start) {
          out.lines.push({ x1: cur[0], y1: cur[1], x2: start[0], y2: start[1] });
          cur = start;
        }
        break;
      case "Do": {
        const name = names[names.length - 1];
        const xo = resources?.get(PDFName.of("XObject"))
          ? resources.lookup(PDFName.of("XObject"), PDFDict)
          : null;
        const obj = name && xo ? xo.lookup(PDFName.of(name)) : null;

        if (obj?.dict && obj.dict.get(PDFName.of("Subtype"))?.toString() === "/Form") {
          let mtx = [1, 0, 0, 1, 0, 0];

          if (obj.dict.get(PDFName.of("Matrix"))) {
            const arr = obj.dict.lookup(PDFName.of("Matrix"), PDFArray);

            if (arr?.size() === 6) mtx = [0, 1, 2, 3, 4, 5].map((i) => arr.lookup(i).asNumber());
          }

          const inner = obj.dict.get(PDFName.of("Resources"))
            ? obj.dict.lookup(PDFName.of("Resources"), PDFDict)
            : resources;

          walk(decode(obj), inner, mul(mtx, m), out, depth + 1);
        }
        break;
      }
      default:
        break;
    }
    operands = [];
    if (tok !== "Do") names = [];
  }
}

const doc = await PDFDocument.load(fs.readFileSync(PDF_PATH));
const pages = doc.getPages();
const wanted = process.argv.slice(2).map(Number).filter(Boolean);
const targets = wanted.length ? wanted : [5, 6];

for (const pageNo of targets) {
  const page = pages[pageNo - 1];
  const { width, height } = page.getMediaBox();
  const out = { rects: [], lines: [] };

  walk(pageStream(page), page.node.Resources(), [1, 0, 0, 1, 0, 0], out);

  const onPage = (v, max) => v > -2 && v < max + 2;
  const rules = out.lines.filter(
    (l) =>
      onPage(l.x1, width) &&
      onPage(l.x2, width) &&
      onPage(l.y1, height) &&
      onPage(l.y2, height),
  );
  // A ruled box edge is a long, axis-aligned run. Glyph outlines are short.
  const h = rules.filter((l) => Math.abs(l.y1 - l.y2) < 0.8 && Math.abs(l.x2 - l.x1) >= 25);
  const v = rules.filter((l) => Math.abs(l.x1 - l.x2) < 0.8 && Math.abs(l.y2 - l.y1) >= 9);

  const cluster = (vals, tol = 1.5) => {
    const sorted = [...vals].sort((a, b) => a - b);
    const groups = [];

    for (const n of sorted) {
      const last = groups[groups.length - 1];

      if (last && n - last[last.length - 1] <= tol) last.push(n);
      else groups.push([n]);
    }

    return groups.map((g) => Math.round((g.reduce((s, n) => s + n, 0) / g.length) * 10) / 10);
  };

  console.log(`\n===== PAGE ${pageNo}  (${Math.round(width)} x ${Math.round(height)}) =====`);
  console.log(`  paths: ${out.rects.length} rects, ${out.lines.length} lines`);
  console.log(`  long horizontal rules: ${h.length}   long vertical rules: ${v.length}`);

  const rowYs = cluster(h.map((l) => l.y1)).reverse();
  const colXs = cluster(v.map((l) => l.x1));

  console.log(`\n  row rules, top-down (${rowYs.length}):`);
  console.log("    " + rowYs.join(", "));
  console.log(`\n  column rules, left-right (${colXs.length}):`);
  console.log("    " + colXs.join(", "));
}
