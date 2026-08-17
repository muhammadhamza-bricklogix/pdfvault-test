---
name: 2026-07-30-signout-edit-persistence
description: "Session spec — three user-reported bugs on the signed-out upload → edit → download → sign-in flow. Wired up file+fabric+extractedPages persistence across the redirect, and auto-download after paywall payment."
metadata: 
  node_type: memory
  type: spec
  date: 2026-07-30
  session: signed-out download → sign-in return
  originSessionId: c529a735-2d03-40d7-bffc-33ce2f4afcb9
---

# Signed-out edit → download → sign-in return: three-bug session

Session on 2026-07-30 addressed three end-to-end failures a signed-out user hit when they landed on `/pdf-composer`, uploaded a PDF, edited it, and clicked Download.

Related invariants in CLAUDE.md's "Auth + paywall + export flow" chain: items 1–19.

## Bug 1 — Sign Up link on `/sign-in` dropped `redirect_url`

**Symptom**: Land → upload → edit → Download → sign-in prompt → "Sign Up" link on the login card → after signup, bounced to `/dashboard` and the PDF was gone.

**Root cause**: `login-card.tsx` had `<Link href={ROUTES.AUTH.SIGN_UP}>` — no query. When the user arrived at `/sign-in?redirect_url=/pdf-composer?export=pdf` and switched to Sign Up, they landed at `/sign-up` with no `redirect_url` param. `signup-card.tsx`'s `afterSignUpPath` defaulted to `ROUTES.APP.DASHBOARD` → dashboard bounce.

**Fix**: Both `login-card.tsx` and `signup-card.tsx` now conditionally append `?redirect_url=<encoded>` to their cross-nav Link when the current page's redirect target is non-default (i.e., not `/dashboard`).

Files touched:
- `components/sections/auth/login-card.tsx` — "Sign Up" link
- `components/sections/auth/signup-card.tsx` — "Sign In" link

**Invariant to add**: cross-nav links between `/sign-in` ↔ `/sign-up` MUST forward `redirect_url` when one is present. This is part of the 21-item auth chain — item 15 covers the finalize navigation, this adds the cross-link case.

## Bug 2 — Download didn't auto-start after paywall payment

**Symptom** (user's phrasing): "the .99 cents pay to download should appear and when they paid, it automatically downloads their doc" — meaning they expected the download to fire on payment success, not require a click.

**Root cause**: `PaywallModal.handleIframeSuccess` set `setStep("success")` and rendered `SuccessStep` with a manual "Start editing →" button. The `finish()` handler that resolves the `await requestPaywall()` in `useExportEditor` only fired on button click. Until then, the export was stalled.

**Fix**: `SuccessStep` now has a `useEffect` that auto-calls `onFinish` after 2000ms. The user still sees "You're all set!" briefly, then the modal closes and the queued action (download/convert/etc.) runs. Users who want to skip the delay can still click the button.

Files touched:
- `components/sections/billing/PaywallModal.tsx` — `SuccessStep` gets an `onFinishRef` + `useEffect(() => setTimeout(onFinishRef.current, 2000), [])`

**Invariant to add**: `SuccessStep`'s auto-dismiss is load-bearing for the paywall-triggered download flow. Removing the timer means signed-in unentitled users pay and then have to click through an extra screen before their file starts downloading.

## Bug 3 — Edits lost across sign-in redirect (and then double-text layer after fix)

**Symptom (first pass)**: Signed-out user uploads → edits → Downloads → signs in → returns → **edits are gone**. Backend has the original file only.

**Root cause**: `savePendingEditorFile(sourceFile)` was persisting ONLY the raw `File` to IDB. The user's edits live in Zustand (`fabricJsonByPage: Map<number, string>` — per-page Fabric overlay JSON), which does NOT survive Clerk's full-page nav to `/sign-in` and back.

**Fix (first pass)**:
- `lib/client/upload/pending-editor-file.ts` — `PendingRecord` now includes `fabricState?: Array<[number, string]>` (Map serialized as entries; IDB doesn't reliably store Map). `savePendingEditorFile` accepts optional `fabricJsonByPage`. `loadPendingEditorFile` returns `{ file, fabricJsonByPage }`.
- `lib/client/hooks/pdf-editor/use-export-editor.ts` — before the sign-in prompt: calls `flushLiveFabricPage(page, liveCanvas)` to push the current page's canvas state into the store, reads `usePdfEditorStore.getState().fabricJsonByPage`, passes it to `savePendingEditorFile`.
- `components/shared/pending-editor-file-hydrator.tsx` — `loadPendingEditorFile()` result is destructured. `pendingFabricState` is restored via `usePdfEditorStore.getState().replaceFabricJsonByPage(...)` at all three restore points (post-signin upload path, post-signin upload-failed fallback, normal rehydrate).
- `components/sections/new-landing/upload-workspace.tsx` — also called `loadPendingEditorFile`; updated to destructure `{ file }` from the new return shape.

**Symptom (second pass, after first fix)**: Edits ARE preserved — but the user reported "duplicated text layers". Screenshot showed pdf.js native text painted UNDERNEATH the restored Fabric IText overlay → doubled/overlapping text.

**Root cause**: `PdfViewerCanvas.tsx` line 49: `isPageExtracted = extractedPages.has(getSourcePageIndex(currentPage))`. `suppressText: isPageExtracted` at line 147 controls whether pdf.js paints native text. We restored `fabricJsonByPage` but not `extractedPages`, so `suppressText` stayed `false` and pdf.js painted a second text layer over the Fabric IText.

**Fix (second pass)**: Also persist and restore `extractedPages: Set<number>` (source page indices whose text was extracted to Fabric IText). Changes:
- `pending-editor-file.ts` — `PendingRecord.extractedPages?: number[]`, added third arg to `savePendingEditorFile`, `PendingEditorFileResult.extractedPages: Set<number> | null` on load.
- `use-export-editor.ts` — reads `{ fabricJsonByPage, extractedPages }` from the store, passes both.
- `pending-editor-file-hydrator.tsx` — restores `extractedPages` via `usePdfEditorStore.setState({ extractedPages: pendingExtractedPages })` at all three sites, alongside the `fabricJsonByPage` restore.

## Critical timing invariant (post-signin restore path)

The hydrator's post-signin restore path uploads the file to `/documents/upload`, then does `router.replace(?id=<newId>&export=pdf)`. This triggers `useEditorDocumentLoader` which calls:
1. `rehydrateEditorState(loaded.editorState)` — editorState is null for a freshly uploaded doc → no-op
2. `setFile(loaded.file)` — patches ONLY `file` (does not touch fabricJsonByPage or extractedPages)
3. `setCurrentDocument({ id, name })` — patches ONLY id/name
4. `setState({ hasUnsavedChanges: false })` — resets dirty flag

**Restore MUST happen BEFORE `router.replace`** so both `fabricJsonByPage` and `extractedPages` are in the store when the document loader fires. Since `setFile` doesn't touch those fields, the pre-seeded state survives. Post-`router.replace` would race the loader.

## Files touched (full list)

- `components/sections/auth/login-card.tsx`
- `components/sections/auth/signup-card.tsx`
- `components/sections/billing/PaywallModal.tsx`
- `components/shared/pending-editor-file-hydrator.tsx`
- `components/sections/new-landing/upload-workspace.tsx`
- `lib/client/hooks/pdf-editor/use-export-editor.ts`
- `lib/client/upload/pending-editor-file.ts`

## Verification

- `bunx tsc --noEmit` clean after each pass
- Not yet mobile-walked. Before push, run the CLAUDE.md mobile pre-push checklist — the sign-in flow touches full-page nav timing which behaves differently on iOS Safari (see chain items 15, 19).

## Related memories

- [[project_pending_editor_state]]
- [[project_auth_link_redirect_url]]
- [[feedback_download_auto_start]]
