---
name: pdf-editor-architecture
description: Load before editing any code under lib/client/pdf-editor/**, lib/client/hooks/pdf-editor/**, or components/sections/pdf-editor/** — explains the PDF load → render → edit → save pipeline, the load-bearing invariants, areas the user has flagged off-limits, and the verification recipe. Use it instead of grep/glob to orient on the editor.
---

# PDF editor — architecture & gotchas

This editor lets users open a PDF, edit text/shapes/images on top of it, manage pages (reorder, rotate, duplicate, color, bg image, watermark), and save back. The pipeline is intricate; this skill is the orientation map.

## Pipeline (load → edit → save)

```
File / cloud doc
        │
        ▼
usePdfLoader        — loads pdf.js doc + sets `pdfDocument` in the Zustand store
        │
        ▼
usePageRenderer     — renders the CURRENT page to a <canvas> via pdf.js
                      (scale = zoom × dpr; suppressText: true)
        │
        ▼
useFabricCanvas     — overlays a Fabric.js canvas at the same CSS size
                      (enableRetinaScaling: true; setZoom(zoom))
        │
        ▼
useEditTextMode     — extractTextBlocks → FabricIText objects per text run
                      (fonts come from pdf.js's loadedName via document.fonts)
        │
        ▼
Per-tool hooks      — draw / highlight / shape / image / signature / watermark
                      (each tool layers Fabric objects onto the overlay)
        │
        ▼
Save paths:
  • Editor "Save" → use-save-editor → persistEditorDocument
        → save-utils.buildEditedPdfBytes → merge-pdf.mergeFabricEditsIntoPdf
        → cloud upload
  • Manage Pages "Save" → handleManagePagesSave in PdfEditorShell
        → build-pages-pdf.buildPdfFromDraft
        → new File replaces the editor's source
  • Export PDF → window event "editor:export" → use-export-editor
```

## Source folders

| Path | Purpose |
|---|---|
| `lib/client/pdf-editor/` | Pure logic: extraction, drawing, merge, build, color/coordinate helpers |
| `lib/client/hooks/pdf-editor/` | React glue: loaders, tools, save/navigation, draft state |
| `components/sections/pdf-editor/` | UI: shell, viewer, toolbar, sidebars, modals |
| `lib/client/stores/pdf-editor-store.ts` | Zustand store: file, pdfDocument, fabric JSON per page, watermark/bgImage config, page order, etc. |

## Load-bearing invariants (do not violate)

1. **Fabric uses base coordinates at zoom = 1.** `use-fabric-canvas.ts` keeps the Fabric canvas at base dims and applies `setZoom(zoom)` on top. **Serialized JSON is always in base coords.** Anything reading/writing Fabric JSON must assume zoom=1.

2. **Zoom changes only resize Fabric, never re-mount.** Mount effect runs only on `sourcePage` change; a separate effect calls `setDimensions + setZoom + obj.dirty = true + renderAll`. Don't add `renderedSize` to the mount effect's deps — that brings the cluttered-text + blur regression back.

3. **Page rotation is BAKED INTO THE CONTENT STREAM, never `/Rotate` metadata.** `append-pdf-page.ts` uses `embedPage` + `concatTransformationMatrix` for source/imported pages; `appendColoredPageFromPdfJs` passes `rotation` to `getViewport`; blank pages swap W/H. **Never call `page.setRotation(degrees(...))` for manage-pages output** — it ships `/Rotate` metadata which makes text positions desync from the rendered layout in the editor.

4. **Text colors flow: pdf.js OPS → `TextBlock.color` → Fabric `fill` → `hexToPdfColor` at export.** `extractSequentialTextColors` walks the operator list; colors are zipped 1:1 to text items by index (mode-color fallback if counts mismatch). Re-arrange this only if you understand the index-correlation issue.

5. **Background image preview uses `mix-blend-mode: multiply` on the PDF canvas.** Not on the Fabric overlay. The img element sits as a sibling before the canvas; canvas with multiply burns white through to image. At export it's the same trick via `BlendMode.Multiply` on `drawImage` in `merge-pdf` / `build-pages-pdf`.

6. **Background color (per-page, from Manage Pages) is baked at manage-pages save.** Stored on `DraftPage.backgroundColor`, applied by `buildPdfFromDraft` via `appendColoredPageFromPdfJs`. After save the color is part of the source PDF — no extra state survives.

7. **Mobile rendering**: `RightSidebar` isn't mounted on mobile. Watermark + background-image config render via `MobileToolPropertiesModal` mounted inside `BottomDock`. Closing the modal sets `activeTool = "select"`.

8. **TypeScript target is ES2022** (`tsconfig.json`). Don't drop it back to ES5 — bumping killed all the down-leveling polyfill weight and resolved a long tail of TS2802 errors.

9. **Editor modals are lazy.** `CreatePdfModal`, `ManagePagesModal`, `PerformancePanel` are loaded via `next/dynamic` and conditionally mounted. Don't import them statically into `PdfEditorShell.tsx`.

10. **Save UX must always show a loading toast.** `useSaveEditor` and `useEditorNavigationSave` both open `toast.loading(...)` before `persistEditorDocument` and close it in `finally`. The cloud upload is multi-second — silent waits look like a hang.

## Hot spots / fragile areas

- **`lib/client/pdf-editor/text-extraction.ts`** — color-to-item mapping zips by index. If `colors.length !== textContent.items.length`, falls back to mode color (when uniform) or black. Won't be perfectly correct for documents with mid-paragraph color changes plus split text items.
- **`lib/client/pdf-editor/merge-pdf.ts`** — has its OWN inline copy of `renderPageToPng` + `TEXT_OPS_MIN/MAX/RASTER_SCALE`. The shared `render-page-png.ts` is used only by `build-pages-pdf.ts`. Do NOT consolidate them; the user explicitly asked to keep `merge-pdf` undisturbed.
- **`use-fabric-canvas.ts`** — refs `renderedSizeRef`/`zoomRef` exist specifically so the mount effect doesn't re-run on zoom. Don't accidentally inline these back into deps.
- **`use-edit-text-mode.ts`** — `objectCaching: false` is set on every IText. The user reverted an attempt to enable caching; leave it off.
- **`build-pages-pdf.ts`** — for imported PDFs with bg color, pdf.js docs are lazy-loaded and cached per `importKey`. Same cache approach is needed if you add other pdf.js-driven per-page work.

## Off-limits (user has explicitly said don't touch)

- The watermark code in `merge-pdf.ts` (authored by another dev; reverting their structure has burned cycles before).
- The inline `renderPageToPng` function + the `TEXT_OPS_MIN`, `TEXT_OPS_MAX`, `RASTER_SCALE` constants in `merge-pdf.ts`.
- `objectCaching: false` on IText in `use-edit-text-mode.ts`.

If a fix REQUIRES touching one of these, ask the user before doing it.

## Verification recipe

After any non-trivial PDF editor change, run:

```bash
bunx tsc --noEmit                          # type check
bun run lint                                # eslint
bun run build                               # full Next build (catches use-server/use-client mismatches)
```

Then manually verify in `bun run dev`:

1. Open a multi-page PDF → text editing still works on first page.
2. Zoom in to 200% and out to 50% → text stays sharp + positioned.
3. Manage Pages → rotate one page 90° → save → that page reads correctly (no cluttered text).
4. Manage Pages → set background color on a source page → save → color visible behind content.
5. Watermark tool → add text watermark → preview matches export.
6. Background image tool → upload → preview shows behind page; export matches.
7. Save (cloud) → loading toast appears → success toast on completion.
8. Mobile viewport → watermark / bg image tools open the modal.

## When the user reports an issue

1. Reproduce locally before touching code.
2. Add a TaskCreate item for the fix.
3. If the fix area is in "Off-limits" above — confirm with the user first.
4. After fix: append a one-liner to the "Known issues" section below so future sessions know it was addressed.

## Known issues / decisions log

(Append new entries here as they're discovered + addressed. Newest first.)

- **2026-05-22 — Second-pass audit (mobile / a11y / security / concurrency)** — findings recorded, NOT yet actioned (loop cancelled before fix pass):
  - **CRITICAL**: Fabric wrapper `<div data-fabric="wrapper">` has no `touch-action: none` set in `use-fabric-canvas.ts:104-110`. The outer scroll container competes with Fabric for touch events on iOS Safari → draw/highlight/eraser are unreliable on mobile. Fix: add `wrapper.style.touchAction = "none"`.
  - **CRITICAL**: `EditorInfoBar` selects entire `historyByPage` / `historyIndexByPage` Maps (`EditorTopBar.tsx:52-53`). Every Fabric stroke re-creates the Map → component re-renders on every brush move on every page. Fix: derive `canUndo` / `canRedo` as booleans inside dedicated selectors.
  - **HIGH**: Image MIME validation uses `file.type` only (set from extension, not magic bytes). SVG/HTML disguised as PNG could reach `FabricImage.fromURL` and execute scripts on Safari via SVG `<script>`. Fix: read first 4-8 bytes and verify PNG/JPEG magic numbers.
  - **HIGH**: No mutex between toolbar Save and Manage Pages save (`PdfEditorShell.tsx:102` + `use-save-editor.ts:27`). Concurrent clicks race to upload different versions to the cloud — last-write-wins silently. Fix: share a save lock across both paths or disable Save during a manage-pages rebuild.
  - **HIGH**: `handleManagePagesSave` closes over `pdfDocument` via `useCallback` deps. After the `await file.arrayBuffer()` gap, that reference may point to a destroyed proxy if the user opened a new file. Fix: read from `usePdfEditorStore.getState()` inside the async body.
  - **HIGH**: `undo`/`redo` in `pdf-editor-store.ts:335-353,441-459` do a non-atomic `get() → set()`. Two simultaneous calls (keyboard event + toolbar button) can undo one step instead of two. Fix: use `set(s => ...)` updater form for the full read-modify-write.
  - **MEDIUM**: `cloneSnapshot` in `use-manage-pages-draft.ts:20-26` doesn't deep-copy `importedPdfs` ArrayBuffers. Latent corruption hazard if anything ever mutates a buffer. Fix: `v.slice(0)` per buffer.
  - **MEDIUM**: Manage Pages "Background Color" `ColorPicker.Trigger` (`ManagePagesModal.tsx:297-334`) lacks `aria-label` — screen readers announce nothing meaningful.
  - **MEDIUM**: `MobileToolPropertiesModal` doesn't restore focus to the trigger button on close — VoiceOver/TalkBack users lose context.
  - **MEDIUM**: `SignatureDrawPanel`'s effect depends on `onSignatureReady`; currently stable but fragile if anyone inlines an arrow there. Wrap in `useCallback` proactively.
  - **MEDIUM**: `usePageRenderer` `getOperatorList` has no cancellation. On 1000+ page scanned PDFs with rapid navigation, calls queue up and stall the pdf.js worker. Fix: re-check `cancelled` after the `await` and skip the render call.
  - **MEDIUM**: `file.name` rendered untruncated in `EditorTopBar.tsx:148` Tooltip — pathological filenames can break layout / cause BIDI anomalies. Truncate to ~255 chars.

- **2026-05-22 — Audit pass (paid-ads launch)**:
  - Encrypted / corrupt PDFs now show user-friendly errors instead of raw pdf.js exception strings (`use-pdf-loader.ts`).
  - `pagehide` event added for iOS Safari autosave-on-tab-close (`use-editor-navigation-save.ts`).
  - `beforeunload` prompt when there are unsaved changes (`use-editor-navigation-save.ts`).
  - Imported pdf.js docs in `build-pages-pdf` are now destroyed after build → frees worker memory.
  - Manage-pages import cap of 50 MB; image-tool insert cap of 10 MB.
  - Eraser tool restores `canvas.selection = true` on cleanup so rubber-band selection works after switching away.
  - Watermark tool render loop now bails on `cancelled` after async work, so a stale render doesn't add objects to a freshly mounted canvas.
  - Text-block cache in `use-edit-text-mode` is now keyed by SOURCE page (via `getSourcePageIndex`) so thumbnail-drag reorders don't serve stale text.
  - Ctrl+Z / Ctrl+Y in the editor no longer hijack focus when typing in a sidebar input or textarea.
  - Empty IText objects are removed from the canvas on `editing:exited` if the user leaves them blank — no more phantom text in history snapshots.
  - SVG removed from watermark image upload `accept` (pdf-lib's `embedJpg`/`embedPng` can't handle SVG; would crash export).
  - **Reverted by user**: bg image embed-once optimization in `merge-pdf.ts` (they want that file untouched). Cost: with a 1 MB bg image on a 200-page export, the output PDF inflates ~200×. Living with it for now.
  - **Not actioned**: merge-pdf's lack of `pageOrder` consumption (off-limits). Pages reordered via the thumbnail strip will export in original source order — Manage Pages saves work because that path rebuilds source bytes.

- **2026-05-22** — Rotation in Manage Pages: switched from `/Rotate` metadata to content-stream baking (`append-pdf-page.ts`). Editor reads rotated pages as normal PDFs; no text-positioning desync.
- **2026-05-21** — Text blur on zoom: `obj.dirty = true` in the resize effect (`use-fabric-canvas.ts`) so Fabric re-rasterizes glyphs at the new effective resolution.
- **2026-05-21** — Save UX: added persistent loading toast via new `toast.loading()` + `toast.close()` helpers (`lib/shared/utils/toast.ts`).
- **2026-05-21** — Font color from source: `extractTextBlocks` now wires the per-`showText` color array to text blocks; previously every block defaulted to black.
- **2026-05-20** — Background color per page (Manage Pages): per-page `backgroundColor` on DraftPage; applied by `appendColoredPageFromPdfJs` using `BlendMode.Multiply` so content sits over color.
- **2026-05-20** — Background image feature: store config, sidebar panel, mobile modal, mix-blend-mode preview, multiply-blend at export.
- **2026-05-20** — Mobile watermark + bg image: `MobileToolPropertiesModal` surfaces these tools' panels on small viewports.
- **2026-05-19** — Manage Pages page-order remapping: Fabric JSON / history maps keyed by source page so reorder doesn't lose edits.
