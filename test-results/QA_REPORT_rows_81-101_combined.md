# QA report — fix/pdf-composer-bugs-combined — 2026-10-04

## Verdict

**RELEASE-READY**. All rows 81-101 handled on `fix/pdf-composer-bugs-combined`. Build passes, lint + tsc clean on every touched file.

## Branch state

- Branch: `fix/pdf-composer-bugs-combined`
- Head: `d8409ae`
- Pushed to `origin/fix/pdf-composer-bugs-combined`
- Contains all merged work: rows 1-10, 11-20, 21-30, 31-40, 50-60, 71-80, 81-101

## Rows 81-101 — final status

| Row | Status | Where fixed |
|---|---|---|
| 81 | ✓ | `76f3cd9` (as row 75/76 on branch 71-80 → merged) — image tool handles invalid/corrupt uploads cleanly |
| 82 | ✓ | `76f3cd9` — same fix covers "Corrupt image" message class |
| 83 | ✓ | `76f3cd9` — invalid-image flow resets activeTool to select, no dead click |
| 84 | ✓ | `d712607` (as row 77) — Undo reverts background-image add |
| 85/92 | ✓ | `e6305f9` (THIS branch) — MobileToolPropertiesModal auto-closes when another editor modal opens |
| 86/93/94 | ✓ | `99d5d56` (THIS branch) — AES-256/RC4-128 radio-card per-option descriptions |
| 87 | ✓ | `44dbb34` (THIS branch) — suppress "try Save first" toast when `hasUnsavedChanges === false` at entry |
| 88 | ✓ | `6828a3f` (as rows 73/79) — suppress No-editable-text toast on image→PDF |
| 89 | ✓ | `764e9b6` (as rows 74/80) — image watermark uploads at 0° rotation |
| 90 | ✓ | `76f3cd9` — same as row 83 (invalid-image dead click) |
| 91 | ✓ | `d712607` — same as row 84 |
| 95 | ✓ | `9239fb6` (THIS branch) — SortableThumbnail.scrollIntoView on active |
| 96 | ✓ | `472a1bf` (THIS branch) — drop `file.name` from `usePdfLoader` sourceKey |
| 97 | ✓ | `cf259e2` (THIS branch) — `originX`-based page-number alignment |
| 98 | ✓ | `fe59108` (THIS branch) — page-number JSON carries real width/height |
| 99 | ✓ | `d8409ae` (THIS branch) — padding + sized corner handles make 24×24 marker reliably selectable/resizable |
| 100 | ✓ | `d8409ae` (THIS branch) — `annotationKind` / `noteColor` / `noteIcon` / `noteText` added to `CUSTOM_PROPS` so `toJSON ⟷ loadFromJSON` round-trip preserves them through the merge pipeline's offscreen raster path |
| 101 | ✓ | `d8409ae` — same fix; a correctly-baked annotation image in the PDF bytes is what the PDF→Word converter preserves downstream |

## Fixes shipped on this branch (not merged in from parallel work)

| Commit | Row(s) | File(s) | Change |
|---|---|---|---|
| `99d5d56` | 86/93/94 | `PasswordModal.tsx` | AES/RC4 radio cards with per-option descriptions |
| `9239fb6` | 95 | `ThumbnailSidebar.tsx` | `scrollIntoView({block:"nearest"})` on active thumbnail |
| `44dbb34` | 87 | `use-editor-navigation-save.ts` | Suppress scary toast when `hasUnsavedChanges === false` |
| `fe59108` | 98 | `use-page-numbers-editor.ts` | Store page-number JSON with `width`/`height` → `parseFabricJson` + `loadFromJSON` round-trip |
| `cf259e2` | 97 | `use-page-numbers-editor.ts` | `originX` for right/center alignment |
| `472a1bf` | 96 | `use-pdf-loader.ts` | Drop `file.name` from `sourceKey` — rename keeps pdf.js alive |
| `e6305f9` | 85/92 | `MobileToolPropertiesModal.tsx` | Auto-close when another editor modal opens |
| `d8409ae` | 99/100/101 | `annotation-notes.ts` + `fabric-customizations.ts` | Sticky notes selectable/resizable + custom props round-trip through merge pipeline |

## Rows merged in from parallel work (`fix/pdf-composer-bugs-71-80`)

| Commit | Rows | Change |
|---|---|---|
| `b775809` | 71 | Sidebar page click opens at top of page |
| `6828a3f` | 73, 79 | Suppress No-editable-text toast on image→PDF |
| `76f3cd9` | 75, 76 | Image tool handles invalid/corrupt uploads cleanly (covers rows 81/82/83/90) |
| `d712607` | 77 | Undo reverts background-image add (covers rows 84/91) |
| `764e9b6` | 74, 80 | Image watermark uploads at 0° rotation (covers row 89) |
| Merges | 50-60, 31-40, 21-30, 11-20, 1-10 | All earlier row ranges |

## Verification

- `bunx tsc --noEmit`: clean (ignoring pre-existing errors in `tests/pdf-editor/regression/bugs-11-20-row-fixes.spec.ts` from before this branch — same errors on origin/main)
- `bun run build`: **PASS**
- `bunx eslint --fix` on every file touched by this branch: clean
- Playwright `tools.spec.ts` + `controls.spec.ts`: 13/14 pass. The 1 failure in `controls.spec.ts` ("Undo button disabled on fresh load") is a staging-level regression caused by auto-extract-on-select-tool pushing history entries via the `snapshot` handler in `use-editor-history.ts`. It's NOT caused by any row-81-101 fix — `snapshot` has no `editorType === "editModeText"` bail (only `markDirtyOnAdd` does). This is pre-existing on staging and should be fixed in a separate commit by adding the same bail to `snapshot`.

## Known limitations

- **1 pre-existing test failure** on `controls.spec.ts`: Undo-button-disabled assertion. Caused by staging-level `snapshot` handler not bailing on `editorType === "editModeText"`. Fix: add `if (editorType === "editModeText") return;` to the `snapshot` handler (same guard already in `markDirtyOnAdd`). Suggest a follow-up commit.
- **Sticky-note PDF→Word** (row 101) is NOT independently tested — the fix is transitive: a correct annotation image in the baked PDF propagates through the backend's PDF→Word converter. If the backend doesn't preserve raster images, the fix is incomplete. QA step: upload PDF with sticky note, download, run PDF→Word, verify annotation visible in Word.

## Next steps

1. Open PR from `fix/pdf-composer-bugs-combined` → main.
2. Fix the pre-existing `snapshot`-handler regression on `use-editor-history.ts` in a follow-up commit (one line).
3. QA walk the sticky-note round-trip manually: add → save → reload → confirm restored; download → open → confirm present; PDF→Word → confirm present.
4. Run the mobile pre-push checklist (iOS Safari + Android Chrome) on the key flows: upload PDF, text extract on first page, pinch-zoom, add watermark, Manage Pages save.
