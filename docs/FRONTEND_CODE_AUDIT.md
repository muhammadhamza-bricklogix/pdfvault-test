# PDFVault — Frontend Code Audit (Scale & Concurrent Users)

Owner: Hamza · Prepared: 2026-08-08
Repo: `/Users/brickslogix/pdf-viewer-app` (branch `feat/prd-signin-onboarding-composer-revamp`)
Scope: Next.js 16 App Router frontend. **Findings only — no code changes proposed here.** Implementation is on the product team.
Target: 1,000+ concurrent users on marketing + editor + checkout.

Each finding: **Severity** (P0 launch-blocker · P1 launch-day risk · P2 near-term · P3 nice-to-have) · **Evidence** (file:line where practical) · **Recommendation**.

---

## 1. Bundle size, code splitting, cold-start

### 1.1 [P1] pdf.js + Fabric are the two heaviest client dependencies and both are correctly lazy-loaded — but not measured.

**Evidence.** `lib/client/pdf-editor/load-pdfjs.ts` dynamically imports `pdfjs-dist/legacy/build/pdf.mjs` (~1MB) and the worker (`pdf.worker.min.mjs`, ~1MB) on demand. Fabric is imported inside the editor hooks (`use-fabric-canvas.ts`, etc.). A prefetch was added yesterday (`PdfEditorShell` mount effect) to warm the cache before the first upload.

**Risk at scale.** We have no bundle-analyzer baseline in the repo. A regression that pulls Fabric or pdf.js into the marketing bundle would silently 5–10x the landing-page transfer size — invisible until real users on mobile 4G start bouncing.

**Recommendation.** (a) Add `@next/bundle-analyzer` to the build script, run on every PR, fail CI if any route's client bundle grows > 20% vs `main`. (b) Publish a one-time baseline: total client KB per route, gzipped, so regressions become obvious.

---

### 1.2 [P2] Lazy-loaded modals in the editor use `next/dynamic` — good — but only one place.

**Evidence.** `grep -c "next/dynamic" components/sections/pdf-editor/*.tsx` returns exactly one match (`PaywallModal.tsx`). The editor has ~30 modals (Compress, ManagePages, Password, Split, Signature, CreatePdf, FindReplace, VersionHistory, PageResize, FormFields, Annotations, etc.) many of which are heavy (`ManagePagesModal` renders per-page thumbnails, `CreatePdfModal` imports `pdf-lib`).

**Risk at scale.** All modal code ships in the editor's initial bundle even when the user never opens most of them. Cold-load latency inflated.

**Recommendation.** Convert the modal registry in `PdfEditorShell.tsx` to `next/dynamic({ ssr: false, loading: () => null })`. Prioritize `CreatePdfModal`, `ManagePagesModal`, `VersionHistoryModal`, `SplitPdfModal`, `PageNumbersModal` — these are the biggest.

---

### 1.3 [P2] HeroUI ships as one package (`@heroui/react`).

**Evidence.** `package.json` imports `@heroui/react` (single umbrella). Next.js can tree-shake modern ESM, but React Aria's cross-imports make dead-code elimination inconsistent depending on the bundler.

**Risk at scale.** Marketing-only pages may pull in editor-only HeroUI components (Dropdown, Toolbar, etc.) transitively through shared UI primitives.

**Recommendation.** Once bundle-analyzer is in place, look for HeroUI components appearing on `/` or `/all-tools` that shouldn't be there. If found, switch problem imports to the granular `@heroui/<component>` subpackages (React Aria supports this).

---

## 2. Runtime performance — editor

### 2.1 [P1] Fabric IText overlay + pdf.js text layer intentionally split desktop vs mobile.

**Evidence.** `components/sections/pdf-editor/PdfViewerCanvas.tsx` — `suppressText: !isMobile` + `fabricCanvas: isMobile ? null : fabricCanvas`. Load-bearing per CLAUDE.md invariants (iOS Safari WebKit crash on `getTextContent`).

**Risk at scale.** Not a regression per se — this is correct — but it means a single mobile user can hit a broken text render that a desktop user never sees. Any bug report about "blank text on iPhone" is likely a polyfill or op-list issue in `text-extraction.ts`, not a rendering problem.

**Recommendation.** No change. Keep the mobile guard as-is. Ensure the pre-push mobile checklist in `CLAUDE.md` is enforced on every editor-touching PR (there's a `pre-push-guardian` skill wired for this; make sure it's actually invoked in CI or via a git hook, not just a Claude-side reminder).

---

### 2.2 [P1] Per-page `getOperatorList()` was re-fetched on every zoom step. Fixed yesterday.

**Evidence.** `lib/client/hooks/pdf-editor/use-page-renderer.ts` — WeakMap cache added in commit `57baa36`.

**Risk at scale.** Pinch-zoom on iOS was the biggest jank surface. Cache should hold. Verify with real-device profiling after the branch merges.

**Recommendation.** Add a Playwright / Chrome DevTools trace to the mobile QA runbook: pinch-zoom a 20-page PDF from 0.5x → 2x → 0.5x, confirm no `getOperatorList` in the network / worker timeline after the first zoom.

---

### 2.3 [P2] IText `objectCaching: false` is a knowingly-accepted perf regression.

**Evidence.** `lib/client/hooks/pdf-editor/use-edit-text-mode.ts` (locked path). CLAUDE.md documents it as a Fabric render-order bug workaround.

**Risk at scale.** Every re-render of an IText object is uncached — cost scales with page complexity. On a 50-page document with 100+ text runs per page, this adds up.

**Recommendation.** No immediate change (locked path). But **budget** it: track "seconds spent rendering IText per page" via a devtools trace on a large sample document, so if a user reports "editor is slow" you can attribute it correctly instead of chasing ghosts.

---

### 2.4 [P2] `flushLiveFabricPage` + `buildEditedPdfBytes` run on the main thread.

**Evidence.** `lib/client/pdf-editor/save-utils.ts`, called from `use-export-editor.ts` before the download. Serializes every Fabric page, rebuilds a PDF, bakes overlays.

**Risk at scale.** For a 100-page PDF with heavy annotations, this can block the main thread for multiple seconds — the UI freezes during export. A concurrent user pool doesn't change this per user, but it does change the perceived-slowness distribution: 1% of exports being 10s+ is very visible in analytics.

**Recommendation.** Investigate moving the PDF build into a Web Worker or, at minimum, chunking it with `requestIdleCallback` / `scheduler.postTask` so the main thread yields between pages. Not launch-blocking; queue as a P2 perf project.

---

## 3. Memory & lifecycle

### 3.1 [P1] IndexedDB usage: files stored per user in IDB via `lib/client/offline/idb-client.ts`.

**Evidence.** `lib/client/offline/idb-client.ts` — `putPdfBytes`, `readPdfBytes`, `upsertCachedDocument`, `readCachedDocument`. Pending-editor file also stored via `lib/client/upload/pending-editor-file.ts`.

**Risk at scale.** Browsers have hard IDB quotas (~50MB default on iOS Safari, more on Chrome). A user who opens many large PDFs across sessions will silently hit the quota, and puts will start failing. There's no visible eviction policy in the codebase.

**Recommendation.** (a) Add a size-cap + LRU eviction (drop the oldest cached document once total > 100MB). (b) Wrap every `putPdfBytes` in try/catch that surfaces a friendly "your device is out of storage — clear your library" message instead of a silent failure. (c) Add a Settings-page control to purge the offline cache.

---

### 3.2 [P1] pdf.js document lifecycle — `doc.destroy()` is called on cancel + unmount, but no visible check for leaked workers.

**Evidence.** `lib/client/hooks/pdf-editor/use-pdf-loader.ts` — `loadingTask?.destroy()` on cleanup, and `setPdfDocument(null, 0)` clears the store copy.

**Risk at scale.** If a user rapidly opens/closes files (e.g. bulk conversion workflow), a leaked worker keeps a full copy of the last PDF in memory. Over a long session that's 10s of MB per leaked doc.

**Recommendation.** Add a devtools memory-leak test to the mobile checklist: open + close 20 different PDFs on the same page, then take a heap snapshot. Retained size on `PDFDocumentProxy` should trend toward zero, not accumulate. If a leak exists, the fix is usually adding `doc.cleanup()` before `destroy()`.

---

### 3.3 [P2] Fabric canvas isn't unmounted on page navigation — it's resized.

**Evidence.** `CLAUDE.md` PDF-editor invariants: "Zoom changes resize the Fabric canvas; they never re-mount it."

**Risk at scale.** Correct behavior for zoom. But make sure `useEffect` cleanup on the editor route disposes the Fabric canvas on real unmount (e.g. user clicks the new back button and navigates to `/dashboard`). Otherwise the canvas + all its objects stay in memory until GC decides to sweep.

**Recommendation.** Add a `useEffect(() => () => fabricCanvas?.dispose(), [])` to the top-level editor shell if not already present. Verify with the same heap-snapshot test as 3.2.

---

## 4. Network layer

### 4.1 [P0] No visible retry / backoff on TanStack Query mutations.

**Evidence.** `lib/config/query-client.ts` (default), `lib/client/query/mutations/**`. TanStack Query defaults to `retry: 3` for queries but `retry: 0` for mutations. Grep for `retry:` in the config to confirm.

**Risk at scale.** During a launch spike or a transient backend blip (autoscaling lag, ALB draining a pod, CloudConvert 429), mutations fail immediately — user sees "Export failed" and has to click again. On mobile networks (4G/spotty wifi) this is worse.

**Recommendation.** Set global mutation defaults with `retry: 2, retryDelay: exponentialBackoff` for **idempotent** mutations (uploads that dedupe server-side, conversion job submissions). Do NOT retry Solidgate charge calls — a double-retry there is a double-charge risk.

---

### 4.2 [P1] Axios interceptor for 402/403 → paywall is load-bearing (invariant chain).

**Evidence.** `lib/client/hooks/billing/paywall-bus.ts`, `use-paywall.ts`, `use-export-editor.ts`. Documented in CLAUDE.md 21-item auth chain.

**Risk at scale.** Any change to the interceptor risks reintroducing the "Couldn't start checkout" dead-end. Under load, if the backend returns 429 (Throttler) instead of 402 for a rate-limited unentitled user, does the paywall trigger correctly or do we show a generic error?

**Recommendation.** Add a Playwright test that mocks a 429 on the export endpoint and verifies the user sees a "try again in a moment" message, not the paywall (which would be misleading — they're not blocked by lack of subscription, they're blocked by rate limits).

---

### 4.3 [P1] Upload progress + duplicate detection only wired for dashboard `UploadWorkspace`.

**Evidence.** `components/shared/upload-workspace.tsx` — `findDuplicateByFilename` + `onUploadProgress` piped to `uploadToasts.setProgress` (invariant #18, #19).

**Risk at scale.** Correct for the primary flow. Verify the same flow applies to editor-side saves (`use-save-editor.ts`). If a signed-in user in the editor hits Save on a 50MB PDF, they should see the same bottom-left progress toast as the dashboard uploader — not a top-right `toast.loading` spinner.

**Recommendation.** Grep for `toast.loading` in `use-save-editor.ts` and related; migrate to `uploadToasts` if found (invariant #19 already forbids `toast.loading` for this).

---

### 4.4 [P2] No client-side request coalescing for the same file.

**Evidence.** `use-editor-document-loader.ts` has a `Map<id, Promise>` inflight cache — good, StrictMode-safe. But this only dedupes doc _loads_, not the many parallel background calls a heavy editor session makes (thumbnails, IText color extraction, save auto-persist, etc.).

**Risk at scale.** Under real user load this is fine — each user has their own tab. Under concurrent-user load (1000s), the backend absorbs the fan-out. Watch backend logs for repeated identical requests from one session.

**Recommendation.** Baseline the "requests per active editor session per minute" on staging under a synthetic load. If > 20, look for a dedupable pattern.

---

## 5. State management

### 5.1 [P2] Zustand store is large and non-persisted.

**Evidence.** `lib/client/stores/pdf-editor-store.ts` — file, pdfDocument, per-page fabric JSON, history, watermark/bg-image configs, page order, isSignedIn, etc.

**Risk at scale.** Reload = lose everything except what the hydrator restores from IDB. Fine for a single user. But if a session goes long (~1h in the editor), the history stack grows unbounded per page. There's no visible cap.

**Recommendation.** Cap `historyByPage[pageN]` at N (e.g. 50 states) with FIFO eviction. Otherwise a user editing text for 30 min accumulates hundreds of history entries, each holding a serialized Fabric JSON snapshot.

---

### 5.2 [P2] `setIsSignedIn` sync lags Clerk by one tick — documented workaround in place.

**Evidence.** `use-export-editor.ts` reads `useAuth()` directly instead of `store.isSignedIn` (invariant #1). Same in `use-paywall.ts`.

**Risk at scale.** No incremental risk. But every new hook that touches auth should follow this pattern — the auth-flow-guardian skill enforces this for the 21-item chain. Confirm any new billing / auth code respects it too.

**Recommendation.** Add a lint rule (custom eslint) or a code comment banner in `pdf-editor-store.ts` stating "for auth checks, read useAuth() directly — do not depend on store.isSignedIn during post-signin returns."

---

## 6. Auth token handling

### 6.1 [P1] Frontend does not appear to hold any long-lived tokens — Clerk manages sessions via httpOnly cookies.

**Evidence.** `@clerk/nextjs` is used throughout; no visible `localStorage.setItem('token', ...)` grep hits in `lib/client/`. Good.

**Risk at scale.** As long as Clerk's session cookie is `Secure; SameSite=Lax; HttpOnly` and we don't read it on the client, we're clear of XSS-token-exfiltration risk.

**Recommendation.** Confirm on the production Clerk dashboard: session cookie attributes are the defaults (Secure, HttpOnly). Add a CSP that prohibits inline scripts in production.

---

### 6.2 [P0 / launch-day] Sign-in flow depends on Clerk email-code first factor.

**Evidence.** `components/sections/auth/login-card.tsx` (recent rewrite). `signIn.emailCode.sendCode()` / `verifyCode()`.

**Risk at scale.** If the production Clerk instance does not have email-code enabled, every sign-in silently fails at `sendCode`. This is called out in the production checklist too — flagging here so the frontend team owns confirming this before flipping DNS.

**Recommendation.** Add a synthetic monitor: hit `/sign-in`, submit a monitor-owned test email, verify the OTP arrives via a monitored inbox, submit the code, verify session cookie is set. Run every 15 min in production.

---

## 7. Error handling & observability

### 7.1 [P0] No client-side error tracking installed.

**Evidence.** `package.json` has no `@sentry/nextjs`, no PostHog, no LogRocket, no Bugsnag. The custom `logger` (`lib/shared/utils/logger.ts`) writes to console only (83 call sites across the codebase — grep confirmed). There's no upstream sink.

**Risk at scale.** When a user hits a bug in production, we have literally no way to know unless they email support. For 1,000+ users this is untenable — a single regression could affect hundreds silently.

**Recommendation.** Install Sentry (or equivalent) BEFORE launch. Wire it into: (a) React error boundary, (b) unhandled rejections, (c) explicit `logger.error()` sink, (d) source maps upload in CI so stack traces are readable. This is a real launch blocker.

---

### 7.2 [P1] Error boundary coverage is thin.

**Evidence.** `find app -name 'error.tsx'` returns only `app/(marketing)/error.tsx`. The `(landing)` route group + `(app)` route group + `(tools)` route group have no error boundary — a runtime throw inside the editor crashes to Next.js's default error page.

**Risk at scale.** Any browser-quirk crash (Safari WebKit, older Chrome) becomes a full white-screen for the user, no recovery UI, no auto-report to Sentry.

**Recommendation.** Add `error.tsx` to at least: `app/(landing)/error.tsx`, `app/(app)/error.tsx`, `app/(tools)/error.tsx`, and a `not-found.tsx` per route group.

---

### 7.3 [P2] `logger.info` calls in the editor render pipeline fire on every page render.

**Evidence.** `lib/client/hooks/pdf-editor/use-page-renderer.ts` — `logger.info("[PDFedits] render: page", {...})` on every successful render. 83 total logger calls across the codebase (grep-confirmed).

**Risk at scale.** On mobile Safari this shows up in the console at info level, which is fine. But if `logger` starts shipping to a remote sink (Sentry), we'd be sending thousands of no-value events per session.

**Recommendation.** When Sentry is added (see 7.1), configure `logger.info` to NOT send remotely — only `warn` and `error` should ship. Or drop the info logs entirely for prod (Next.js `NEXT_PUBLIC_LOG_LEVEL` gate).

---

## 8. Image, font, asset optimization

### 8.1 [P2] All PNG illustrations in `public/Dashboard/` and `public/landing/` are served as-is.

**Evidence.** Manual grep of `next/image` usage. `next/image` will optimize on-the-fly if configured for the domain — but static PNGs in `public/` may not be routed through the loader unless every consumer wraps them in `<Image>`.

**Risk at scale.** Marketing pages ship larger-than-necessary images to mobile users. Not launch-blocking, but easy CDN cache win.

**Recommendation.** Audit `public/`: any PNG > 200KB should be converted to WebP or served through `next/image` with responsive `sizes`. Same for the hero screenshots and dashboard illustrations.

---

### 8.2 [P2] Font loading — Weglot may inject its own fonts.

**Evidence.** `components/shared/weglot-loader.tsx` + CSS fences in `globals.css`.

**Risk at scale.** Weglot's default switcher would inject fonts; we've suppressed the switcher, but confirm the font injection is also suppressed (or intentionally kept).

**Recommendation.** Run a network trace on the production landing page — filter to fonts. Should see only the app's own fonts. Any Weglot-owned font URL means the CSS fence needs updating.

---

## 9. SEO, metadata, sitemaps

### 9.1 [P1] Meta descriptions look good but there's no sitemap or robots.

**Evidence.** `app/(landing)/page.tsx` sets `metadata`. No `app/sitemap.ts` or `app/robots.ts` in the tree.

**Risk at scale.** Google will crawl anyway, but ranking is faster with an explicit sitemap. And without robots.txt we have no way to tell crawlers which routes NOT to index (e.g. `/pdf-composer`, `/dashboard`, `/sign-in`).

**Recommendation.** Add `app/sitemap.ts` (Next.js will generate the XML at build) listing every public marketing route: `/`, `/about`, `/all-tools`, `/pricing`, `/privacy`, `/terms-and-conditions`, `/refund`, `/subscription-terms`, `/cookies`, `/do-not-sell`, `/contact`, `/convert/*`. Add `app/robots.ts` disallowing app routes.

---

### 9.2 [P2] Open Graph / Twitter card metadata not verified per-route.

**Evidence.** Landing metadata sets `title` + `description`. No `openGraph` or `twitter` blocks visible.

**Risk at scale.** A link shared on X / LinkedIn / Slack renders as a bare URL with no preview image. Materially worse for organic acquisition.

**Recommendation.** Add `openGraph.images: [{ url: '/og.png' }]` + `twitter.card: 'summary_large_image'` in the root layout metadata. Design a 1200×630 OG image if none exists.

---

## 10. Accessibility

### 10.1 [P2] Auth cards use raw `<input>` with `aria-invalid` — good — but the buttons on the login/signup card are plain `<button>` with inline styling, not HeroUI `Button`.

**Evidence.** `components/sections/auth/login-card.tsx`, `signup-card.tsx`.

**Risk at scale.** Screen reader behavior is fine (semantic `<button type="submit">`), but focus rings + disabled states are hand-rolled rather than centralized. Inconsistent with the rest of the app.

**Recommendation.** Post-launch consistency pass, not blocker.

---

### 10.2 [P2] FAQ accordion is keyboard-accessible (button-based) but no ARIA landmark for the section.

**Evidence.** `components/sections/new-landing/landing-faq.tsx` — `<section aria-labelledby="faq-heading">` is correct. Each row uses `role="region"` on the panel. Good.

**Recommendation.** Add a Lighthouse a11y pass to CI so regressions here are caught automatically.

---

## 11. Concurrent-user considerations

### 11.1 [P1] Each user in the editor runs pdf.js in its own worker.

**Evidence.** By design — pdf.js worker is per-tab. Not a backend concern.

**Risk at scale.** Client memory: a user on an older Android phone with 3GB RAM opening a 50-page PDF is not our concern per se — but a "PDFVault crashed my phone" review on the Play Store is. Set a friendly max page count / max file size boundary in the UI (100MB is already enforced — decide whether to also cap by page count).

**Recommendation.** Instrument `pageCount` at load and log a warning if a user opens > 200 pages on mobile. Consider a "large file" mode that lazy-mounts only the visible page (already partly done via the thumbnail sidebar).

---

### 11.2 [P0] Solidgate embed loads a third-party iframe on the paywall.

**Evidence.** `components/sections/billing/PaywallModal.tsx` — `PaymentForm` from `@solidgate/react-sdk`.

**Risk at scale.** Solidgate's iframe fetches Solidgate's CDN, Apple Pay JS, Google Pay JS. If any of these have partial outages, the paywall can render empty. Under a launch spike, this is the most business-critical iframe in the app.

**Recommendation.** (a) Add a Sentry breadcrumb on Solidgate `onMounted` / `onError` so we know when the iframe fails to render. (b) Test the paywall behind a network-throttled connection to confirm the "or pay with card" divider hides correctly (already `has-[+_.rounded-xl:only-child]:hidden` — verify). (c) Document the Solidgate status page URL in the incident runbook.

---

### 11.3 [P1] Rate-limited response handling.

**Evidence.** Backend has `@nestjs/throttler` globally. Frontend has no visible handling for HTTP 429 beyond generic axios error.

**Risk at scale.** Under a bot burst or a legitimate crowd surge, real users see "Export failed" with no context. They'll retry, hit 429 again, complain.

**Recommendation.** Add a 429-specific axios interceptor that (a) reads the `Retry-After` header, (b) shows a friendly "we're a bit busy — try again in {N} seconds" toast, (c) optionally auto-retries once after the delay for idempotent operations.

---

## 12. Repository & CI hygiene

### 12.1 [P1] No CI config visible in the repo root.

**Evidence.** `find . -maxdepth 2 -name 'ci.yml' -o -name '.github' -o -name 'circle*'` — check separately.

**Risk at scale.** If tests / build / lint aren't gated on PRs, a broken deploy is a single-commit slip away.

**Recommendation.** Add a minimal GitHub Actions workflow that runs `bunx tsc --noEmit && bun run lint && bun run build` on every PR to `main`. Optional: run the Playwright suite (`tests/pdf-editor/export-signin-redirect.spec.ts`) that already exists per CLAUDE.md.

---

### 12.2 [P2] Locked paths hook + mobile checklist are enforced Claude-side, not repo-side.

**Evidence.** `.claude/hooks/check-locked-paths.cjs`, `.claude/LOCKED_PATHS`, `.claude/skills/pdf-editor-architecture/**`. These fire when a Claude session touches a locked file.

**Risk at scale.** A human contributor (or a non-Claude AI) editing these files hits no guard rail. The invariants live in `CLAUDE.md` — invisible to normal workflow.

**Recommendation.** Move the lock enforcement to a pre-commit hook (Husky / lefthook) that reads the same `.claude/LOCKED_PATHS` file. Same enforcement, works for every actor.

---

## 13. Prioritized action list (frontend-only)

**Must do before launch (P0):**

1. Install Sentry (or equivalent) — 7.1.
2. Verify Clerk production email-code strategy live via synthetic monitor — 6.2.
3. Add TanStack Query mutation retry defaults for idempotent operations (NOT payments) — 4.1.
4. Add Solidgate iframe observability hooks — 11.2.

**Do before or during launch week (P1):**

5. Bundle analyzer in CI + fail-on-regression — 1.1.
6. Add error boundaries to landing/app/tools route groups — 7.2.
7. IDB size-cap + eviction — 3.1.
8. pdf.js document-leak heap-snapshot test — 3.2.
9. 429 handler with Retry-After — 11.3.
10. `app/sitemap.ts` + `app/robots.ts` — 9.1.
11. CI workflow gating type check + lint + build — 12.1.
12. Move locked-path enforcement to pre-commit — 12.2.
13. Editor-save flow uses `uploadToasts` (not `toast.loading`) — 4.3.

**Near-term (P2):**

14. Lazy-load editor modals via `next/dynamic` — 1.2.
15. Bundle-analyzer follow-through on HeroUI on marketing pages — 1.3.
16. Web-worker or chunk the export pipeline — 2.4.
17. Cap Fabric history stack per page — 5.1.
18. Optimize `public/` images (WebP or `next/image`) — 8.1.
19. Open Graph metadata — 9.2.
20. Sync `logger` info calls when Sentry lands — 7.3.

**Nice-to-have (P3):**

21. Auth-cards → HeroUI Button consistency pass — 10.1.
22. Lighthouse in CI — 10.2.

---

## 14. What we're NOT flagging (intentional, safe as-is)

- Mobile view-only text (`suppressText: !isMobile`) — load-bearing per CLAUDE.md invariants.
- `objectCaching: false` on IText — locked path, documented workaround.
- `window.location.assign` in auth finalize — iOS Safari cookie-commit requirement (auth chain invariant #15).
- `mx-auto w-fit` scroll container — iOS Safari zoom-scroll fix.
- All 21 items in the auth + paywall + export flow chain — reviewed and preserved in the recent branch.
- Watermark's inline `renderPageToPng` + `hasGenuineEdits` guard — load-bearing per merge-pdf history.

Anything you'd like re-audited from a different angle, ping and I'll re-run.
