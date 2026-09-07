---
name: pdf-composer-render-fix
description: MANDATORY load when the user reports "edits missing from downloaded PDF", "drawings not in merged PDF", "highlight/draw gone after save", "save works but download is unedited", or any variant of "the file the browser downloaded doesn't have my strokes". Also load on any bug touching `renderFabricJsonToPng`, `flushRasterBatch`, `renderFabricSubsetToPng`, freehand path serialization, PencilBrush, or the offscreen bake → PNG → pdf-lib.drawImage pipeline. Covers a Fabric v7 loadFromJSON bug that produces nearly-blank PNGs for freehand paths — five commits and one full day of chasing dead-ends before the fix landed 2026-09-07. Skip this and you'll re-chase Blob byte-view, MediaBox offset, and CropBox — none of which are the actual cause for this bug class.
---

# PDF composer editor — draw/highlight missing from download fix

## Trigger phrases (auto-load on any of these)

- "PDF edits are not reflected in my downloaded PDF"
- "editing changes not included in merged PDF"
- "drew shapes but download doesn't have them"
- "save works but the file I download is unedited"
- "highlight is missing when I click Done and Download"
- "the merged file doesn't have my drawings"
- "bake seems fine but PDF is blank of my edits"

If the user's report matches any of these, load this skill BEFORE proposing any fix. The bake pipeline is subtle and the dead-ends are convincing.

## The one-line root cause

**Fabric v7's `loadFromJSON` does NOT fully rehydrate freehand `path` objects (PencilBrush strokes from draw + highlight tools) onto a fresh offscreen Canvas.** The resulting `toDataURL` PNG is ~99.6% transparent even though the JSON had the paths listed. Embedded into the PDF, the page shows source content only.

## The 30-second diagnostic

1. Ask user for the console log after they repro (Done → Download or Merge → Merge & Download).
2. Look for `EXPORT-DIAG: renderFabricJsonToPng`. Check `pixelFillRatio`.
3. **If `pixelFillRatio < 5`** → this is the bug. The offscreen render silently produced a blank PNG.
4. **If `pixelFillRatio > 5`** → different bug; look elsewhere (byte-view corruption, MediaBox, CropBox, or something new).

You need the pixel-content diagnostic. It lives in `lib/client/pdf-editor/save-utils.ts:renderFabricJsonToPng`. If it's been removed, restore it first — the size heuristic (`likelyBlank` from `dataUrlChars`) is useless because a 612×792 alpha PNG has ~100KB of header/zlib overhead even fully transparent.

## The fix (already shipped, do NOT unwire)

`lib/client/pdf-editor/save-utils.ts` — function `renderSubsetFromLiveCanvas`. For the current page (the one the live canvas is displaying), skip the offscreen re-render entirely. Use the LIVE editor canvas directly — it already has the strokes correctly painted (that's literally what the user sees on screen).

Sequence inside `renderSubsetFromLiveCanvas`:
1. Capture originals: visibility per object + zoom + viewport transform + physical canvas dimensions.
2. Mark all non-target objects `visible = false`.
3. Call `setDimensions({ width: parsed.width, height: parsed.height })` — **critical**: if the user is zoomed anything other than 1.0, the live canvas backing store is smaller than the base-coord scene and `toDataURL` clips.
4. `setZoom(1)` + `setViewportTransform([1, 0, 0, 1, 0, 0])`.
5. `renderAll()`.
6. `toDataURL({ format: "png", multiplier: 3 })`.
7. Restore in REVERSE order: viewport → zoom → dimensions → visibility. `renderAll()` again to repaint.
8. Return the data URL.

Fallback: when `liveCanvas.getObjects().length !== parsed.objects.length` (user navigated to another page since flush), bail and let the offscreen path run. It's still broken for freehand paths, but that page isn't the current one — user won't notice unless they navigate.

Plumbing (do not remove any of these): `MergePdfInput` has `liveFabricCanvas?: FabricCanvas | null` + `liveCanvasPage?: number`. `mergeFabricEditsIntoPdf` forwards them to `processPageObjects` → `flushRasterBatch` → `renderFabricSubsetToPng`, but only when the pageNum matches `liveCanvasPage`. `buildEditedPdfBytes` in `save-utils.ts` passes `liveFabricCanvas: fabricCanvas, liveCanvasPage: currentPage` at the call site.

## Load-bearing rules (any of these gets reverted → bug comes back)

1. **NEVER remove `renderSubsetFromLiveCanvas`.** The offscreen `loadFromJSON` path is broken for freehand paths on Fabric v7.3.1. There is no clean workaround in the offscreen path — `objectCaching = false + dirty + setCoords()` is insufficient.
2. **NEVER remove the `setDimensions` step inside `renderSubsetFromLiveCanvas`.** Without it, users zoomed at anything other than 1.0 get partial exports (only top-left of the strokes captured).
3. **NEVER remove the `pixelFillRatio` + `nonTransparentPixels` fields from `renderFabricJsonToPng`.** This is the only signal that distinguishes a healthy render from a Fabric-v7-blank render. Every future upstream Fabric bug of the same shape will surface here first.
4. **NEVER remove `liveFabricCanvas` / `liveCanvasPage` plumbing** from `MergePdfInput`, `processPageObjects`, `flushRasterBatch`, `renderFabricSubsetToPng`, `buildEditedPdfBytes`. This is what makes the current page use the live canvas; without it, every page falls back to the broken offscreen render.
5. **NEVER "consolidate" `renderFabricJsonToPng` and `renderSubsetFromLiveCanvas` into one function.** They're separate on purpose: fresh canvas (bug) vs live canvas (working).

## Dead-ends we already chased — do NOT re-attempt these as fixes for this class

These are real bugs and their fixes shipped, but NONE of them was the cause of the "drawings missing" report. If the pixel-fill diagnostic says `< 5%`, jump straight to the live-canvas fix.

| Dead-end | Real bug? | Fixed the report? | Why the temptation |
|---|---|---|---|
| `new Blob([bytes])` vs `[bytes.buffer as ArrayBuffer]` | Latent (view-Uint8Array corruption) | No | pdf-lib's `save()` returns byteOffset=0, so `.buffer` and `[bytes]` are identical here |
| MediaBox non-(0,0) origin | Real for Solidgate receipts | No — user's had `mediaBoxIsOffset: false` | Plausible geometry issue |
| CropBox smaller than MediaBox | Real for some scanned PDFs | No — user's had `cropIsSmaller: false` | Plausible clipping issue |
| `objectCaching = false + dirty + setCoords()` | Partial workaround for the same Fabric bug | No — insufficient for freehand paths | Documented in prior 2026-09-07 skill log entry |
| Backend transformation | No — export is 100% client-side for `format: "pdf"` | No | `save: uploaded backendSizeBytes: N` in log is the ONLY backend call; `PDF download triggered` immediately after is a client-side Blob → anchor click |

## Adjacent UX invariant (do NOT unwire)

Done button (`PvEditorTopChrome.tsx` + `EditorTopBar.tsx`) and MergePdfModal's "Merge & Download" click dispatch `editor:save-before-action` with `{ force: true, skipReset: true }` BEFORE opening the format modal / running the in-memory bake. Guarantees the cloud has the latest edits before any subsequent action. Signed-out users skip the pre-save (the export flow itself routes them through email-first signin — do not break that).

## Verification recipe (any future change to the render pipeline)

1. `bunx tsc --noEmit && bun run lint && bun run build` — must all be clean.
2. Open a PDF with editable text (any Solidgate receipt or `public/PDFVault - FAQs.pdf` locally).
3. Draw a freehand line + drop a highlight stroke.
4. Click **Done → Download PDF**. Downloaded file must show both strokes.
5. Click **Merge → add another PDF → Merge & Download**. Merged file must show both strokes on page 1.
6. Console must contain: `EXPORT-DIAG: renderSubsetFromLiveCanvas ENTRY v2 {hasLiveCanvas: true, ...}` followed by `rendered subset from LIVE canvas {dataUrlChars: > 300000}`. If either line is missing, the fix isn't running.
7. Verify no NEW logs like `pixelFillRatio: < 5` for the current page — that would mean the fallback fired and we hit the Fabric bug.

## Reference commits

Final working state: `3e53ae0` on branch `fix/merge-splt-save-issues`.

Chronological trail (each row a lesson):
- `ae048f9` — Blob byte-view fix in 7 sites + observability logs (didn't fix report but defence-in-depth).
- `78a1d3e` — CropBox draw + `pixelFillRatio` diagnostic. **The diagnostic was the breakthrough.**
- `5497a34` — Live-canvas raster path introduced.
- `dc8d984` — `setDimensions` fix inside live-canvas path (was clipping at non-1.0 zooms).
- `3e53ae0` — Save-before-modal UX (Done + Merge).

## Files that MUST NOT be reverted without a plan

- `lib/client/pdf-editor/save-utils.ts` (`renderSubsetFromLiveCanvas` + `pixelFillRatio` diagnostic + `liveCanvas` param on `renderFabricSubsetToPng`)
- `lib/client/pdf-editor/merge-pdf.ts` (`liveFabricCanvas` + `liveCanvasPage` plumbing through `mergeFabricEditsIntoPdf`, `processPageObjects`, `flushRasterBatch`; CropBox draw)
- `components/sections/pdf-editor/PvEditorTopChrome.tsx` + `EditorTopBar.tsx` (Done → save-first → open-modal handler)
- `components/sections/pdf-editor/MergePdfModal.tsx` (save-before-bake + visible-fallback toast)

## Full narrative (2026-09-07)

Also captured in `.claude/skills/pdf-editor-architecture/SKILL.md` at the top of the "Known issues / decisions log" — see the `2026-09-07 — Draw / highlight strokes missing from downloaded + merged PDFs (LIVE-CANVAS RASTER FIX)` entry for the full chain of misfires and the eventual root-cause diagnosis.
