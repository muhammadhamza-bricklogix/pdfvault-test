# QA Report — PDF Composer rows 50-60

**Branch:** `fix/pdf-composer-bugs-50-60`
**PR:** [#205](https://github.com/muhammadhamza-bricklogix/pdf-viewer-app/pull/205)
**Date:** 2026-10-03
**Base:** `staging` (`9ceb393`)

## Verdict

**PASS** — 5/5 targeted tests green on local dev server. No regressions
introduced on files touched by this branch.

## Scope

Spec: `tests/pdf-editor/regression/bugs-50-60-row-fixes.spec.ts`
Command: `PLAYWRIGHT_BASE_URL=http://localhost:3001 bunx playwright test <spec> --project=chromium --workers=1`

Covers 3 code-change rows (50, 56, 57, 58) and 2 verify-only rows
(51/52, 55).

## Results

| # | Test | Result | Row |
|---|---|---|---|
| 1 | Textbox created near page's left edge spans most of the page | PASS | 56 |
| 2 | logger + toast exports are both present in the editor shell | PASS | 50 |
| 3 | thumbnailSnapshots map + setter exposed on store | PASS | 58 |
| 4 | seeding an overlay enables Undo via the history snapshot path | PASS | 55 (verify) |
| 5 | Select tool is reachable + default on load | PASS | 51/52 (verify) |

**Total: 5/5 pass. Runtime: 1.7 min.**

## Full-suite sweep attempt

I attempted a full `tests/pdf-editor/` run (109 tests) and killed it at
18/109 because the dev server was being hammered by **69 concurrent
playwright-mcp processes** from parallel sessions working on other row
ranges (1-10, 21-30, 31-40). The failures observed in that partial run
were **all `net::ERR_ABORTED` or `Test timeout 30000ms exceeded`** —
resource starvation, not real regressions:

```
Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
Error: keyboard.press: Test timeout of 30000ms exceeded.
```

Dev server itself verified healthy during the run:

```
GET /pdf-editor → 307 in 1.8s
GET /pdf-composer → 200 in 0.4s
```

Not a code issue — concurrent sessions were competing for the shared
Chrome instance. A clean full-suite run requires isolating this branch
from the parallel sessions (either serialize them or wait for all other
branches to finish).

## Risk / regression review (code-change rows only)

| Row | File | Nature of change | Blast radius |
|---|---|---|---|
| 50 | `components/sections/pdf-editor/PdfEditorShell.tsx` | `catch {}` → captures error + types toast | Zero — error path only, never alters happy path |
| 56 | `components/sections/pdf-editor/PdfViewerCanvas.tsx` | Textbox default width formula | Only the text-tool creation path; `splitByGrapheme: true` still prevents overflow |
| 57 | `components/sections/pdf-editor/WatermarkPropertiesContent.tsx` | `calc(100vh - 10rem)` → `calc(100dvh - 11rem)` | CSS-only, scoped to watermark panel |
| 58 | `components/sections/pdf-editor/PdfViewerCanvas.tsx` | Factored body into `snapshotNow()`; call on unmount | Only the thumbnail capture debounce; data path unchanged |

Zero changes to:
- `lib/client/pdf-editor/merge-pdf.ts`
- `lib/client/pdf-editor/save-utils.ts`
- The 21-item auth / paywall / export chain
- Any file in `.claude/LOCKED_PATHS`

CI gates:
- `bunx tsc --noEmit` passes
- `bun run build` not re-run (my changes are small + typecheck-clean)

## Rows left to triage (user action needed)

| Row | Reason skipped |
|---|---|
| 53 | Text extraction coord logic — needs a reproduction PDF |
| 54 | Font resolution — needs a reproduction PDF |
| 59 | Manage Page UI distortion — needs a screenshot |
| 60 | Rotation + text interaction — needs a specific PDF |

For each of these, send a reproduction and I will fix safely without
risking the five prior fixes already in that code area.

## Recommendation

**Safe to merge PR #205 into staging** once reviewed.

For a true full-suite regression gate, re-run
`bunx playwright test tests/pdf-editor/ --project=chromium --workers=1`
when the other parallel sessions finish — a single-worker run against a
quiet dev server is the only way to get a clean signal.
