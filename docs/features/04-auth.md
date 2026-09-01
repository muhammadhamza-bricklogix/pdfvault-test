# 04 — Authentication + session continuity

**Snapshot date:** 2026-09-01
**Status:** Production-critical. The 21-step chain in [`../../CLAUDE.md`](../../CLAUDE.md) §"Auth + paywall + export flow" is load-bearing; each item fixes a specific user-reported bug.

## Provider

`ClerkProvider` (`@clerk/nextjs` v7) is the outermost provider in `app/layout.tsx`. Middleware lives at `proxy.ts` (repo root — named for historical reasons but behaves as `middleware.ts`).

## Sign-in / sign-up flow

Custom cards in `components/sections/auth/`. Hooks:

- `lib/client/hooks/auth/use-sign-in-flow.ts` — password, magic link, 2FA
- `lib/client/hooks/auth/use-sign-up-flow.ts` — email + password (staging Clerk requires password mode; email-only stranded users at `/sign-in` with no account)
- `lib/client/hooks/auth/use-user-sync.ts` — mirrors Clerk user → backend `/users/me`

### Sign-in supported strategies

1. Email + password
2. Magic link (email code)
3. 2FA — `signIn.mfa.sendEmailCode()` + `verifyEmailCode()` (branch on `signIn.status === "needs_second_factor"`)

Skipping the 2FA branch silently loops 2FA-enabled accounts back to sign-up.

### Sign-up default mode

`SignupCard` defaults to password mode. Staging Clerk config requires a password on first signup — email-only mode stranded users at `/sign-in` with no account. See [`../../.claude/memory/project_signup_default_password.md`](../../.claude/memory/project_signup_default_password.md).

### Finalize navigation

Both login + signup cards use `window.location.assign(finalizeUrl)` — **not** `router.push`. Reason: iOS Safari commits the Clerk session cookie during the full-page navigation. `router.push` outraces the cookie commit → middleware sees the next request as signed-out → bounces the user back to sign-up. This is a documented, tested workaround.

### Cross-nav preserves `redirect_url`

Login ↔ signup cross-navigation links forward the `redirect_url` query param. Otherwise users returning from cross-nav lose their pending editor file. See [`../../.claude/memory/project_auth_link_redirect_url.md`](../../.claude/memory/project_auth_link_redirect_url.md).

## Global sign-in prompt

`components/shared/sign-in-prompt-modal.tsx` — mounted in `AppProviders`. It's a confirm dialog with **Cancel** and **"Sign in & continue"** buttons. Dispatched via `dispatchSignInPrompt` (custom event bus).

Used everywhere a signed-out user tries a gated action — always gives them a way out. Do NOT replace with a raw redirect.

## Signed-out edit → sign-in continuity (the 21-step chain)

The most important flow in the app. A signed-out user drops a PDF, edits it, clicks Download → DOCX, signs in, gets paywall or download — with no dropzone flash, no dashboard bounce, no lost edits, no paywall dead-end.

Full trail: [`../../CLAUDE.md`](../../CLAUDE.md) §"Auth + paywall + export flow". Session spec: [`../../.claude/specs/2026-07-30-signout-edit-persistence.md`](../../.claude/specs/2026-07-30-signout-edit-persistence.md).

### Summary of the flow

1. Signed-out user drops a PDF on `/pdf-composer` or a tool landing.
2. `use-signed-out-auto-persist.ts` writes the file + edits (Fabric JSON + `extractedPages`) to IndexedDB (`lib/client/upload/pending-editor-file.ts`).
3. User hits Download / Export / auth-gated tool → `use-export-editor.ts` reads Clerk directly (`useAuth()`, not the store copy) → dispatches `SignInPromptModal`.
4. User signs in → returns to `/pdf-composer?tool=…&export=…` (no `?id`).
5. `pending-editor-file-hydrator.tsx` sees `authLoaded && isSignedIn && (tool || export) && !id && IDB has file` → uploads file → gets doc id → `router.replace(?id=<newId>&tool=&export=)`.
6. `use-editor-document-loader.ts` picks up the new id and loads the doc.
7. `use-export-editor.ts` auto-fires the queued export.

### Why each piece exists (highlights)

- **`useExportEditor` reads `useAuth()` directly, not `store.isSignedIn`.** The store copy is synced by a downstream `useEffect` in `PdfEditorShell` and lags one tick during post-signin returns. Reading Clerk directly avoids the sign-in redirect loop.
- **`useExportEditor` re-dispatches `editor:export` after 250ms if Clerk hasn't hydrated.** The auto-launch event can fire faster than `authLoaded`.
- **`useExportEditor` gates non-PDF exports on `!signedIn` FIRST, before `requestPaywall`.** Paywall's `POST /billing/checkout-intent` needs auth. Signed-out user in paywall = "Couldn't start checkout" dead-end.
- **`PendingEditorFileHydrator` Step 1 waits for `authLoaded` before AUTH_GATED_TOOLS redirect.**
- **Step 2 has TWO paths** — post-signin restore (deterministic upload + `router.replace`) vs normal rehydrate (background auto-save). Deterministic path is essential; skipping it re-introduces the dashboard-bounce race.
- **Step 3 does NOT update the URL if `?tool` or `?export` is present.** Race between `setCurrentDocument` and `router.replace` triggered loader against a doc that hadn't propagated → 404 → dashboard bounce.
- **Step 4 (auto-launch) waits for `authLoaded`.**
- **`isRestoringSession=true` before post-signin save + toggled off in finally.** `PdfEditorShell` renders `<EditorLoadingShell />` while true → kills the dropzone flash.
- **`PdfEditorShell` synchronously shows `<EditorLoadingShell />` if URL has `?export` or `?tool` without `?id`** AND Clerk is loading OR signed-in. Prevents dropzone flash on the FIRST render before the hydrator's effect kicks in.
- **`useEditorDocumentLoader` non-401 error branch checks `store.file` before redirecting to `/dashboard`.** If a file is loaded, stay put with a friendly toast. Dashboard bounce is destructive mid-flow.

## Duplicate upload detection

`findDuplicateByFilename` (in `documents-service`) runs before every `documentsService.uploadDocument`. If a match exists in the user's library, skip re-upload and navigate to the existing doc id. Prevents "user creates infinite duplicates" bug.

## Related files

| File | Role |
|---|---|
| `proxy.ts` | Clerk middleware |
| `components/sections/auth/` | Login + signup + forgot-password cards |
| `components/shared/sign-in-prompt-modal.tsx` | Global sign-in confirm dialog |
| `components/shared/pending-editor-file-hydrator.tsx` | Post-signin rehydrate |
| `lib/client/hooks/auth/use-sign-in-flow.ts` | Sign-in card logic |
| `lib/client/hooks/auth/use-sign-up-flow.ts` | Sign-up card logic |
| `lib/client/hooks/auth/use-user-sync.ts` | Backend user sync |
| `lib/client/auth/auto-signup.ts` | Auto-signup helper |
| `lib/client/auth/get-auth-token.ts` | Token retrieval |
| `lib/client/upload/pending-editor-file.ts` | IDB pending record |
| `lib/client/hooks/pdf-editor/use-export-editor.ts` | Reads `useAuth()` directly |
| `lib/client/hooks/pdf-editor/use-signed-out-auto-persist.ts` | IDB autosave for signed-out |
| `lib/client/hooks/pdf-editor/use-editor-document-loader.ts` | URL-driven doc load |

## Playwright coverage

- `tests/pdf-editor/export-signin-redirect.spec.ts` — guards chain items 1–4 and 8

## Related

- [`03-providers.md`](./03-providers.md) — `SignInPromptModal` provider mount
- [`06-pdf-editor.md`](./06-pdf-editor.md) — editor invariants that touch the chain
- [`08-billing-paywall.md`](./08-billing-paywall.md) — paywall behavior after sign-in
- [`16-locked-paths.md`](./16-locked-paths.md) — auth chain files are locked
