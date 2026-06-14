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

   **Text editing is tool-gated for everyone (mobile + desktop).** Default state on every page: pdf.js paints text natively (`suppressText` is driven by `extractedPages.has(sourcePage)` in `PdfViewerCanvas.tsx`). When the user activates the **"Edit Text" toolbar tool** (`activeTool === "editText"`), `useEditTextMode` runs extraction for the current page, places Fabric IText objects, and calls `markPageExtracted(sourcePage)` — only then does `suppressText` flip on so pdf.js stops painting text under the overlay. IText survives tool switches: once extracted, the page stays in overlay mode (tap any sentence to edit) regardless of which tool is currently selected. If `extractTextBlocks` throws (older iOS Safari WebKit on `getTextContent`), the hook reverts `activeTool` back to "select" and toasts the user — the page never flips `suppressText` on, so native pdf.js text keeps painting and the page stays readable.

8. **All runtime pdfjs imports go through `loadPdfJs()`** (`lib/client/pdf-editor/load-pdfjs.ts`), which installs `Promise.withResolvers` / `Object.hasOwn` / `structuredClone` polyfills before importing the **legacy** pdf.js build. Direct `import("pdfjs-dist")` or `import("pdfjs-dist/build/...")` skips the polyfills and may break on older Safari.

9. **TypeScript target is ES2022** (`tsconfig.json`). Don't drop it back to ES5 — bumping killed all the down-leveling polyfill weight and resolved a long tail of TS2802 errors.

10. **Editor modals are lazy.** `CreatePdfModal`, `ManagePagesModal`, `PerformancePanel` are loaded via `next/dynamic` and conditionally mounted. Don't import them statically into `PdfEditorShell.tsx`.

11. **Save UX must always show a loading toast.** `useSaveEditor` and `useEditorNavigationSave` both open `toast.loading(...)` before `persistEditorDocument` and close it in `finally`. The cloud upload is multi-second — silent waits look like a hang.

## Hot spots / fragile areas

- **`lib/client/pdf-editor/text-extraction.ts`** — color-to-item mapping zips by index. If `colors.length !== textContent.items.length`, falls back to mode color (when uniform) or black. Won't be perfectly correct for documents with mid-paragraph color changes plus split text items.
- **`lib/client/pdf-editor/merge-pdf.ts`** — has its OWN inline copy of `renderPageToPng` + `TEXT_OPS_MIN/MAX/RASTER_SCALE`. The shared `render-page-png.ts` is used only by `build-pages-pdf.ts`. Do NOT consolidate them; the user explicitly asked to keep `merge-pdf` undisturbed.
- **`use-fabric-canvas.ts`** — refs `renderedSizeRef`/`zoomRef` exist specifically so the mount effect doesn't re-run on zoom. Don't accidentally inline these back into deps.
- **`use-edit-text-mode.ts`** — `objectCaching: false` is set on every IText. The user reverted an attempt to enable caching; leave it off.
- **`build-pages-pdf.ts`** — for imported PDFs with bg color, pdf.js docs are lazy-loaded and cached per `importKey`. Same cache approach is needed if you add other pdf.js-driven per-page work.
- **`use-fabric-canvas.ts` (mobile-touch trio)** — three values stay coupled per active tool: `fc.allowTouchScrolling`, `fc.upperCanvasEl.style.touchAction`, `wrapper.style.touchAction`. Drawing tools = `false / "none" / "none"`; everything else = `true / "pan-x pan-y" / "pan-x pan-y"`. Wrapper-only changes don't work because the upper-canvas overlays it; allowTouchScrolling alone doesn't work because Fabric's constructor-time `touch-action` value is sticky. See 2026-06-10 (e).
- **`PdfViewerCanvas.tsx` scroll container** — uses the `mx-auto w-fit` pattern, **not** `flex justify-center`. Flex centring on an overflowing child traps iOS Safari users at the centre of a zoomed page (can't reach left/top edge). See 2026-06-10 (e).
- **`HamburgerMenu.tsx` ↔ shell hooks** — any tool that consumes the user's **edited** bytes (Export, Extract Images, anything similar) must live in `PdfEditorShell` next to `useExportEditor` so it has the live `fabricCanvas` ref. `HamburgerMenu` only **dispatches** events (e.g. `editor:extract-images`); it must never `mutateAsync({ file: store.file })` for tools that operate on edits, because `store.file` is the original upload until the next Save. See 2026-06-10 (f).

## Off-limits (user has explicitly said don't touch)

- The watermark code in `merge-pdf.ts` (authored by another dev; reverting their structure has burned cycles before).
- The inline `renderPageToPng` function + the `TEXT_OPS_MIN`, `TEXT_OPS_MAX`, `RASTER_SCALE` constants in `merge-pdf.ts`.
- `objectCaching: false` on IText in `use-edit-text-mode.ts`.
- The mobile-touch trio in `use-fabric-canvas.ts` (allowTouchScrolling + upper-canvas touch-action + wrapper touch-action, coupled per active tool). Reverting any one of these to the pre-2026-06-10 (e) state freezes 1-finger pan when zoomed in on iOS Safari.
- The `mx-auto w-fit` scroll-container pattern in `PdfViewerCanvas.tsx`. Don't replace with `flex justify-center` — same iOS Safari freeze.
- The shell-level `useExtractImagesEditor` hook + `editor:extract-images` event indirection. Don't fold it back into `HamburgerMenu` — that re-introduces the "backend sees original upload, not edits" bug (2026-06-10 (f)).

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

- **2026-06-14 (b) — Edit Text became a first-class toolbar tool (supersedes (a)).** User asked for the entry point to live next to Select/Draw in the toolbar instead of buried in the hamburger menu, with the same gated UX on mobile AND desktop ("click button, then click sentence, then editable"). Architecture: new `ActiveTool` value `"editText"` (icon `PencilEdit01Icon`) sits second in the `TOOLS` array (`EditorTopBar.tsx`), so it's visible in both the desktop tool strip and the mobile `BottomDock`. New store field `extractedPages: Set<number>` (keyed by source page) replaces the (a) `mobileTextEditOptIn` flag entirely. Lifecycle:
  1. Default: `suppressText = false` (pdf.js paints text natively, no `getTextContent` call → safe on every browser).
  2. User taps Edit Text → `activeTool = "editText"` → `useEditTextMode` detects "page not extracted yet AND tool is editText" → runs `extractTextBlocks(page)`, places IText objects, calls `markPageExtracted(sourcePage)`.
  3. `markPageExtracted` flips `extractedPages` for that page → `PdfViewerCanvas` re-renders with `suppressText = true` → native pdf.js text disappears, Fabric IText takes over. Order matters: native text only stops painting AFTER IText is on the canvas, so no blank flash.
  4. IText is permanent for the session — user can tap Edit Text once, switch to Select/Draw/whatever, and still tap any sentence to edit.
  5. On extraction failure (older iOS Safari throws inside `getTextContent`), the hook reverts `activeTool` to `"select"` and toasts "Text editing not supported on this browser." `extractedPages` never gets the page, so `suppressText` stays false and pdf.js text keeps painting — page remains readable.
  
  `extractedPages` resets in `clearFile()` and `applyPostSaveReset()` since the underlying bytes change in both cases. The `fc.selection = activeTool === "select" || "editText"` change lets Fabric IText receive single-tap edit gestures while in editText mode; `DRAW_TOOLS` in `use-fabric-canvas.ts` doesn't include editText, so the mobile-touch trio defaults to `pan-x pan-y / allowTouchScrolling: true` (correct — user must be able to scroll a zoomed-in page while picking a sentence).
  
  **Behavior change to flag**: existing desktop users will NO LONGER see auto-extracted editable text on load. They now have to click "Edit Text" first. This is the user's explicit request ("for both mobile and web"). If a future change wants to restore desktop's old auto-extract UX, gate it on `!isMobile` in `useEditTextMode` (skip the `activeTool === "editText"` requirement on desktop). Don't remove the editText tool itself — mobile depends on it.
  
  *Verified*: tsc, eslint, build all clean. **Not verified on a real mobile device** — the user's iOS Safari version needs manual confirmation that `getTextContent` actually succeeds OR that the auto-revert fallback fires gracefully.

- **2026-06-14 (a) — Mobile text editing opt-in (superseded by (b) same day).** First pass shipped a hamburger-menu toggle (`mobileTextEditOptIn` store flag). User asked instead for a toolbar button alongside Select/Draw — (b) reworked the entry point and removed the flag.

- **2026-06-10 (f) — Extract Images runs against the EDITED PDF, not the original upload.** Bug: HamburgerMenu's `runExtractImages` POSTed `usePdfEditorStore.getState().file` straight to `/pdf-tools/extract-images`. Any image the user dropped through the editor's image tool lives as a Fabric overlay object only — it's not in the source bytes until a Save bakes it in via `mergeFabricEditsIntoPdf`. Backend therefore saw the unedited PDF and returned **400 Bad Request** ("no images found" on the user's screen). Fix: new hook `lib/client/hooks/pdf-editor/use-extract-images-editor.ts` mirrors the proven `useExportEditor` pattern — listens for `editor:extract-images`, runs `buildEditedPdfBytes({ bakeOverlays: true, fabricCanvas, file, currentPage })`, wraps the bytes in a `File`, and routes them through `useExtractImagesMutation`. Mounted in `PdfEditorShell.tsx:117` next to `useExportEditor` so it has the live fabricCanvas ref. `HamburgerMenu.runExtractImages` now just dispatches the event. **Don't revert this back to calling the mutation directly from the menu** — the menu sits at the top bar with no canvas access; the only correct surface for extract-images is the shell-level hook. This is the same architectural rule as Export and Save-before-Action (see 2026-06-09 entries): "any tool that consumes the user's edited bytes must live where the live fabricCanvas is, and HamburgerMenu must dispatch — not compute."

- **2026-06-10 (e) — Mobile zoom-in pan/scroll fix.** Bug: user pinch-zoomed past 100% on iOS Safari and could not 1-finger swipe to see the content that overflowed the viewport — page felt frozen. Two compounding causes, both fixed:
  1. **Fabric was hijacking touch.** Fabric's Canvas constructor takes an `allowTouchScrolling` option (default `false`) which controls TWO things internally: (a) it writes `touch-action: none` onto the **upper-canvas** (the event-receiving sibling layer on top of the lower canvas — `fc.upperCanvasEl`); (b) its own `_onTouchStart` handler calls `e.preventDefault()` so the browser can't scroll. Setting `touch-action` only on the wrapper div is **insufficient** — the upper-canvas overlays the wrapper and wins. Fix in `use-fabric-canvas.ts`: pass `allowTouchScrolling: true` at construction, AND in the active-tool effect re-write `fc.upperCanvasEl.style.touchAction` + `wrapper.style.touchAction` + flip `fc.allowTouchScrolling` together based on the active tool. Drawing tools (`draw / eraser / highlight / shape / redact / whiteout`) → `touch-action: none` + `allowTouchScrolling = false` (Fabric owns gesture, strokes don't drop frames on iOS Safari — that's the original reason the value was `none` everywhere). Everything else (`select / text / image / signature / watermark / backgroundImage`) → `touch-action: pan-x pan-y` + `allowTouchScrolling = true` (browser handles 1-finger pan natively). **Three things stay in sync; don't change one without the others.**
  2. **Flexbox `justify-center` on a scroll container prevented reaching the left edge of an overflowing child.** Classic CSS bug: `<div className="flex justify-center overflow-auto">` with a child wider than the parent pins the child centred and the user cannot scroll to its leftmost pixels on iOS Safari (and to a lesser degree on desktop). Fix in `PdfViewerCanvas.tsx`: replaced the `flex flex-1 items-start justify-center overflow-auto` scroll container with `flex-1 touch-pan-x touch-pan-y overflow-auto` and wrapped the page in `<div className="mx-auto w-fit">`. `mx-auto w-fit` auto-centres when content is narrower than viewport and lets the page reach all four edges when wider. Don't reintroduce `justify-center` here.

- **2026-06-10 (d)** — Dashboard "Documents" table: tightened the left-edge spacing between the row-select checkbox, the page thumbnail, and the filename. Changes in `components/sections/dashboard/documents-table.tsx`: `displayColumnDefOptions["mrt-row-select"]` locks the select column to `{ maxSize: 24, minSize: 24, size: 24 }` with `paddingLeft: 4, paddingRight: 0` on both head and body cells; the `thumb` column uses `size: 8` with `paddingLeft: 0, paddingRight: 0` and left-aligns its content. The previously-empty actions column gained `header: "Actions"` so the rightmost column has a label. Mantine React Table's default min column size and cell padding both fight the tightening — keep the explicit min/max + zero padding overrides; reverting either restores the gap.

- **2026-06-10 (c)** — Mobile text STILL failing after (b)'s legacy-build swap because pdf.js v5.7's **legacy** build also uses `Promise.withResolvers`, `Object.hasOwn`, `structuredClone` — APIs older iOS Safari WebKit (Safari < 17.4) doesn't ship. Two fixes layered for resilience:
  1. **Restored the mobile branch** in `PdfViewerCanvas.tsx`: `suppressText: !isMobile` so pdf.js paints text natively on mobile, and `fabricCanvas: isMobile ? null : fabricCanvas` so `useEditTextMode` doesn't run there. Mobile never calls `getTextContent` → can't hit the throw. Trade-off: text is view-only on mobile. This is the **pre-2026-06-09 behavior**; the 2026-06-09 unification turned out to be premature because the user's iOS Safari version is below the legacy build's effective floor. The "glyph doubling at DPR=3" concern from 2026-06-09 only happened when BOTH layers rendered text — with Fabric off on mobile, only pdf.js paints, so no doubling.
  2. **Added a polyfill layer**: `lib/client/pdf-editor/pdfjs-polyfills.ts` polyfills `Promise.withResolvers`, `Object.hasOwn`, `structuredClone` (JSON-roundtrip fallback is fine — pdf.js only clones plain operator-list data). `lib/client/pdf-editor/load-pdfjs.ts` wraps the dynamic import with `installPdfJsPolyfills()` first; all 6 runtime imports now go through `loadPdfJs()`. This protects desktop too (e.g. Safari 17.0 on macOS) and any future code path that calls `getTextContent` from the main thread.
  All editor pdfjs imports: `use-pdf-loader.ts`, `text-extraction.ts`, `build-pages-pdf.ts`, `use-manage-pages-draft.ts`, `document-thumbnail.tsx`, `ThumbnailSidebar.tsx` → all use `loadPdfJs()`. Worker URL still points at the legacy worker.

- **2026-06-10 (b)** — Mobile text STILL failing after the defensive guards in (a) with a deeper-pdf.js stack: `getTextContent` throws `"undefined is not a function (near '...t of e...')"` on older iOS Safari WebKit. This is pdf.js v5's main build hitting a modern-JS path (`for await...of` / `Promise.withResolvers` / `Array.findLast` family) that those WebKit versions don't ship. Fix: switched ALL runtime imports + the worker URL to the **legacy build** (`pdfjs-dist/legacy/build/pdf.mjs` and `pdfjs-dist/legacy/build/pdf.worker.min.mjs`). Six call-sites total: `use-pdf-loader.ts`, `text-extraction.ts`, `build-pages-pdf.ts`, `use-manage-pages-draft.ts`, `document-thumbnail.tsx`, `ThumbnailSidebar.tsx`, plus the worker URL constant in `pdfjs-worker.ts`. Type-only imports stay on bare `pdfjs-dist` (erased at build). ~60KB bundle delta vs main build is worth it — single code path, works on every Safari we care about. **Note**: this fix alone was insufficient — see (c).

- **2026-06-10 (a)** — Mobile "whole text not loading" / `[PDFedits] text: extract failed (TypeError)` traced to two latent crashers in `text-extraction.ts`: (1) `extractSequentialTextColors` reads `args[0]` on operator-list entries without first guarding for null `argsArray[i]` — pdf.js v5 can emit `null` for some operator args, throwing on first access; (2) `extractTextBlocks` walks `textContent.items` / `textContent.styles[fontName]` with no defensive coercion, and dereferences `transform[4]/[5]` without confirming `transform` is an array — any malformed item kills the whole page. Fix: `argsArray[i] ?? []` in the color walker, `Array.isArray` guards on `items` / `transform`, and the color walker now runs in its own `try/catch` so a worker-side glitch falls back to mode-color/black instead of aborting the text layer. Also enriched `use-edit-text-mode.ts` logger.error so the actual `message` / `name` / `stack` surface without expanding the Error object in mobile devtools.

- **2026-06-09** — Manage Pages now auto-saves current edits before opening, AND those edits are visible in the thumbnails. Two changes:
  1. Both the desktop (`EditorTopBar`) and mobile (`BottomDock`) "Manage Pages" buttons call `saveBeforeAction()` (`lib/client/pdf-editor/save-before-action.ts`) which short-circuits when `hasUnsavedChanges` is false, otherwise dispatches `editor:save-before-action` with a "Saving…" toast until the live canvas is flushed and uploaded. Modal only opens on success.
  2. After the save succeeds, `useSaveEditor.onSaveBeforeAction` calls a new store action `applyPostSaveReset(savedFile)` (`pdf-editor-store.ts`) that swaps the local `file` to the merged bytes pdf-lib just produced and clears `fabricJsonByPage` / history / `lastBaked*Signature`. The save handler then waits via store subscription until `usePdfLoader` finishes loading pdf.js against the new file before resolving `onComplete`, so the modal never opens on a stale or null `pdfDocument`. **Trade-off**: post-save the user's shapes/highlights live only in the baked PDF (rendered by the PDF canvas) — they're no longer interactive Fabric objects until the user redraws. Text remains editable because `use-edit-text-mode` re-extracts IText from the new bytes. This is the "save commits the editor baseline" model; if a future requirement needs continuous shape interactivity post-save, render thumbnails through a separate pdf.js doc instead of swapping the local file.

- **2026-06-09** — Hamburger → Create New now prompts on unsaved edits AND the Save-before-Create path actually persists them. Two bugs in one flow:
  1. Dirty flag wasn't flipping: `pushHistory` never touches `hasUnsavedChanges`, so the flag only updated on canvas-unmount. Fix: `use-editor-history.ts` registers dirty-marking listeners on `object:added` (skipping `editorType === "editModeText"` so initial text extraction isn't a false positive), `object:modified`, `object:removed`, and `text:changed`, all gated by the existing `isCreatingShape` / `isRestoringHistory` flags. Shape (non-arrow) and highlight tools, which gate `object:added` behind `isCreatingShape` during drag, also call `markDocumentDirty()` alongside their explicit `pushHistory()` at mouseUp.
  2. Save uploaded stale bytes: `CreatePdfModal` is mounted at shell-level (outside `EditorLayout`) so it had no access to the live `fabricCanvas`. Calling `persistEditorDocument({ fabricCanvas: null })` skipped `flushLiveFabricPage` and the current page's edits never made it into `fabricJsonByPage` before the upload. Fix: `use-save-editor.ts` now also handles `editor:save-before-action` (CustomEvent with `onComplete` callback in detail). `CreatePdfModal.handleSaveAndCreate` dispatches that event and awaits it as a Promise — the save runs inside `useSaveEditor`, which holds the real `fabricRef`, so the live canvas is flushed before upload. **Pattern**: shell-level modals that need a save must use this event, not call `persistEditorDocument` directly.

- **2026-06-09** — WinAnsi crash on save with Unicode IText glyphs: `drawIText` in `vector-drawers.ts` now pre-sanitises text against the resolved `PDFFont` (`sanitizeTextForFont` helper). Characters the font can't encode (e.g. `↔` U+2194, en-dash, emoji when the resolved font is a StandardFont fallback) are replaced with `?` before any `widthOfTextAtSize` / `encodeText` / `drawText` call. Custom embedded fonts via fontkit are still Unicode-complete; the sanitiser is a no-op for them. Prevents the whole save from aborting on a single bad glyph.

- **2026-06-09** — Mobile text rendering: dropped the legacy "let pdf.js paint text + skip the Fabric overlay on mobile" branch in `PdfViewerCanvas.tsx`. The branch existed to work around an old iOS Safari issue where the Fabric layer rendered blank — post-2026-05 fixes (font-readiness await, pinch-zoom floor at 0.5, retina-scaling on the wrapper) resolved it. Keeping both layers on iOS was producing visible glyph doubling at DPR=3. Mobile now uses the same `suppressText: true` + Fabric IText pipeline as desktop, so the **text tool is editable on mobile** too. If iOS Safari ever regresses on the overlay, re-introduce the mobile fork here — not in `useEditTextMode`. *(SUPERSEDED 2026-06-10 (c) — the mobile fork was restored because real-device iOS Safari WebKit fails inside pdf.js's `getTextContent`, not in the Fabric overlay.)*

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
