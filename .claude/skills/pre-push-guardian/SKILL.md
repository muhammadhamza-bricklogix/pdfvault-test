---
name: pre-push-guardian
description: Use before ANY git push, PR creation, "merge to main", or "ready to ship" claim in this repo. Walks the CLAUDE.md mobile pre-push checklist, runs `bunx tsc --noEmit && bun run lint && bun run build`, and blocks completion until every item is verified or explicitly waived. Also invoke when the user says "push it", "open a PR", "let's merge", "wrap it up", "ship it", "commit and push", or "we're done" — even if they don't explicitly ask you to verify. Mobile (iOS Safari + Android Chrome) is the #1 regression surface in this app, so skipping this skill has historically shipped broken text-layer, blank-page, and touch-action regressions to production. Do not skip.
---

# Pre-push guardian

This app has been burned repeatedly by regressions that render fine on desktop but break on real phones: pdf.js text-layer going blank on iOS Safari, Fabric touch-action locking scroll, watermark flow losing selectable text on export, sign-in redirect loops in the auth/paywall chain. The CLAUDE.md "Mobile pre-push checklist" and "Auth + paywall + export flow" sections encode the fixes; this skill is the forcing function that makes sure you actually run them before pushing.

Your job: walk every applicable check, report results honestly, and refuse to claim "ready to push" until each item is either **verified** or **explicitly waived** by the user (with the reason recorded in the summary).

## When this skill applies

Trigger this skill whenever any of these apply:
- The user asks you to push, open a PR, merge, ship, or commit-and-push.
- You are about to say some variation of "this is ready", "all set", "done", "good to go".
- You just finished a change under `lib/client/pdf-editor/**`, `lib/client/hooks/pdf-editor/**`, `components/sections/pdf-editor/**`, or any file listed in the CLAUDE.md "Auth + paywall + export flow" chain.

If the diff is tiny and demonstrably non-code (README typo, comment-only edit), you may skip mobile checks — but say so explicitly in the summary. Never silently skip.

## Step 1 — Classify the change

Read `git diff main...HEAD --stat` (or `git diff --stat` for uncommitted work). Categorize each changed file:

| Bucket | Files | Required verification |
|---|---|---|
| PDF editor | anything under the three folders above, plus `lib/client/stores/pdf-editor-store.ts` | **Full mobile checklist** (Step 3) |
| Auth / paywall chain | files listed in CLAUDE.md "Auth + paywall + export flow" | **Auth chain audit** (Step 4) |
| Landing / marketing UI | `components/sections/landing/**`, `app/(marketing)/**` | Desktop smoke + Lighthouse-light spot check |
| Config / infra | `package.json`, `next.config.*`, `proxy.ts`, `.eslintrc*`, hooks | `bunx tsc --noEmit && bun run lint && bun run build` + call out risk |
| Docs / comments only | `*.md`, comment-only diffs | Announce as "docs-only, skipping mobile" |

If nothing falls in the first two buckets, you can skip Steps 3–4 but still run Step 2.

## Step 2 — Baseline gate (always)

Run these three, in order. If any fail, STOP and fix before continuing:

```bash
bunx tsc --noEmit
bun run lint
bun run build
```

Report each pass/fail verbatim. Do NOT claim "passes" if you haven't run them in this session. Do NOT re-use output from an earlier turn — the diff may have changed.

## Step 3 — Mobile checklist (PDF-editor changes)

Walk the ten items from CLAUDE.md's "Mobile pre-push checklist" section. For each item, output one of:

- ✅ **verified** — how you tested (real device / DevTools responsive at iPhone 14 or Pixel 7) and what you saw
- ⚠️ **waived** — why the item doesn't apply to this diff, or user's explicit "skip"
- ❌ **failed** — what broke; STOP and fix

The ten items (source: CLAUDE.md — always re-read it rather than trusting this summary):

1. PDF text loads on the FIRST page + `[PDFedits]` logs fire as expected
2. Text loads on EVERY page (paginate through)
3. Tap-to-edit text — cursor + soft keyboard + font match
4. Pinch-zoom doesn't blank the page (2x out, 0.5x in)
5. All tools respond on first touch (draw, highlight, eraser, shape)
6. Watermark + background image open in `MobileToolPropertiesModal` (bottom sheet), NOT sidebar
7. Manage Pages: save-before-action toast → modal → rotate/reorder/delete → Save
8. Save uploads the live edits (loading toast → success → re-open shows baked-in edits)
9. No red console errors during any of the above — only `[PDFedits]` info logs
10. Baseline gate from Step 2 passes

**You almost certainly cannot run a real iPhone from this session.** Say so explicitly. DevTools "Responsive" at iPhone 14 / Pixel 7 sizing is the fallback — and it is a fallback, not equivalence. If you tested only in DevTools, put that in the summary. Never claim "verified on iOS Safari" from DevTools.

If a check requires code inspection instead of running the app (e.g. "does `suppressText: !isMobile` still exist"), grep and cite the file:line.

## Step 4 — Auth chain audit (auth/paywall/export changes)

For every file you changed that appears in the CLAUDE.md "Auth + paywall + export flow" list, walk the numbered invariant and confirm it still holds:

- Re-read the relevant items (1–21) in CLAUDE.md.
- Grep for the load-bearing patterns (e.g. `useAuth()` in `useExportEditor`, `dispatchSignInPrompt` call sites, `authLoaded` guards in `PendingEditorFileHydrator`, `window.location.assign` in login/signup cards).
- Run `bun run test tests/pdf-editor/export-signin-redirect.spec.ts` if Playwright is set up — it guards items 1–4 and 8.

Any missing guard or altered invariant is a **hard block**. Do not push. Surface the specific item number and file:line, then ask the user before proceeding.

## Step 5 — Off-limits + LOCKED_PATHS scan

Even if the baseline gate passes, check that the diff didn't accidentally touch anything in `.claude/LOCKED_PATHS` or the "Off-limits without explicit user approval" list in CLAUDE.md.

```bash
git diff main...HEAD --name-only | while read f; do
  grep -q "^$f\|^${f%/*}/\*\*" .claude/LOCKED_PATHS 2>/dev/null && echo "LOCKED: $f"
done
```

If any locked file appears in the diff and the PreToolUse hook didn't block it (e.g. bypass was set), STOP and get explicit user approval before pushing.

## Step 6 — Report

Give the user a summary in this exact shape:

```
Pre-push guardian report — <branch>

Bucket(s): <PDF editor | auth chain | landing | config | docs-only>

Baseline gate:
  tsc:   pass|fail
  lint:  pass|fail
  build: pass|fail

Mobile checklist: <n/10 verified, n waived, n failed>  (skip if not PDF editor)
  1. …
  …

Auth chain audit: <ok | violations>  (skip if not auth chain)
  Item N (file:line) — status

LOCKED_PATHS scan: clean | touched: <files>

Verdict: READY TO PUSH | BLOCKED — <reason>
```

**Never** report "ready to push" if:
- Any baseline gate fails
- Any mobile check is `❌ failed`
- Any auth chain invariant was broken
- LOCKED_PATHS was touched without approval
- You didn't actually run the checks (dry-runs from earlier turns don't count)

If the user says "ship it anyway" after a block, record their override in the summary before continuing — this is the paper trail for when the regression comes back.
