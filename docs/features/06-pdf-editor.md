# 06 — PDF Editor (`/pdf-composer`)

**Snapshot date:** 2026-09-01
**Status:** LOCKED. See [`16-locked-paths.md`](./16-locked-paths.md).
**Last confirmed-clean editor commit:** `53892a5` (2026-08-19 — zoom + toolbar fixes)

**The most intricate feature in the app.** Full architecture: [`../../.claude/skills/pdf-editor-architecture/SKILL.md`](../../.claude/skills/pdf-editor-architecture/SKILL.md). Load that skill before editing.

## Source layout

| Folder | Purpose |
|---|---|
| `lib/client/pdf-editor/` | Pure logic — extraction, merge, build, drawers, coord/color helpers |
| `lib/client/hooks/pdf-editor/` | React glue — loaders, tools, save, navigation, manage-pages draft |
| `components/sections/pdf-editor/` | UI — shell, viewer, toolbar, sidebars, modals |
| `lib/client/stores/pdf-editor-store.ts` | Zustand store — file, `pdfDocument`, per-page Fabric JSON + history, watermark/bg-image config, page order |
| `lib/client/stores/pdf-search-store.ts` | Search state |

## Load → render pipeline

1. `useEditorDocumentLoader` reads `?id=…` from URL → GETs doc from backend → sets `store.file` + `store.pdfDocument`.
2. `useSignedOutAutoPersist` / `useEditorAutoPersist` mirrors edits to IDB.
3. `PdfViewerCanvas` calls `loadPdfJs()` (Safari polyfills → legacy build → `pdf.worker.min.mjs`).
4. `usePageRenderer` walks pages: renders each pdf.js page to a canvas + mounts a Fabric overlay for edits.
5. `useFabricCanvas` mounts one Fabric canvas per page, coords at zoom=1 always.
6. Zoom changes call `canvas.setZoom(zoom)` for render only — never re-mount.

### Text rendering (mobile + desktop)

- `suppressText` starts `false` — pdf.js paints text natively.
- User activates **Edit Text** tool → `useEditTextMode` runs `extractTextBlocks`, places Fabric IText objects, calls `markPageExtracted(sourcePage)`.
- Only then does `suppressText` flip on for that page.
- Older iOS Safari `getTextContent` throws are caught → tool reverts to `select` + toast; native pdf.js text keeps painting so the page stays readable.

## Tools

| Tool | Hook | Notes |
|---|---|---|
| Select | (default) | Pan + select Fabric objects |
| Edit Text | `use-edit-text-mode.ts` | Runs `extractTextBlocks` per page; IText with `objectCaching: false` (paint-order bug); font-loading guard via `document.fonts.ready` + `loadingdone` |
| Draw (freehand) | `use-draw-tool.ts` | Sets `touchAction: none` on Fabric wrappers for mobile |
| Highlight | `use-highlight-tool.ts` | + `HighlightPropertiesContent.tsx` |
| Eraser | `use-eraser-tool.ts` | |
| Shape | `use-shape-tool.ts` | + `FloatingShapeToolbar`, `ShapeLinkModal`, `shape-object-utils.ts` |
| Image | `use-image-tool.ts` | |
| Signature | `use-signature-tool.ts` | + `SignatureModal.tsx` |
| Watermark | `use-watermark-tool.ts` | Mobile opens `MobileToolPropertiesModal` (right sidebar not mounted on mobile) |
| Background image | (config in store) | `BackgroundImagePropertiesContent.tsx`; preview via `mix-blend-mode: multiply`, export via `BlendMode.Multiply` |
| Form fields | `use-form-fields-editor.ts` | + `FormFieldsModal`, `form-fields.ts` |
| Page numbers | `use-page-numbers-editor.ts` | + `add-page-numbers.ts`, `renumber-page-numbers.ts` |
| Annotations panel | `use-annotations-editor.ts` | |
| Search | `use-pdf-search.ts` | + `PdfSearchBar`, `SearchHighlightLayer` |
| Find & Replace | (in `find-replace.ts`) | + `FindReplaceModal` |
| Manage Pages | `use-manage-pages-draft.ts` | Rotation baked into content stream (`append-pdf-page.ts`), not `/Rotate` metadata |

## Modals

All lazy-loaded via `next/dynamic`:

- `CreatePdfModal`, `ManagePagesModal`, `PerformancePanel`
- `MergePdfModal`, `SplitPdfModal`, `CompressModal`
- `SignatureModal`, `ShareModal`
- `VersionHistoryModal`, `VersionPreviewModal`
- `PasswordModal`, `ReloadConfirmModal`
- `AnnotationsModal`, `FormFieldsModal`, `PageNumbersModal`
- `FindReplaceModal`, `PageResizeDialog`, `ExportFormatModal`
- `ShapeLinkModal`, `MobileToolPropertiesModal`, `ToolsModal`

## Save + export

- **Save** (cloud persist) — `use-save-editor.ts` runs `merge-pdf.ts` on the fabric state + source bytes → uploads merged bytes → `postSaveReloadPending` latch + sticky `pdfDocument` guard prevents black flash / flicker on reload.
- **Export** — `use-export-editor.ts` runs `merge-pdf.ts` locally → downloads (PDF) or POSTs to backend converter (docx/xlsx/png/jpg/pptx/html/txt) → paywall gate for non-PDF formats (signed-in-only, after Clerk hydrated). See [`04-auth.md`](./04-auth.md).
- **Extract images** — `use-extract-images-editor.ts` (shell-level, keeps `fabricCanvas` ref); dispatched via `editor:extract-images`.
- **`merge-pdf.ts` `hasGenuineEdits` guard** — per-page loop guard: `editorType === "editModeText"`-only pages fall through to Case 1/2 (preserve text) instead of Case 3 (rasterize). Preserves selectable text on export / share / extract-images.
- **Page numbers overlay-only on Save** — `stripPageNumberOverlays` runs before merge on Save path (not Export). Download PDFs carry page numbers; cloud-saved PDFs render them from Fabric state on reload.
- **Sidebar reorder** — `materialize-page-order.ts` rebuilds source bytes with reordered pages, then merge runs against identity ordering.

## Autosave + reload

- **Signed-in autosave** — `use-editor-auto-persist.ts` writes Fabric state + config on debounce.
- **Signed-out autosave** — `use-signed-out-auto-persist.ts` mirrors into IDB.
- **Post-save reload** — sticky `pdfDocument` guard in the store + `postSaveReloadPending` flag keep the previous render visible while merged bytes reload → no black flash.

## Load-bearing invariants (verify before changing)

Full list + WHY in [`../../.claude/skills/pdf-editor-architecture/SKILL.md`](../../.claude/skills/pdf-editor-architecture/SKILL.md) decisions log. Highlights:

1. Fabric coords always at zoom=1 (base coords). `setZoom(zoom)` for rendering only.
2. Zoom changes resize the canvas; never re-mount.
3. IText `objectCaching: false` (paint-order sync).
4. **Mobile-touch trio** in `use-fabric-canvas.ts`: `allowTouchScrolling`, `upperCanvasEl.style.touchAction`, wrapper `touchAction` — all three synced per active tool. Drawing tools = `false / "none" / "none"`; everything else = `true / "pan-x pan-y" / "pan-x pan-y"`. Reverting any of the three freezes 1-finger pan when zoomed on iOS Safari.
5. **`mx-auto w-fit` scroll container** in `PdfViewerCanvas.tsx`. Do NOT replace with `flex justify-center` — flex centring traps the user at the centre of a zoomed-and-overflowing child on iOS Safari.
6. `ToolToolbar` uses `flex-wrap justify-center`, not `w-fit`, in `PvEditorTopChrome.tsx`. `w-fit` prevents wrap + pushes tools off-screen at higher browser zoom.
7. Fit-to-width capped at `MAX_ZOOM = 1.0`. Browser zoom-out inflates `clientWidth`; uncapped result exceeded toolbar max preset (2.0) and locked the `+` button.
8. pdfjs-dist ONLY loaded through `loadPdfJs()` (Safari polyfills + legacy build). Modern build + missing polyfills both break pdf.js on older iOS Safari WebKit.
9. Manage-Pages rotation baked into content stream (`append-pdf-page.ts`), not `/Rotate` metadata.
10. Shell-level `useExtractImagesEditor` hook + `editor:extract-images` event. Don't fold back into `HamburgerMenu` (no `fabricCanvas` ref → ships original upload, not edits → backend 400).
11. Text editing is tool-gated (mobile + desktop). Never flip `suppressText` unconditionally.
12. `PINCH_MIN_ZOOM = 0.5` floor in `PdfViewerCanvas`. Below 0.5, IText overlay disappears on iOS.
13. Background image preview uses `mix-blend-mode: multiply` on the PDF canvas; export uses `BlendMode.Multiply` on `drawImage`.

## Known mobile failure modes (all have bitten us before)

- pdf.js `getTextContent` throws on older iOS Safari WebKit → text layer blank. Safeguards: `loadPdfJs()` polyfills + tool-gated text extraction.
- pdf.js operator-list `argsArray[i]` is `null` on certain ops → `args[0]` throws. Guarded in `extractSequentialTextColors` with `?? []` coalesce.
- pdf.js fonts loading after first Fabric paint → glyphs render blank on iOS Safari. Fixed by `document.fonts.ready` await + `loadingdone` listener in `use-edit-text-mode.ts`.
- Fabric wrapper without `touch-action: none` → draw/highlight/eraser feel "sticky" on iOS.
- Pinch-zoom below 0.5 → IText overlay disappears. `PINCH_MIN_ZOOM` floor exists for this.
- Both pdf.js native text + Fabric IText overlay enabled at once → glyph doubling at DPR=3. `suppressText: true` unconditionally now; don't reintroduce mobile branch that flipped it.

## Mobile pre-push checklist

10-step list in [`../../CLAUDE.md`](../../CLAUDE.md) §"Mobile pre-push checklist". Any editor change MUST be walked through on iOS Safari + Android Chrome (or DevTools responsive mode with explicit disclosure) before push.

Summary:
1. PDF text loads on FIRST page (console: `text: extract ok`, `text: drew IText count > 0`)
2. Text loads on EVERY page
3. Tap-to-edit works (IText cursor + soft keyboard)
4. Pinch-zoom (~0.5 to ~2×) doesn't blank the page
5. Tools respond on first touch (not second)
6. Watermark + background image open in `MobileToolPropertiesModal` on mobile
7. Manage Pages flow — save-before-action toast → modal → save → no stale-pdf flash
8. Save uploads live edits (loading toast → success toast → reload preserves edits)
9. No console errors during the above
10. Build clean — `bunx tsc --noEmit && bun run lint && bun run build`

## Auth + paywall + export chain

Editor code participates in the 21-step chain. See [`04-auth.md`](./04-auth.md) + [`../../CLAUDE.md`](../../CLAUDE.md) §"Auth + paywall + export flow".

## Related files (key)

- `lib/client/pdf-editor/load-pdfjs.ts` + `pdfjs-polyfills.ts` — Safari-safe loader
- `lib/client/pdf-editor/merge-pdf.ts` — save/export/share pipeline (hasGenuineEdits guard)
- `lib/client/pdf-editor/build-pages-pdf.ts` — page-range builder
- `lib/client/pdf-editor/append-pdf-page.ts` — rotation-baked page append
- `lib/client/pdf-editor/materialize-page-order.ts` — sidebar reorder
- `lib/client/pdf-editor/text-extraction.ts` — extractor + color coalesce guard
- `lib/client/pdf-editor/watermark-drawer.ts` — watermark render (preview + export)
- `lib/client/pdf-editor/vector-drawers.ts` — shape/highlight drawers
- `lib/client/pdf-editor/persist-editor-document.ts` — IDB pending file
- `lib/client/pdf-editor/sanitize-source-bytes.ts` — pre-render sanitization
- `lib/client/pdf-editor/verify-pdf-password.ts` — password-protected doc handling
- `lib/client/pdf-editor/coordinate-transform.ts` + `color-utils.ts` + `svg-path-utils.ts` — helpers
- `lib/client/pdf-editor/font-mapping.ts` + `fabric-customizations.ts` — font + Fabric wiring
- `components/sections/pdf-editor/PdfEditorShell.tsx` — editor root
- `components/sections/pdf-editor/PdfViewerCanvas.tsx` — mobile-critical viewer
- `components/sections/pdf-editor/PvEditorTopChrome.tsx` — top chrome + tool toolbar
- `components/sections/pdf-editor/ThumbnailSidebar.tsx` — page thumbnails + drag-reorder
- `components/sections/pdf-editor/RightSidebar.tsx` — tool properties (desktop)
- `components/sections/pdf-editor/BottomDock.tsx` — mobile bottom dock
- `components/sections/pdf-editor/HamburgerMenu.tsx` — menu with save/export/extract/etc.
- `lib/client/hooks/pdf-editor/use-edit-text-mode.ts` — text tool
- `lib/client/hooks/pdf-editor/use-fabric-canvas.ts` — Fabric wiring (mobile-touch trio)
- `lib/client/hooks/pdf-editor/use-editor-document-loader.ts` — URL-driven load
- `lib/client/hooks/pdf-editor/use-export-editor.ts` — export + auth-aware paywall
- `lib/client/hooks/pdf-editor/use-save-editor.ts` — save pipeline
- `lib/client/hooks/pdf-editor/use-editor-auto-persist.ts` — signed-in autosave
- `lib/client/hooks/pdf-editor/use-signed-out-auto-persist.ts` — signed-out IDB autosave
- `lib/client/hooks/pdf-editor/use-editor-history.ts` — undo/redo
- `lib/client/hooks/pdf-editor/use-editor-navigation-save.ts` — save-before-navigate
- `lib/client/stores/pdf-editor-store.ts` — Zustand store

## Related

- [`04-auth.md`](./04-auth.md) — auth chain
- [`08-billing-paywall.md`](./08-billing-paywall.md) — paywall gate on export
- [`10-share-links.md`](./10-share-links.md) — save-before-share
- [`11-version-history.md`](./11-version-history.md) — version history
- [`16-locked-paths.md`](./16-locked-paths.md) — locked paths
- [`17-recovery.md`](./17-recovery.md) — regression rollback
