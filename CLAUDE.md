# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install          # install dependencies
bun run dev          # start dev server (Next.js Turbopack)
bun run build        # production build
bun run lint         # lint and auto-fix (eslint --fix)
```

## Architecture

**PDFedits** — a Next.js 16 App Router frontend for a cloud PDF tools platform. Uses Bun as the package manager/runtime.

### Key layers

- **`app/`** — Next.js App Router pages. Route groups: `(auth)` for sign-in/sign-up. Root layout wraps everything in `ClerkProvider` → `Providers` (theme + query).
- **`components/`** — Split into `sections/` (page-level compositions), `ui/` (reusable form controls, theme toggle, dropzone), and `shared/` (cross-cutting like navbar).
- **`lib/providers/`** — Client-side provider tree: `AppProviders` composes `NextThemesProvider` + `QueryProvider` (TanStack Query).
- **`lib/client/query/`** — TanStack Query setup with barrel exports. Mutations and queries go in `mutations/` and `queries/` subdirs.
- **`lib/client/stores/`** — Zustand stores.
- **`lib/shared/`** — Cross-cutting utilities: `constants/routes.ts` (route map), `utils/` (logger, Clerk error handling), `schemas/auth/` (Zod v4 validation schemas).
- **`lib/config/`** — App-level configuration (TanStack Query client config).
- **`proxy.ts`** — Clerk middleware (despite the filename, this is the Next.js middleware file).

### Provider nesting (root layout)

`ClerkProvider` → `NextThemesProvider` → `QueryProvider` → page content

### Tech stack details

- **UI**: HeroUI v3 (built on React Aria) + Tailwind CSS v4
- **Auth**: Clerk (`@clerk/nextjs`)
- **Forms**: react-hook-form + `@hookform/resolvers` + Zod v4
- **State**: Zustand (client stores), TanStack Query (server state)
- **Path alias**: `@/*` maps to project root

### ESLint conventions

- Import ordering enforced: types → builtins → external → internal → parent → sibling → index, with blank lines between groups
- JSX props must be sorted alphabetically with callbacks last and reserved props first
- Unused imports are auto-removed; `no-console` is a warning
- Blank line required before `return` and after variable declarations

## PDF Editor

The PDF editor is the most intricate part of this app. Before touching anything under `lib/client/pdf-editor/**`, `lib/client/hooks/pdf-editor/**`, or `components/sections/pdf-editor/**`, **load the project skill** for an orientation map:

```
Skill({ skill: "pdf-editor-architecture" })
```

It lives at `.claude/skills/pdf-editor-architecture/SKILL.md` and documents the load→render→edit→save pipeline, the load-bearing invariants, and the parts of the code the user has explicitly flagged as off-limits.

### Source layout

| Folder | Purpose |
|---|---|
| `lib/client/pdf-editor/` | Pure logic — extraction, merge, build, vector drawers, color/coordinate helpers |
| `lib/client/hooks/pdf-editor/` | React glue — loaders, tools, save/navigation, manage-pages draft state |
| `components/sections/pdf-editor/` | UI — shell, viewer, toolbar, sidebars, modals |
| `lib/client/stores/pdf-editor-store.ts` | Zustand store: file, pdfDocument, per-page Fabric JSON + history, watermark/bg-image config, page order |

### Key invariants (skill has the full list)

- Fabric coordinates are always at **zoom = 1** (base coords). `setZoom(zoom)` is applied for rendering only.
- Zoom changes **resize** the Fabric canvas; they never re-mount it.
- Manage-Pages rotation is **baked into the content stream** (`append-pdf-page.ts`), not `/Rotate` metadata.
- Background image preview uses `mix-blend-mode: multiply` on the PDF canvas; export uses `BlendMode.Multiply` on `drawImage`.
- Mobile renders the watermark + background-image config in a Modal (`MobileToolPropertiesModal`), not the right sidebar.
- Editor modals (`CreatePdfModal`, `ManagePagesModal`, `PerformancePanel`, and the feature modals listed below in "Recent editor surface") are lazy-loaded via `next/dynamic`.
- **Text editing is tool-gated for everyone (mobile + desktop).** `PdfViewerCanvas.tsx` drives `suppressText` from `extractedPages.has(sourcePage)`. Default state: pdf.js paints text natively. When the user activates the **Edit Text** toolbar tool, `useEditTextMode` runs `extractTextBlocks` for that page, places Fabric IText objects, and calls `markPageExtracted(sourcePage)` — only then does `suppressText` flip on. If `getTextContent` throws on older iOS Safari WebKit (`"undefined is not a function (near '...t of e...')"`), the hook reverts `activeTool` to `select` and toasts the user; the page never flips to overlay mode, so native pdf.js text keeps painting and the page stays readable. See skill log 2026-06-14 (b) + 2026-06-10 (c) for history.
- **pdfjs-dist MUST be loaded through `lib/client/pdf-editor/load-pdfjs.ts` (`loadPdfJs()` helper).** That helper installs Safari polyfills (`Promise.withResolvers`, `Object.hasOwn`, `structuredClone`) BEFORE importing the legacy build (`pdfjs-dist/legacy/build/pdf.mjs`), and the worker URL points to `pdfjs-dist/legacy/build/pdf.worker.min.mjs`. The modern build + missing polyfills both break pdf.js on older iOS Safari WebKit. Type-only imports (`import type { … } from "pdfjs-dist"`) are fine to leave on the bare specifier since they're erased at build time.

### Recent editor surface (2026-06 → 2026-08)

The editor has grown well past the base viewer + toolbar. New feature surfaces landed on top of the same load-bearing pipeline; they're modal-mounted from `PdfEditorShell` or `HamburgerMenu`, and each has its own hook:

- **Search** — `PdfSearchBar` + `SearchHighlightLayer` + `use-pdf-search`
- **Find & Replace** — `FindReplaceModal` + `lib/client/pdf-editor/find-replace.ts`
- **Page Numbers** — `PageNumbersModal` + `use-page-numbers-editor` + `add-page-numbers.ts` + `renumber-page-numbers.ts`
- **Form Fields** — `FormFieldsModal` + `use-form-fields-editor` + `form-fields.ts`
- **Annotations panel** — `AnnotationsModal` + `use-annotations-editor`
- **Merge / Split / Compress** — `MergePdfModal` + `SplitPdfModal` + `CompressModal` + `MergeModalHost`
- **Sign** — `SignatureModal` (draws to `SignatureField`, exports through `W9FinalizeIntercept` for W-9)
- **Share** — `ShareModal` (dispatches `editor:save-before-action` to bake edits before generating the share URL)
- **Version History** — `VersionHistoryModal` + `VersionHistoryModalHost` + `VersionPreviewModal`
- **Password protect** — `PasswordModal` + `verify-pdf-password.ts`
- **Reload guard** — `ReloadConfirmModal` (fires when `hasUnsavedChanges` and the URL wants to swap the doc)
- **Save chip + floating toolbars** — `SaveStatusChip`, `FloatingTextToolbar`, `FloatingShapeToolbar`
- **Signed-out autosave** — `use-signed-out-auto-persist` mirrors the signed-in autosave into IDB so sign-in continues seamlessly
- **Mobile navigation** — swipe gestures on `PdfViewerCanvas` (page next/prev) + `BottomDock` touch containment
- **Post-save reload latch** — `postSaveReloadPending` in the store + sticky `pdfDocument` guard prevent black flash + flicker while the merged bytes reload

Anything new should follow the existing patterns: shell-level hook when it needs `fabricCanvas`, modal fires an `editor:*` event, save-before-action if the tool consumes the user's edits.

### Load-bearing invariants (verify before changing)

The user considers the editor **stable as of 2026-08-19** (last confirmed-clean commit `53892a5`: zoom + toolbar layout fixes). These invariants each fix a specific user-reported regression — reverting any of them re-introduces the bug. Not mechanically locked, but do NOT change without a plan and a mobile walk.

- **`merge-pdf.ts` `hasGenuineEdits` guard.** The per-page-loop guard (`editorType === "editModeText"`-only pages fall through to Case 1/2 instead of Case 3 rasterize) is what preserves selectable text on export, share, and extract-images. Also keep the inline `renderPageToPng` + `TEXT_OPS_MIN/MAX/RASTER_SCALE` constants — a shared util exists for `build-pages-pdf.ts` but merge-pdf's copy is intentionally isolated. See skill log 2026-06-15 (c).
- **`objectCaching: false` on IText in `use-edit-text-mode.ts`.** Enabling caching desyncs the render order against Fabric's paint queue.
- **Mobile-touch trio in `use-fabric-canvas.ts`** — `allowTouchScrolling`, `upperCanvasEl.style.touchAction`, and wrapper `touchAction` are kept in sync per active tool. Drawing tools = `false / "none" / "none"`; everything else = `true / "pan-x pan-y" / "pan-x pan-y"`. Wrapper-only changes don't survive Fabric's upper-canvas overlay, and `allowTouchScrolling` alone doesn't update touch-action at runtime. Reverting any of the three freezes 1-finger pan when zoomed in on iOS Safari. See skill log 2026-06-10 (e).
- **`mx-auto w-fit` scroll-container pattern in `PdfViewerCanvas.tsx`.** Don't replace with `flex justify-center`; flex centring traps the user at the centre of a zoomed-and-overflowing child on iOS Safari. See skill log 2026-06-10 (e).
- **Shell-level `useExtractImagesEditor` hook + `editor:extract-images` event.** Don't fold image-extraction back into `HamburgerMenu.runExtractImages` — the menu has no `fabricCanvas` ref, so a direct mutation call ships the **original upload**, not the edits. Backend then returns 400 / "no images found." See skill log 2026-06-10 (f).
- **Mobile text rendering.** `PdfViewerCanvas.tsx` drives `suppressText` from `extractedPages.has(sourcePage)` — pdf.js paints text natively until the user activates the **Edit Text** tool, then `useEditTextMode` extracts the page and flips `suppressText` on. If `getTextContent` throws (older iOS Safari WebKit), the hook reverts `activeTool` to `select` and toasts — the page never flips to overlay mode, so native pdf.js text keeps painting. See skill log 2026-06-14 (b) + 2026-06-10 (c).
- **Fit-to-width cap at `MAX_ZOOM = 1.0`** in `PdfViewerCanvas.tsx`. Browser zoom-out inflates `clientWidth`, so an uncapped fit result exceeded the toolbar's max preset (2.0) and locked the `+` button. See skill log 2026-08-19.
- **`ToolToolbar` uses `flex-wrap justify-center`, not `w-fit`, in `PvEditorTopChrome.tsx`.** The `mx-auto w-fit` trap only applies to `PdfViewerCanvas` (mobile-critical). `ToolToolbar` is desktop-only — `w-fit` there prevents wrap and pushes tools off-screen at higher browser zoom. See skill log 2026-08-19.
- **Page-number overlays are overlay-only on Save.** `stripPageNumberOverlays` runs before the merge on the Save path but not the Export path — download PDFs carry page numbers, cloud-saved PDFs render them from Fabric state on reload. See skill log 2026-06-19 (d).
- **Sidebar page reorder = materialize-into-source-bytes pattern.** `materialize-page-order.ts` rebuilds the source bytes with the reordered pages, then the merge runs against identity ordering. Don't try to teach `merge-pdf.ts` to consume `pageOrder` directly. See skill log 2026-06-19 (a).

The lock hook still enforces the tightest subset (`use-edit-text-mode.ts`, `use-fabric-canvas.ts`, `load-pdfjs.ts`, `pdfjs-polyfills.ts`, `use-extract-images-editor.ts`, `append-pdf-page.ts`) — see `.claude/LOCKED_PATHS`.

For the full evidence trail (why each rule exists, what broke when we tried otherwise), open `.claude/skills/pdf-editor-architecture/SKILL.md` and read the "Known issues / decisions log" at the bottom — newest entries are at the top. **Always check that log before refactoring anything in `lib/client/pdf-editor/**`, `lib/client/hooks/pdf-editor/**`, or `components/sections/pdf-editor/**`.**

If a fix requires changing one of these, ask the user first.

## Auth + paywall + export flow (do NOT unravel)

Ten commits between 2026-07-18 and 2026-07-19 wired a fragile chain that finally works end-to-end for the "signed-out user drops a PDF, clicks Download → DOCX, signs in, gets paywall or download" journey. Every piece exists for a specific bug the user reported and re-fixed multiple times. If you touch one of these components, understand what breaks:

1. **`useExportEditor` reads `useAuth()` directly, not `store.isSignedIn`.** The store copy is synced by a downstream `useEffect` in `PdfEditorShell` and lags one tick during post-signin returns. Reading Clerk directly avoids the sign-in redirect loop.
2. **`useExportEditor` re-dispatches `editor:export` after 250ms if Clerk hasn't hydrated.** The auto-launch event can fire faster than `authLoaded`. Recursion would trip the react-hooks/immutability lint rule — dispatch a fresh event instead.
3. **`useExportEditor` gates non-PDF exports on `!signedIn` FIRST, before `requestPaywall`.** Paywall's `POST /billing/checkout-intent` needs auth. Signed-out user in paywall = "Couldn't start checkout" dead-end.
4. **`useExportEditor` triggers `dispatchSignInPrompt`, not a raw redirect.** `SignInPromptModal` (mounted in `AppProviders`) is a confirm dialog with Cancel + "Sign in & continue" — user always has a way out.
5. **`usePaywall` handler dispatches `SignInPromptModal` for signed-out callers.** Any code path that opens the paywall (axios interceptor, service helpers) now routes signed-out users through the sign-in modal instead of the paywall's error state. Reading `useAuth()` in `usePaywall` is required — the effect deps must include `authLoaded, entitled, isSignedIn`.
6. **`PaywallModal.ErrorState` renders "Sign in & continue" when the error message matches `/sign in|401|not authori[sz]ed/i`.** Belt-and-braces for mid-session token expiry.
7. **`PaywallModal.finish` calls ONLY `onPaymentSuccess`, not `onClose`.** `usePaywall.onPaymentSuccess` is async — calling `onClose` alongside races the "cancelled" resolver against "success" and cancels the queued action.
8. **`PendingEditorFileHydrator` Step 1 waits for `authLoaded` before AUTH_GATED_TOOLS redirect.** Fires before Clerk = misfires.
9. **`PendingEditorFileHydrator` Step 2 has TWO paths: post-signin restore vs normal rehydrate.** Post-signin restore is `authLoaded && isSignedIn && (tool || exportFormat) && !docId && IDB has file`. It uploads first, gets the id, then `router.replace(?id=<newId>&...)`. Deterministic — the document loader takes over from the new URL. Skipping this path (going back to normal rehydrate + async auto-save) reintroduces the race that dashboard-bounced users mid-flow.
10. **`PendingEditorFileHydrator` Step 3 (background auto-save) DOES NOT update the URL if `?tool` or `?export` is present.** Race between `setCurrentDocument` and `router.replace` triggers the loader against a doc that hasn't propagated → 404 → dashboard bounce.
11. **`PendingEditorFileHydrator` Step 4 (auto-launch) waits for `authLoaded`.** Same reason as Step 1.
12. **`PendingEditorFileHydrator` sets `isRestoringSession=true` before the post-signin save + toggles it off in finally.** `PdfEditorShell` renders `<EditorLoadingShell />` while this flag is true (in addition to `pendingDocumentId`) — kills the drop-zone flash.
13. **`PdfEditorShell` synchronously shows `<EditorLoadingShell />` if URL has `?export` or `?tool` without `?id`, AND Clerk is either still loading OR resolved to signed-in.** Prevents the drop-zone flash on the FIRST render before the hydrator's effect kicks in.
14. **`useEditorDocumentLoader` non-401 error branch checks `store.file` before redirecting to `/dashboard`.** If a file is loaded (from IDB, hydrator, or user upload), stays put with a friendly toast. The dashboard bounce is destructive mid-flow — only fire it when there's truly nothing else to show.
15. **Login card + Signup card use `window.location.assign` for finalize navigation, not `router.push`.** iOS Safari commits the Clerk session cookie during the full-page navigation; `router.push` outraces the cookie commit and the middleware treats the user as signed-out → bounce to sign-up.
16. **Login card handles `signIn.status === "needs_second_factor"` via `signIn.mfa.sendEmailCode()` / `verifyEmailCode()` etc.** Skipping this branch means 2FA-enabled accounts silently loop back to sign-up.
17. **`UploadWorkspace` (landing + convert routes) is auth-gated on convert routes (`pathname.startsWith("/convert/")`).** Signed-out users are redirected via `SignInPromptModal` before `uploadAsPdf` fires so the wasted client CPU is avoided and the paywall dead-end never happens. **Post-signin branching by direction (2026-08-24, refined 2026-08-25):**
    - **X→PDF routes** (`!exportFormat`, e.g. `word-to-pdf`): register the file in `usePendingConversionsStore`, fire `runPendingConversion(tempId, file)` as a background promise (module-scope, survives component unmount), then `router.push('/dashboard')` IMMEDIATELY. The upload workspace shows NO toast. The dashboard file table renders a "Preparing your document…" placeholder row driven by the store; runner sends the ORIGINAL file (not a pre-converted PDF) to `POST /documents/upload`, and the backend handles the X→PDF conversion internally + persists `originalContentType = <source mime>` on the Document row. When the runner finishes it invalidates `documentKeys.lists()` and the placeholder swaps for the real row on refetch.
    - **PDF→X routes** (`exportFormat` set, e.g. `pdf-to-word`): NO early paywall. Save + open editor with `?export=<format>`; `useExportEditor` (items 1–4) triggers the paywall at auto-export time.
    - `QueryProvider` calls `setPendingConversionsQueryClient(queryClient)` on mount so the module-scope runner can invalidate the docs list after the background upload settles.
    - **Do NOT re-add client-side `uploadAsPdf` in `runPendingConversion`.** Sending a pre-converted PDF makes the backend set `originalContentType = null` (looks like a native upload), defeating the paywall distinction on the dashboard row.
    - Do NOT reintroduce a `ensureFreshEntitlement` / `requestPaywall` / `toast.loading("Converting to PDF")` call in the upload-workspace convert branch — the previous version dead-ended users at "Couldn't start checkout" and blocked the source page with a spinner even after the redirect landed.
    - **Dashboard Open/Download gate distinguishes converted vs native uploads.** `gateEntitledAction(doc)` returns `true` immediately when `!isConvertedDocument(doc)` (i.e. `doc.originalContentType == null`). Native PDF uploads are free; converted PDFs (X→PDF via `originalContentType != null`) trigger the paywall for non-subscribed users. The `Document` type carries `originalContentType`/`originalFilename` from the backend DTO.
18. **`UploadWorkspace` runs `findDuplicateByFilename` before `documentsService.uploadDocument`.** If a matching doc exists in the user's library, we skip re-upload and navigate to the existing doc's id. Prevents the "user can create infinite duplicates" bug.
19. **Post-signin save-first flow pipes `onUploadProgress` into `uploadToasts.setProgress`.** The bottom-left `<UploadToastProvider placement="bottom start" />` shows filename + live % during the multi-second upload. Do NOT switch back to `toast.loading` — that shows top-right, not bottom-left, and has no progress bar.
20. **`AllToolsCatalog` stays server-safe (no props).** Landing header watches `usePathname()` and closes the modal on route change. Adding a callback prop back re-tripped Next 16's RSC serialization during `/all-tools` prerender.
21. **`WeglotLoader` passes `switchers: []` AND CSS in `globals.css` hides `.country-selector, .wg-drop, .weglot-container, #weglot-listbox, [class*="weglot-inline"], [class*="wg-flags"]`.** Weglot's SDK sometimes injects a floating switcher regardless of the init flag. Both fences must stay — our custom `LanguageSwitcher` in the site navbar + dashboard sidebar + editor top chrome is the only one users should see.

Full commit trail: `git log --oneline main -- lib/client/hooks/pdf-editor/use-export-editor.ts lib/client/hooks/billing/use-paywall.ts components/shared/pending-editor-file-hydrator.tsx components/shared/sign-in-prompt-modal.tsx components/sections/pdf-editor/PdfEditorShell.tsx`.

Playwright coverage: `tests/pdf-editor/export-signin-redirect.spec.ts` guards items 1–4 and 8 above.

### Locking strategy (enforced)

The off-limits list above is also enforced mechanically. `.claude/settings.json` registers a `PreToolUse` hook (`.claude/hooks/check-locked-paths.cjs`) that blocks `Edit`, `Write`, `MultiEdit`, and `NotebookEdit` against any path listed in `.claude/LOCKED_PATHS`.

- **Add a lock:** append a path or glob (e.g. `lib/foo/bar.ts` or `lib/foo/**`) to `.claude/LOCKED_PATHS`. Use `!path` to carve out an allowlisted sub-path.
- **Remove a lock:** delete the line and tell Claude what changed.
- **One-off bypass:** `export CLAUDE_UNLOCK_PATHS=1` for the current shell, then re-launch Claude Code.
- **Rollback target:** the tag `stable-2026-06-22` marks the last-known-good PDF editor state. To revert a regression: `git reset --hard stable-2026-06-22` (destructive — make a branch first). New stable checkpoints should be added as `stable-YYYY-MM-DD` tags after the mobile checklist passes.

When Claude is blocked by this hook it must ask the user before bypassing — don't unlock unprompted.

## Mobile pre-push checklist (REQUIRED before any push or PR)

Mobile (iOS Safari + Android Chrome) is the #1 regression surface in this app — the same code path can render fine on desktop and break completely on a real phone (the Fabric overlay, pdf.js fonts, touch-action, DPR, op-list shape, etc. all behave differently). Before claiming a change is ready to push, walk through this list. If you cannot run on a real mobile device, run in DevTools "Responsive" mode at iPhone 14 / Pixel 7 sizing AND say so explicitly in the summary — never claim mobile is verified when only desktop was tested.

Run on a fresh page load each time (`bun run dev` → open with mobile device or DevTools mobile viewport):

1. **PDF text loads on the FIRST page** — open a multi-page PDF, confirm every glyph is visible (not blank, not a partial render). Open the mobile devtools console and verify:
   - `[PDFedits] load: ok` fires
   - `[PDFedits] render: page` fires with `suppressText: true`
   - `[PDFedits] text: extract ok` fires (NOT `text: extract failed`)
   - `[PDFedits] text: drew IText` fires with `count > 0`
   - If you see `text: extract failed` with a `TypeError`, capture the `message` / `stack` from the log and fix the extractor — DO NOT push.
2. **Text loads on EVERY page** — paginate through the doc. Each page should log the same sequence above. No silent blanks.
3. **Tap-to-edit text works** — tap any text run. An IText cursor must appear and the soft keyboard must open. Type a character; it must render with the same font as the surrounding text.
4. **Pinch-zoom doesn't blank the page** — pinch out to ~2x then pinch in to the floor (~0.5x). Text + shapes stay sharp at both extremes. No blank flash at the zoom floor (iOS Safari regression).
5. **Tools work under finger input** — draw, highlight, eraser, shape. Each tool must respond on first touch (not the second). If a tool needs two taps to engage, check `touch-action` on the Fabric wrapper.
6. **Watermark + background image open in the bottom modal** — these tools must NOT try to render in the right sidebar on mobile (sidebar isn't mounted). Confirm `MobileToolPropertiesModal` opens and closing it returns `activeTool` to `select`.
7. **Manage Pages flow** — Manage Pages button triggers the save-before-action toast, modal opens with thumbnails, rotate / reorder / delete works, Save closes the modal and reflects changes in the editor without a stale-pdf flash.
8. **Save uploads the live edits** — make a visible edit, hit Save, watch for the loading toast, then a success toast. Re-open the saved file and confirm the edit is baked in.
9. **No console errors during the above** — only the `[PDFedits]` info logs. Any uncaught error or red console line is a blocker.
10. **Build is clean** — `bunx tsc --noEmit && bun run lint && bun run build` all pass.

When reporting completion of a PDF-editor change, state which of these you verified and on what (real device vs DevTools). If something on this list couldn't be tested, say so — don't paper over it.

Known mobile failure modes to watch for (these have all bitten us before):
- **pdf.js `getTextContent` throws on older iOS Safari WebKit** with `"undefined is not a function (near '...t of e...')"`, entire text layer blank. Even the legacy build of pdf.js v5 uses `Promise.withResolvers` / `structuredClone` / `Object.hasOwn`, which the user's WebKit version doesn't ship. **Two safeguards are in place — both must stay:**
  1. `PdfViewerCanvas` mobile branch — `suppressText: !isMobile` + skip Fabric overlay on mobile. Mobile never calls `getTextContent`, so it can't throw.
  2. `loadPdfJs()` in `lib/client/pdf-editor/load-pdfjs.ts` installs polyfills (`pdfjs-polyfills.ts`) before importing pdf.js, in case the desktop Safari is also missing the APIs.
  If this error reappears, check: (a) every dynamic pdfjs import still goes through `loadPdfJs()`, (b) the `isMobile` branch in `PdfViewerCanvas.tsx` hasn't been "unified", (c) the worker URL still points at `pdfjs-dist/legacy/build/pdf.worker.min.mjs`.
- pdf.js operator-list `argsArray[i]` is `null` on certain ops → `args[0]` throws TypeError, the whole text layer is empty. Guarded in `extractSequentialTextColors`; don't undo the `?? []` coalesce.
- pdf.js fonts loading after the first Fabric paint → glyphs render blank on iOS Safari. The `document.fonts.ready` await + `loadingdone` listener in `use-edit-text-mode.ts` fixes this; don't drop them.
- Fabric wrapper without `touch-action: none` → draw/highlight/eraser feel "sticky" on iOS because the outer scroll container is competing for touch events.
- Pinch-zoom below 0.5 → IText overlay disappears on iOS. The `PINCH_MIN_ZOOM = 0.5` floor in `PdfViewerCanvas` exists for this; don't lower it.
- Both pdf.js native text rendering AND the Fabric IText overlay enabled at once → visible glyph doubling at DPR=3. `suppressText: true` is set unconditionally now; don't reintroduce the mobile branch that flipped it.

## Project skills (load proactively)

Beyond `pdf-editor-architecture`, this repo ships project-specific skills at `.claude/skills/`. Load them by name via `Skill({ skill: "…" })` — they are the primary defense against the regression classes this app has been burned by. Descriptions live in each skill's frontmatter; a Claude session should load them without being asked when the trigger applies.

| Skill | Load when |
|---|---|
| `pdf-editor-architecture` | Editing anything under `lib/client/pdf-editor/**`, `lib/client/hooks/pdf-editor/**`, `components/sections/pdf-editor/**` |
| `pdf-composer-render-fix` | User reports "edits missing from downloaded PDF", "drawings not in merged PDF", or any variant of "save works but download is unedited" — covers the 2026-09-07 Fabric-v7 `loadFromJSON` blank-PNG bug + live-canvas raster fix |
| `auth-flow-guardian` | Editing any file in the 21-item "Auth + paywall + export flow" chain (see section above) |
| `regression-forensics` | User reports a bug that used to work, mentions a fix reverting, or says "broken again" |
| `pre-push-guardian` | About to push, open a PR, merge, or claim work is ready to ship |
| `memory-snapshotter` | Wrapping up a session, PreCompact hook fires, or a new preference / decision / root cause emerges worth persisting |

A `PreCompact` and `SessionEnd` hook injects a reminder to invoke `memory-snapshotter` before context is lost. The hook is at `.claude/hooks/remind-memory-snapshot.cjs`.

## Session specs (project history for handoff)

`.claude/specs/` contains dated markdown files that capture the full evidence trail for non-trivial sessions — bugs diagnosed, decisions made, work shipped, work blocked. Unlike the user's personal auto-memory (which lives outside this repo), these ship with the codebase so any developer or AI model taking over the project has the story behind the current state.

**Read specs when:** starting work on billing/Solidgate, auth/paywall, or Apple Pay; the user references a past session; or the current problem overlaps with the topics listed below.

Current specs:

| Spec | Topic |
|---|---|
| [`2026-07-30-signout-edit-persistence.md`](./.claude/specs/2026-07-30-signout-edit-persistence.md) | Signed-out edit → download → sign-in return flow — three bugs, full evidence |
| [`2026-07-31-solidgate-audit.md`](./.claude/specs/2026-07-31-solidgate-audit.md) | Client Solidgate audit — charge-auth SDK migration, React Aria dismiss fix, hard-cancel webhook |
| [`2026-08-03-apple-pay-diagnostic.md`](./.claude/specs/2026-08-03-apple-pay-diagnostic.md) | Apple Pay button not rendering — full stack green, blocked on Solidgate-side Apple verification |
| [`2026-09-02-locale-urls-geo-defaulting.md`](./.claude/specs/2026-09-02-locale-urls-geo-defaulting.md) | Subdirectory locale URLs (`/de/…`) + geo-IP defaulting Phase 1 — middleware-rewrite pattern, CloudFront Function, next-intl scaffolding, Weglot client SDK removed |
| [`2026-09-08-guest-convert-flow.md`](./.claude/specs/2026-09-08-guest-convert-flow.md) | Guest convert + edit flow, paywall-at-download-only — Phase 1 (Open free) shipped; Phase 3A-3G (backend guest upload + guest→account migration) planned, needs `POST /documents/upload` `@OptionalAuth` + guest cleanup cron + guest doc migration endpoint |

Add new specs as `YYYY-MM-DD-<slug>.md` and append a row to this table.

## Persisted memory (project handoff)

`.claude/memory/` mirrors Hamza's personal auto-memory for this project so it travels with the repo. `.claude/memory/MEMORY.md` is the index; individual files hold user profile, feedback rules, project state, and reference pointers. Read the index first — each entry has a one-line hook. Fields to note:

- `feedback_*.md` — behavioural rules with **Why** + **How to apply** lines. Follow them.
- `project_*.md` — active work, decisions, in-flight bugs, external blockers. Verify against current code before acting on file:line citations (memory is point-in-time).
- `reference_*.md` — pointers to external systems / conventions.
- `user_role.md` — who the primary developer is and how to frame work for them.

These are a snapshot as of 2026-08-03. When Hamza updates his live memory during a session, prefer that live copy — but for a fresh developer or AI without access to Hamza's home directory, this folder is the source of truth for context that isn't in `git log` or the code itself.

<!-- repocards:begin -->
## Repo context — repocards

This repository has a pre-computed context folder at `.repocards/`. **Open [`.repocards/AGENT_GUIDE.md`](./.repocards/AGENT_GUIDE.md) at the start of any task about this project** — before running Grep/Glob/Read on the source, and also when the user asks health-check questions like "are you reading repocards?". The guide routes you to pre-computed cards (architecture, entrypoints, api-surface) and contains self-identification instructions. Typical card read is 10–50× fewer tokens than a grep pass.

Generated by [repocards](https://www.npmjs.com/package/repocards). Re-run `npx repocards index` after code changes.
<!-- repocards:end -->
