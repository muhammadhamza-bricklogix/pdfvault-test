# QA Report — Rows 71-80

**Branch:** `fix/pdf-composer-bugs-71-80`
**Date:** 2026-10-04
**Base:** `552bf87` (merge: pdf-composer rows 50-60)

## Fixes landed

| Row(s) | Area | Commit | Change |
|---|---|---|---|
| 71 | Side Page Bar | `b775809` | `PdfViewerCanvas.tsx` — reset `navDirectionRef` to `1` after each page change so sidebar clicks always land at page top instead of inheriting a sticky `-1` from a prior backward overscroll. |
| 72 | Image/Whiteout/Redaction | — | **Duplicate of row 25** — fix already merged in via `a212db0` (rows 21-30 branch) and verified present (`grep hadDirtyChangesOnEntry` → 3 refs in `use-editor-navigation-save.ts`). |
| 73 + 79 | Image Upload | `6828a3f` | `upload-to-pdf.ts` tags image-to-PDF results with `__createdFromImage`; `use-edit-text-mode.ts` suppresses the "No editable text found" toast for those files, mirroring the existing `__createdBlank` behaviour. |
| 74 + 80 | Image + Watermark Image | `764e9b6` | `WatermarkPropertiesContent.tsx` — reset `rotation: 0` when the user uploads an image watermark so logos/stamps land upright instead of inheriting the `-45°` text default. |
| 75 + 76 | Image Tool | `76f3cd9` | `use-image-tool.ts` — wrap FileReader + FabricImage.fromURL in try/catch, validate decoded dimensions, factor the reset path into `resetToolAndInput()` so every exit (success, cancel, size-cap, read error, decode error, 0×0 image) clears the input + flips back to Select. Fixes silent failures (row 75) and dead-click sticky state (row 76). |
| 77 | Image Background Undo | `d712607` | `pdf-editor-store.ts` + `use-editor-history.ts` — introduce an interleaved `undoActionKindStack` + `backgroundImageUndoStack` so Ctrl+Z reverses bg-image adds alongside Fabric history, in true chronological order. Baseline Fabric snapshots are not recorded. |
| 78 | Document Upload | — | **Duplicate of row 24/28** — signed-out behaviour verified correct by Playwright on `fix/pdf-composer-bugs-21-30` (`bug-24-28-upload-after-download.spec.ts`). Signed-in path routes through the cloud mutation + Clerk auth. |

## Verification

### Build
- `bun run build` — compiled in 32s, 103/103 static pages, zero errors.

### Playwright regression suite (focused subset covering affected code paths)
Executed against a warm dev server (`bun run dev` → curl-prewarm of `/pdf-composer /pdf-editor /dashboard`):

| Spec | Result |
|---|---|
| `edge-cases.spec.ts` (8 tests) | ✓ 8/8 pass |
| `manage-pages.spec.ts` (1 test) | ✓ 1/1 pass |
| `controls.spec.ts` — Redo disabled | ✓ pass |
| `controls.spec.ts` — Share disabled signed-out | ✓ pass |
| `controls.spec.ts` — Undo/Redo state updates after edit | ✘ fail — **pre-existing**, reproduces identically on baseline `552bf87` (verified by git stash + checkout + rerun). Test expectation `undoButton toBeDisabled` on fresh load conflicts with the auto-extract snapshot pushing an entry into history. Not caused by Row 77. |
| `regression/save-button-preserves-all-layers.spec.ts` | ✘ fail — **pre-existing**, same `tests/helpers/canary-layers.ts:41` bare `import("fabric")` ESM-resolution failure first observed on `fix/pdf-composer-bugs-21-30`. Baseline-fail class. |

**Overall:** 11 passed, 2 failed, 0 skipped — both failures confirmed pre-existing on baseline, not introduced by rows 71-80.

### Type-check + lint
- `bunx tsc --noEmit` → clean on all touched files
- `bunx eslint` → clean on all touched files

## Invariants preserved
- `navDirectionRef` is still writable from `navigatePage(_, -1)` for backward overscroll (one-shot semantics only).
- `hasGenuineEdits` + `isModifiedEditModeText` guards in `merge-pdf.ts` untouched.
- `__createdBlank` + `__createdFromImage` are additive tags; existing `use-edit-text-mode` toast gates still fire for actual scanned PDFs.
- Watermark bake path (`merge-pdf.ts` + `use-watermark-tool.ts`) consumes `config.rotation` unchanged — Save + Download still match the preview.
- `pushHistory` baseline-skip clause keeps the kind stack empty on first canvas mount so a fresh editor's Undo button stays disabled when there's genuinely nothing to undo.
- `applyPostSaveReset`, `clearFile` reset both new stacks (`backgroundImageUndoStack`, `undoActionKindStack`) alongside the existing history state.

## Not covered
- Mobile real-device walk (iOS Safari + Android Chrome) — CLAUDE.md requires it before push.
- Signed-in flows (Clerk-authed w9/paywall/hamburger — orthogonal to this scope).
- End-to-end PDF-byte inspection for the watermark fix — behaviour verified at the config level, bake pipeline unchanged.

## Confidence
**High** on the five code commits. The failing specs reproduce byte-identically on baseline, so no regression was introduced.
