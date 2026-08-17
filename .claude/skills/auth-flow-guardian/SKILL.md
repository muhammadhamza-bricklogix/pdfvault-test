---
name: auth-flow-guardian
description: MANDATORY load before editing ANY file in the 21-item auth/paywall/export chain documented in CLAUDE.md — including `lib/client/hooks/pdf-editor/use-export-editor.ts`, `lib/client/hooks/billing/use-paywall.ts`, `components/shared/pending-editor-file-hydrator.tsx`, `components/shared/sign-in-prompt-modal.tsx`, `components/sections/pdf-editor/PdfEditorShell.tsx`, the login/signup cards, `components/shared/upload-workspace.tsx`, `components/shared/upload-toast-provider.tsx`, `components/shared/all-tools-catalog.tsx`, `components/shared/weglot-loader.tsx`, or `lib/client/hooks/pdf-editor/use-editor-document-loader.ts`. Also load whenever the user mentions sign-in redirect loops, paywall dead-ends, "couldn't start checkout", the dropzone flash on return, iOS Safari session cookie bounces, 2FA sign-in, duplicate-upload detection, or Weglot switcher regressions. Ten commits over 2026-07-18 to 2026-07-19 wired this chain and each item exists to fix a specific bug the user has already reported and re-fixed multiple times — reverting any single item re-introduces a user-visible regression. Do not attempt "cleanup" or "simplification" of these files without reading this skill first.
---

# Auth-flow guardian

CLAUDE.md documents 21 numbered invariants under "Auth + paywall + export flow (do NOT unravel)". Each one exists because a specific journey — signed-out user drops a PDF → clicks Download → DOCX → signs in → gets paywall or download — broke in a specific way. The user has fixed each break in turn. Every invariant is load-bearing.

Your job when editing anything in this chain: understand which invariants your change touches, verify each one still holds, and refuse to "simplify" a piece without proof the underlying bug can't recur.

## Files in the chain

Any edit to these files activates this skill:

| File | Invariants |
|---|---|
| `lib/client/hooks/pdf-editor/use-export-editor.ts` | 1, 2, 3, 4 |
| `lib/client/hooks/billing/use-paywall.ts` | 5 |
| `components/shared/pending-editor-file-hydrator.tsx` | 8, 9, 10, 11, 12 |
| `components/shared/sign-in-prompt-modal.tsx` | 4 (renderer for the prompt) |
| `components/sections/pdf-editor/PdfEditorShell.tsx` | 13 |
| `components/sections/billing/PaywallModal.tsx` | 6, 7 |
| `lib/client/hooks/pdf-editor/use-editor-document-loader.ts` | 14 |
| Login card (`components/sections/(auth)/login/**` or similar) | 15, 16 |
| Signup card | 15 |
| `components/shared/upload-workspace.tsx` | 17, 18, 19 |
| `components/shared/upload-toast-provider.tsx` | 19 |
| `components/shared/all-tools-catalog.tsx` | 20 |
| `components/shared/weglot-loader.tsx` + `app/globals.css` | 21 |

**Path lookups may be stale** — re-read the CLAUDE.md "Auth + paywall + export flow" section and grep for the actual file path before trusting this table.

## Procedure

### 1. Read the chain, don't skim

Before your first edit, read the ENTIRE "Auth + paywall + export flow" section in CLAUDE.md. All 21 items. It's ~40 lines. Skimming has burned this project before — user's #1 complaint is "you fixed one thing and broke three".

### 2. Identify affected invariants

For your specific change, list every numbered invariant that could be touched. Err high. If you're editing `use-export-editor.ts`, that's items 1–4; if you're changing anything about the modal it dispatches, item 4 is also in play.

### 3. Grep to confirm the current state matches the invariant

Before editing, verify the invariant is still in the code. For example, item 1 says `useExportEditor` reads `useAuth()` directly. Grep it:

```bash
grep -n "useAuth\|isSignedIn" lib/client/hooks/pdf-editor/use-export-editor.ts
```

If the grep shows the invariant is intact → good, don't break it. If it's already been changed → flag that to the user; something already regressed.

### 4. Change with intent, not shape

Every one of these invariants has a **why**. Item 1 exists because `store.isSignedIn` lags one tick after Clerk hydration; reading `useAuth()` directly avoids the sign-in redirect loop. If you're proposing a change to the item, articulate what happens to that specific bug under the new code. If you can't, don't make the change.

### 5. Run the guarded test suite

The Playwright spec `tests/pdf-editor/export-signin-redirect.spec.ts` guards items 1–4 and 8. Run it before claiming your change is safe:

```bash
bun run test tests/pdf-editor/export-signin-redirect.spec.ts
```

If Playwright isn't wired up locally, say so and run the equivalent manual flow: signed-out user drops a PDF → Download → DOCX → sign in → confirm paywall/download works, no dropzone flash on return.

### 6. Post-change checklist

Before handing off:

- [ ] Every invariant in your list still holds (grep + reasoning)
- [ ] `bun run test tests/pdf-editor/export-signin-redirect.spec.ts` passes
- [ ] Manual iOS Safari flow (see #5) tested if items 15 or 21 were touched — `window.location.assign` cookie-commit behavior and Weglot switcher injection are iOS-Safari-only
- [ ] No `router.push` where the chain requires `window.location.assign` (item 15)
- [ ] No `toast.loading` where the chain requires `<UploadToastProvider placement="bottom start" />` (item 19)
- [ ] `pre-push-guardian` skill also invoked (auth chain changes always trigger a mobile check)

## Common anti-patterns you WILL be tempted to make

These have all been proposed and rejected before. Do not propose them again without reading the referenced commit for the reason:

- **"Just read `store.isSignedIn` — it's already synced."** No. See item 1. The store copy lags by one tick during post-signin returns.
- **"Replace `dispatchSignInPrompt` with a plain `router.push('/sign-in')`."** No. See item 4. The user needs a Cancel button — a raw redirect kills the flow.
- **"Combine steps 2 and 3 in the hydrator — the async auto-save handles the post-signin case."** No. See items 9 and 10. The race between `setCurrentDocument` and `router.replace` produces a 404 and dashboard-bounces the user mid-flow.
- **"Use `router.push` for the finalize navigation — it's the Next.js idiom."** No. See item 15. iOS Safari commits the Clerk session cookie during the full-page navigation only; `router.push` outraces the cookie.
- **"Pass `onClose` alongside `onPaymentSuccess` in the paywall — safer."** No. See item 7. `onPaymentSuccess` is async; `onClose` races and cancels the queued action.
- **"Remove the `authLoaded` guard in the hydrator — Clerk is always loaded by then."** No. See items 8, 10, 11. Auto-launch fires faster than Clerk hydration.
- **"Fold image extraction back into `HamburgerMenu`."** No — that's a PDF-editor invariant (skill: `pdf-editor-architecture`), not auth, but it comes up in the same conversations. The menu has no `fabricCanvas` ref.

## When to escalate to the user

- The task genuinely requires changing an invariant. Ask before editing — this is the paper trail.
- You find that an invariant is already broken in `main` (i.e., grep shows the code no longer matches CLAUDE.md). Flag it — a regression has landed unnoticed.
- The Playwright spec fails on the base branch (pre-change). Same reason.
