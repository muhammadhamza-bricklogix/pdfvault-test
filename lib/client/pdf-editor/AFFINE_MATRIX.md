# Affine Matrices in `extract-text.ts`

This doc explains the math behind `extractTextItems()` — specifically the matrix composition that turns a PDF text item into canvas pixel coordinates.

---

## 1. What is an affine matrix?

An **affine transform** is the combination of:

- **scale** (stretch / shrink),
- **rotation / shear**,
- **translation** (move).

In 2D, every affine transform can be written as a 3×3 matrix:

```
┌ a  c  e ┐
│ b  d  f │
└ 0  0  1 ┘
```

| Slot | Meaning |
|------|---------|
| `a, d` | scale on the X / Y axis |
| `b, c` | shear / rotation |
| `e, f` | translation (move X / Y) |
| bottom row | always `[0, 0, 1]` — never stored |

Because the bottom row is fixed, PDF (and pdf.js, and Fabric, and SVG…) store the matrix as a **flat 6-number array**:

```
[a, b, c, d, e, f]
```

> ⚠️ Order matters. The flat array is **column-major**: it lists the first column top-to-bottom, then the second column, then the translation. `b` is *not* the top-middle — it's the second slot of the first column.

---

## 2. The two matrices we deal with

### a) `viewport.transform`

Returned by `page.getViewport({ scale: zoom })`. It maps **PDF space → canvas space**:

- PDF space: origin at bottom-left, units in points (1 pt = 1/72 inch).
- Canvas space: origin at top-left, units in CSS pixels.

For an 8.5×11 in (612×792 pt) page rendered at `zoom = 1.5`:

```
viewport.transform = [1.5, 0, 0, -1.5, 0, 1188]

  ┌ 1.5    0     0    ┐
  │  0   -1.5  1188   │
  └  0     0     1    ┘
```

What it does, intuitively:

1. **Scale** by 1.5 (zoom).
2. **Flip Y** (`d = -1.5`) — because PDF Y grows up, canvas Y grows down.
3. **Translate** down by `pageHeight × zoom = 792 × 1.5 = 1188`, so the flipped page starts at canvas y=0 instead of going off-screen.

### b) `item.transform`

Returned by `page.getTextContent()` for each text run. It places one piece of text in **PDF space**:

```
item.transform = [fontSize, 0, 0, fontSize, baselineX, baselineY]
```

For our running example:

```
item.transform = [16.52, 0, 0, 16.52, 101.05, 756.52]

  ┌ 16.52    0    101.05 ┐
  │   0    16.52  756.52 │
  └   0      0      1    ┘
```

What it does:

1. **Scale** by 16.52 (the font size in PDF points).
2. **Translate** to `(101.05, 756.52)` — the **baseline** of the first glyph, in PDF points.

Note: `(e, f)` is the **baseline**, not the top of the text. The baseline is the line letters sit on; tails like `g` and `y` hang below it.

---

## 3. Why we multiply them

Each matrix is a transform from one space to another. Multiplying them **composes** the transforms:

```
final = viewport × item
```

Reading right-to-left:

1. `item` places the text in **PDF space**.
2. `viewport` then maps **PDF space → canvas space**.

So `final` is "where this text lands on the canvas, in pixels," in a single matrix.

> ⚠️ Matrix multiplication is **not commutative**. `viewport × item ≠ item × viewport`. Always pass the "outer" transform first to `Util.transform`.

---

## 4. How to multiply two 3×3 matrices

The rule for any cell of the result:

> **Result\[row]\[col] = (row of left matrix) · (column of right matrix)**
> — multiply matching elements, sum them.

For 3×3 × 3×3, each cell is a sum of **three** products.

### The shape we're computing

Left = viewport. Right = item.

```
                        Right (item) columns:
                        Col0      Col1     Col2
                        ┌16.52     0    101.05 ┐
                        │  0     16.52  756.52 │
                        └  0       0       1   ┘
Left (viewport) rows:
Row0: [1.5,  0,   0   ]
Row1: [ 0,  -1.5, 1188]
Row2: [ 0,   0,   1   ]
```

### Computing each output slot

Six numbers come out (we ignore the always-`[0, 0, 1]` bottom row):

#### `a = Result[0][0] = Row0 · Col0`
```
[1.5, 0, 0] · [16.52, 0, 0]
= 1.5*16.52 + 0*0 + 0*0
= 24.78
```

#### `c = Result[0][1] = Row0 · Col1`
```
[1.5, 0, 0] · [0, 16.52, 0]
= 1.5*0 + 0*16.52 + 0*0
= 0
```

#### `e = Result[0][2] = Row0 · Col2`
```
[1.5, 0, 0] · [101.05, 756.52, 1]
= 1.5*101.05 + 0*756.52 + 0*1
= 151.575
```

#### `b = Result[1][0] = Row1 · Col0`
```
[0, -1.5, 1188] · [16.52, 0, 0]
= 0*16.52 + (-1.5)*0 + 1188*0
= 0
```

#### `d = Result[1][1] = Row1 · Col1`
```
[0, -1.5, 1188] · [0, 16.52, 0]
= 0*0 + (-1.5)*16.52 + 1188*0
= -24.78
```

#### `f = Result[1][2] = Row1 · Col2`
```
[0, -1.5, 1188] · [101.05, 756.52, 1]
= 0*101.05 + (-1.5)*756.52 + 1188*1
= -1134.78 + 1188
= 53.22
```

### Final composed matrix

```
m = [24.78, 0, 0, -24.78, 151.575, 53.22]

  ┌ 24.78    0     151.575 ┐
  │   0    -24.78   53.22  │
  └   0      0        1    ┘
```

What it tells us:

- `a = 24.78` — the text is rendered at 24.78 px per em on canvas (font size 16.52 pt × 1.5 zoom).
- `d = -24.78` — Y is still flipped (we didn't undo the flip; we baked it into the text's own transform).
- `(e, f) = (151.575, 53.22)` — the **baseline** of the text, now in canvas pixels.

---

## 5. Reading the values we actually want

`extract-text.ts` derives four numbers from `m`:

```ts
const fontSize = Math.hypot(m[2], m[3]); // length of the "up" vector
const x        = m[4];
const y        = m[5] - fontSize;        // baseline → top-left
const width    = item.width * viewport.scale;
```

### Why `fontSize = hypot(m[2], m[3])`?

`(c, d)` is the matrix's **Y basis vector** — what `(0, 1)` in item space maps to in canvas space. Its length is the "size of one Y unit" after transform, i.e. the font size in pixels. `hypot` (Pythagoras) handles the case of rotated text where Y-direction has both X and Y components.

For non-rotated text: `c = 0`, `d = ±fontSize`, so `hypot` = `|d|` = font size.

### Why `y = m[5] - fontSize`?

`m[5]` is the **baseline** in canvas pixels. The **top** of the text is one font size above the baseline. Canvas Y grows downward, so "above" means smaller Y → subtract.

```
canvas Y
   ↓
   0 ─────────── ┐
                 │  fontSize (24.78)
   y=28.44 ──── ┤  ← TOP of glyph     (what we store)
                 │
                 │  glyph body
   y=53.22 ──── ┘  ← BASELINE         (m[5])
```

### Why `width = item.width * viewport.scale`?

`item.width` is already given in PDF points (it's a horizontal distance, no Y-flip needed). Multiplying by `viewport.scale` converts to canvas pixels. Faster and simpler than going through the full matrix.

---

## 6. Sanity check: full worked example

Input:
```js
viewport.transform = [1.5, 0, 0, -1.5, 0, 1188]
viewport.scale     = 1.5
item = {
  str: "Muhammad Zubair Asim",
  transform: [16.52, 0, 0, 16.52, 101.05, 756.52],
  width: 205.91,
  height: 0,
  fontName: "g_d0_f1",
}
```

After `Util.transform`:
```
m = [24.78, 0, 0, -24.78, 151.575, 53.22]
```

Derived:
```
fontSize = hypot(0, -24.78) = 24.78
x        = 151.575
y        = 53.22 - 24.78    = 28.44
width    = 205.91 * 1.5      = 308.86
height   = 0 || 24.78        = 24.78
```

Output stored:
```js
{
  str: "Muhammad Zubair Asim",
  x: 151.575, y: 28.44,
  width: 308.86, height: 24.78,
  fontSize: 24.78, fontName: "g_d0_f1",
}
```

Visual:
```
canvas (0,0)
┌───────────────────────────────────────┐
│        x=151.575                      │
│           ↓                           │
│  y=28.44 → Muhammad Zubair Asim       │  ← top-left of bbox
│            └──── width 308.86 ────┘   │
│            height 24.78               │
```

That matches what gets logged for the title text on a typical CV PDF.

---

## 7. Cheat sheet

| You have… | You want… | Formula |
|-----------|-----------|---------|
| PDF baseline `(e, f)` + viewport | canvas baseline | `Util.transform(viewport, item)` → `m[4], m[5]` |
| canvas baseline | canvas top of text | `baselineY - fontSize` |
| canvas top + fontSize | canvas baseline | `topY + fontSize` |
| PDF point distance | canvas pixel distance | `pdfDist * viewport.scale` |
| canvas pixel distance | PDF point distance | `canvasDist / viewport.scale` |

That's the whole story. Once Step 1 logs values that match the visible text, you can trust this math for Steps 2+ (placing Fabric overlays, masking originals, and writing edits back via pdf-lib).
