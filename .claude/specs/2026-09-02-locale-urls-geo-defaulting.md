# Locale URLs + Geo-IP Defaulting (Phase 1 scaffolding)

**Date:** 2026-09-02
**Status:** Phase 1 shipped (foundation) + pivoted to Weglot-only translation. Reverse Proxy infra drafted, not yet applied.
**Owner spec at plan-time:** `~/.claude/plans/hi-you-have-an-idempotent-boole.md`
**Client requirement:** every language (EN, DE, FR, ES, PT, AR) lives on a subdirectory URL; locale-less URLs geo-default; explicit locale in URL always wins; Google Ads campaigns point at these URLs, so SEO and zero-flash matter.

**Pivot 2026-09-02 (evening):** client (Amit) confirmed Weglot Pro (Monthly, €79/mo) is active — 5 languages, subdirectory URL structure included on Pro, custom Reverse Proxy configurable. Migration to `next-intl` + `messages/*.json` reversed in favour of Weglot handling all translation. Two-phase deploy:

- **Phase A (today):** Weglot client SDK loads via `WeglotBoot`, translates DOM in browser. Users get translations. Google sees English HTML.
- **Phase B (next infra window, ~2–3 hours):** flip CloudFront to route `/de/*` … `/ar/*` through Weglot's reverse-proxy origin. Google sees translated HTML.

---

## Why this exists

Weglot's client-side JS SDK produced non-crawlable HTML (translations paint after hydration) and caused an English flash on first paint. Neither is acceptable for Google Ads final URLs — the crawler and the paid visitor both need the target locale in the initial server response. The subdomain scheme (`de.pdfvault.ai/edit`) also confused search-console reporting and split link equity from the root domain.

Client (Amit) asked for:
1. Crawlable subdirectory URLs — `pdfvault.ai/de/edit`, `/fr/compress`, etc. — with English at root (no `/en/` prefix).
2. Locale-less URLs geo-default via CloudFront's `CloudFront-Viewer-Country` header, with priority `lang_pref` cookie → geo → EN.
3. Bots never redirected. Explicit-locale URLs never redirected.
4. No `Accept-Language` fallback (intentional exclusion).
5. Zero-hop Ads final URLs.

---

## Architectural decision — middleware rewrite pattern (no `[locale]` segments)

The obvious `next-intl` pattern uses `app/[locale]/...` route segments. For this codebase that would have meant moving ~50 route files (23 landing pages, 3 tools, dashboard, marketing, auth) into a `[locale]` folder — a giant, error-prone diff that risks the auth chain.

Instead we run a **middleware-rewrite** pattern:

- The URL bar keeps `/de/edit`, `/fr/compress`, `/es/pricing`, etc.
- `proxy.ts` (Next.js middleware) parses the locale prefix off the pathname, rewrites internally to the un-prefixed route (`/edit`), and stamps two request-only headers:
  - `x-pdfvault-locale` — the resolved locale (`de`, `fr`, …, or `en` fallback).
  - `x-pdfvault-pathname` — the ORIGINAL locale-prefixed pathname, so `generateMetadata` can compute canonical + hreflang.
- `i18n/request.ts` (`getRequestConfig` for `next-intl`) reads `x-pdfvault-locale` and returns the matching message catalog.
- `app/layout.tsx` reads both headers to set `<html lang dir>`, wrap children in `NextIntlClientProvider`, and emit per-URL metadata.
- No route file duplicates. Every existing tool page automatically gets a working locale variant.

**Trade-off:** all routes are now server-rendered (dynamic) because `headers()` in the root layout defers static generation. This is expected and desirable — the middleware needs to run per request for the header injection to work, and CloudFront still caches on path.

---

## What ships

### New files

| File | Purpose |
|---|---|
| `lib/shared/constants/locale-map.ts` | Single source of truth: supported locales, country → locale table, RTL locales, OG locale tags, `lang_pref` cookie name, bot UA regex, header names, `parseLocalePrefix` helper. Mirrored in the CloudFront Function. |
| `infra/cloudfront-functions/geo-redirect.js` | CloudFront Function (JS 2.0). Viewer-request handler. Bot exemption, static-asset exemption, `robots.txt` + `sitemap.xml` exemption, decision order (cookie → geo → EN), 302 with `Cache-Control: no-store` + `Set-Cookie: lang_pref`. **Ships as `GEO_REDIRECT_ENABLED = false`** — kill switch. `_internal.setEnabled()` exposed for the Node test harness. |
| `i18n/request.ts` | `next-intl` request config. Reads `x-pdfvault-locale` header, imports the matching `messages/<locale>.json`, falls back to EN. |
| `messages/en.json` `de.json` `fr.json` `es.json` `pt.json` `ar.json` | Message catalog scaffolds — nav labels, CTAs, meta strings. **Placeholders only** — client team exports Weglot dashboard translations to replace them. |
| `tests/geo/locale-decision.spec.ts` | 19 `bun:test` unit tests covering the CloudFront Function decision matrix + locale-map constants. Runs with `bun test tests/geo/locale-decision.spec.ts`. |

### Modified files

| File | Change |
|---|---|
| `proxy.ts` | Rewritten. Retains the CloudFront canonical-origin reconstruction (`X-Forwarded-Host`), retains all auth chain guards (`/pdf-composer?id=` classifier + protected-route bounce) but runs them against the locale-STRIPPED path. Adds subdomain-301 branch gated behind `LOCALE_SUBDOMAIN_301=on`. Adds `withLocaleHeaders()` helper. Matcher extended to exempt `robots.txt`, `sitemap.xml`, `favicon.ico`, `manifest.{webmanifest,json}`. |
| `next.config.mjs` | Wraps `nextConfig` in `withNextIntl("./i18n/request.ts")`. Pins `trailingSlash: false` so hreflang, canonical, sitemap, CloudFront all agree on one URL form. |
| `app/layout.tsx` | Rewritten. `async generateMetadata()` emits self-referencing canonical + reciprocal hreflang for all 6 locales + `x-default = EN root` + `og:locale` + `alternateLocale`. `RootLayout` reads locale header, sets `<html lang dir>`, wraps children in `NextIntlClientProvider`. Removed Weglot preconnect, Weglot preload script, `<WeglotLoader />` mount, subdomain hreflang. |
| `app/sitemap.ts` | Emits **168 entries** — 28 canonical routes × 6 locales. Each entry declares `alternates.languages` (Next.js turns this into `<xhtml:link rel="alternate" hreflang="…">` per URL). Route inventory: 11 static + 12 tool landings + 5 convert routes. |
| `components/shared/navigation/language-switcher.tsx` | Rewritten. Reads locale from `useLocale()`, `buildLocaleHref(nextLocale, pathname)` computes the target, `persistLangPref(nextLocale)` sets the cookie, `router.push` navigates. `buildLocaleHref` + `persistLangPref` re-exported for reuse. |
| `components/sections/new-landing/landing-language-switcher.tsx` | Same rewrite. Reuses the shared helpers. |
| `components/sections/new-landing/landing-tools.tsx` | Removed the Weglot rescan effect (`translateVisibleTab`) — no longer needed without Weglot's DOM MutationObserver. |
| `lib/providers/app-providers.tsx` | Removed `<WeglotRouteSync>` mount + the `Suspense` wrapper it needed. |
| `components/sections/legal/cookie-policy-content.tsx` | Cookie disclosure row swapped: `pdfvault:weglot-lang` → `lang_pref` with 12-month expiry. |
| `components/sections/legal/privacy-policy-content.tsx` | Removed Weglot from the third-party services disclosure. |
| `package.json` | Added `next-intl` (runtime) + `@types/bun` (dev — for `bun:test` types in tsc). |

### Deleted files

- `components/shared/navigation/weglot-loader.tsx`
- `components/shared/navigation/weglot-route-sync.tsx`
- `lib/shared/types/weglot.d.ts`

---

## How the pieces cooperate at request time

### Locale-prefixed request (e.g. `GET /de/edit`)

1. **CloudFront Function** (once `GEO_REDIRECT_ENABLED = true`): `hasLocalePrefix("/de/edit")` returns true → passes request straight through untouched.
2. **CloudFront cache** looks up by path. Origin caches by path only — no country or cookie in the cache key.
3. **Next.js middleware** (`proxy.ts`):
   - No subdomain match on `pdfvault.ai` → subdomain 301 branch skipped.
   - `parseLocalePrefix("/de/edit")` → `{ locale: "de", rest: "/edit" }`.
   - Auth guards run on the stripped path (`/edit` is not protected, so nothing fires).
   - Rewrites internally to `/edit` and attaches `x-pdfvault-locale: de`, `x-pdfvault-pathname: /de/edit` to the request.
4. **`i18n/request.ts`** reads `x-pdfvault-locale` → returns `messages/de.json`.
5. **`app/layout.tsx`**:
   - `generateMetadata()` builds canonical `https://pdfvault.ai/de/edit`, hreflang for all 6 locales + `x-default`, `og:locale = de_DE`, `og:locale:alternate = [en_US, fr_FR, es_ES, pt_PT, ar_SA]`.
   - Sets `<html lang="de" dir="ltr">`.
   - Wraps children in `NextIntlClientProvider` so any client component using `useTranslations()` gets the DE catalog.
6. Rendered page (`/edit`'s page component) streams to the client with the locale-correct metadata already in `<head>`.

### Locale-less request (e.g. `GET /` from a DE IP)

1. **CloudFront Function** (with `GEO_REDIRECT_ENABLED = true`): not prefixed, not a bot, not exempt, no cookie → `resolveLocaleFromCountry("DE")` returns `"de"` → returns 302 to `/de` with `Cache-Control: no-store` and `Set-Cookie: lang_pref=de; Path=/; Max-Age=31536000; Secure; SameSite=Lax`.
2. Browser follows redirect → `GET /de` → same flow as the locale-prefixed request above.

### Bot request (Googlebot from any IP)

1. **CloudFront Function**: `BOT_UA_REGEX.test(ua)` returns true → passes through no matter what the country header says. Google sees each locale URL directly.

### `/robots.txt` or `/sitemap.xml` request

1. **CloudFront Function**: `isExemptPath("/robots.txt")` returns true → pass-through.
2. **Next.js middleware matcher** also exempts these paths, so Clerk auth doesn't run on them either.
3. Sitemap emits all 168 locale × route entries with reciprocal hreflang.

### Weglot subdomain hit (`de.pdfvault.ai/edit`) — Phase 3 only

1. **Next.js middleware** sees `Host: de.pdfvault.ai`, checks `LOCALE_SUBDOMAIN_301`. Off during Phase 1/2 (default) → skip. Once flipped to `on`: 301 to `https://pdfvault.ai/de/edit` preserving path + query.

---

## Kill switches / env flags

| Flag / config | Location | Default | Flip when |
|---|---|---|---|
| `GEO_REDIRECT_ENABLED` | `infra/cloudfront-functions/geo-redirect.js:10` (const in the JS file) | `false` | After Phase 2 QA. Republish the CloudFront Function to activate. |
| `LOCALE_SUBDOMAIN_301` | ECS task-def env var | unset (off) | Phase 3, after subdirectory URLs are indexed in Search Console. Set to `on`. |
| Gulf countries → `ar` | `COUNTRY_TO_LOCALE` in both `locale-map.ts` and `geo-redirect.js` | Mapped to `"en"` | After RTL audit signs off. Change `"en"` to `"ar"` in both files + republish the function. |
| Morocco / Algeria / Tunisia | Not in map | Defaults to EN | Once Amit confirms AR vs FR. Add MA/DZ/TN entries in both files. |

---

## Testing done

**Automated (all pass on the current branch):**
- `bun test tests/geo/locale-decision.spec.ts` → 19 tests / 178 assertions. Covers: locale-map constants, kill switch off, DE/FR/US/JP/Gulf IPs on `/` and `/edit`, locale-prefix passthrough, cookie override, cookie=en with DE IP, Googlebot, Bingbot, `robots.txt`, `sitemap.xml`, `/api/*`, `/_next/*`, query preservation, full country-map sweep.
- `bunx tsc --noEmit` → clean.
- `bun run lint` → clean (8 pre-existing warnings unrelated to this change).
- `bun run build` → clean. 100 pages generated, sitemap + robots stay static, everything else dynamic.

**Not done (called out in the follow-ups):**
- Playwright E2E with spoofed `CloudFront-Viewer-Country` header.
- Real-device mobile walk on `/ar/edit` for RTL breakage (CLAUDE.md checklist).
- Zero-hop `curl -I` audit against production Ads final URLs.
- Search Console URL-inspection sweep.

---

## Post-pivot state (evening 2026-09-02)

The `next-intl` + message-catalog path was reversed after Amit confirmed Weglot Pro is active and translations already exist in the Weglot dashboard. Concrete changes vs the earlier "What ships" section:

- **Removed:** `next-intl` package, `i18n/request.ts`, `messages/{en,de,fr,es,pt,ar}.json`, `NextIntlClientProvider` from root layout, `useLocale()` from switchers.
- **Added:** `components/shared/navigation/weglot-boot.tsx` (client SDK loader in subdirectory mode). Weglot preconnect + privacy disclosure + `wglang` cookie in cookie policy restored. `data-wg-notranslate` on file table filenames, identity popover PII, sidebar user block.
- **Kept:** `proxy.ts` locale detection + Clerk composition, `app/layout.tsx` header-driven canonical + hreflang + `<html lang dir>`, `app/sitemap.ts` per-locale entries, language switcher (derives locale from `usePathname()` now), CloudFront Function file (dormant).

## Weglot Reverse Proxy migration path (Phase B) — Option 1

**Routing model:** public URLs go through Weglot's proxy for server-side translation + Google indexing. Authenticated + PII-sensitive routes stay on the ALB — Weglot never sees the user's file library, editor content, W-9 tax data, share tokens, or dashboard chrome.

**Per locale (de, fr, es, pt, ar), ALB-first exceptions (must precede Weglot catchall):**
- `/{locale}/dashboard*`
- `/{locale}/pdf-composer*`
- `/{locale}/pdf-editor*`
- `/{locale}/w-9-form*`
- `/{locale}/w9-form*`
- `/{locale}/forms/*`
- `/{locale}/share/*`

Then `/{locale}/*` catchall → `weglot-proxy` origin.

**Behavior count added:** 7 ALB-first × 5 locales + 5 Weglot catchall = **40 new**. Combined with existing (~6), the distribution needs **~46 behaviors**. AWS CloudFront default quota is 25; a quota increase to 100 is required BEFORE applying.

**Config drafts under `infra/`:**

| File | Purpose |
|---|---|
| `infra/cloudfront-weglot-proxy.md` | Full runbook: Weglot dashboard steps, quota bump, staging validation, prod deploy, verification, rollback. |
| `infra/cloudfront-weglot-proxy.json` | Reference definition of origin + cache-behavior templates + locale/pattern lists. Documentation, not applied directly. |
| `infra/cloudfront-add-weglot-proxy.sh` | Idempotent apply — pulls current distribution config, adds `weglot-proxy` origin + 40 locale behaviors in the right order, prompts for confirmation, applies with correct ETag. |
| `infra/cloudfront-remove-weglot-proxy.sh` | Rollback — strips the origin + all 40 locale-scoped behaviors, reverts to ALB-only routing. |

**Sequence when Phase B ships:**

1. **Quota bump:** `aws service-quotas request-service-quota-increase --service-code cloudfront --quota-code L-BABCBFAB --desired-value 100`. Wait for approval (same-day).
2. **Weglot dashboard:** Settings → Setup → toggle Subdirectories + External Provider hosting. Note the destination endpoint. Optionally toggle OFF Weglot's automatic hreflang (we emit our own).
3. **Railway staging code deploy** — validates Phase A (client SDK translations, middleware, sitemap, hreflang, URL routing). Railway can't test CloudFront cache behaviors, so Phase B is prod-only.
4. **Prod code deploy** — same code branch onto AWS ECS Fargate. Users get Weglot client SDK translations. Ads campaigns work.
5. **CloudFront apply:** `export CLOUDFRONT_DIST_ID=... WEGLOT_ORIGIN_DOMAIN=... WEGLOT_API_KEY=...` then `bash infra/cloudfront-add-weglot-proxy.sh`.
6. **Wait ~5–10 min for edge propagation.** Poll status with `aws cloudfront get-distribution --id "$CLOUDFRONT_DIST_ID" --query 'Distribution.Status'`.
7. **Verify:** `curl -s https://pdfvault.ai/de/edit | grep -o '<html[^>]*lang="[^"]*"'` returns `<html lang="de">` with German body text. `curl -sI https://pdfvault.ai/de/dashboard` returns 302 to sign-in (ALB-served). Browser test: incognito load `/de/pricing`, confirm German in first paint (no swap).
8. **Rollback if needed:** `bash infra/cloudfront-remove-weglot-proxy.sh` (~5–10 min propagation).
9. **Optional cleanup after ~1 week of prod stability:** remove `WeglotBoot` from `app/layout.tsx` + delete `weglot-boot.tsx`. Client SDK becomes redundant on Weglot-proxied URLs. Do not rush — the client SDK is the fallback if CloudFront config develops issues.

## Follow-ups (in priority order)

1. **Ship Phase A today.** Nothing else needed on the code side — deploy the branch, verify Weglot subdirectory mode is toggled in the dashboard, verify `NEXT_PUBLIC_WEGLOT_API_KEY` is present in ECS task def. Users get translations client-side, Ads campaigns work.
2. **CloudFront Function deploy** — create the function in AWS, publish, and associate to the distribution's default cache behavior on viewer-request. Update `infra/cloudfront-setup.sh` to make the association idempotent. Whitelist `CloudFront-Viewer-Country` on the origin request policy (managed policy `AllViewer` includes it, or use a custom policy).
3. **Playwright E2E** — spoofed-country test that covers the QA checklist end-to-end. Suggested file: `tests/pdf-editor/locale-routing.spec.ts` (co-located with the existing PDF-editor specs so it runs in the same CI shard).
4. **Sitemap re-submission** — after production deploy, submit `https://pdfvault.ai/sitemap.xml` to Search Console and use URL Inspection on one URL per locale to force initial crawl.
5. **RTL audit + Arabic font** — logical CSS sweep (`margin-inline-start/end`, `text-align: start/end`, etc.), Fabric.js canvas kept LTR inside RTL page, subsetted Noto Sans Arabic loaded only on AR pages via `next/font/google`. Walk the CLAUDE.md mobile checklist on `/ar/edit` before flipping `SA/AE/EG/…` back to `"ar"` in the locale map.
6. **Weglot subdomain 301s** — after Search Console shows subdirectory URLs indexed, set `LOCALE_SUBDOMAIN_301=on` in the ECS task definition to activate the 301 branch in `proxy.ts`.
7. **Zero-hop Ads final URL audit** — `curl -I https://pdfvault.ai/de/edit` should return a single 200 with no 301/302 in front. Verify the chain doesn't stack (http→https, www→non-www, trailing slash, subdomain redirect, geo redirect). Add these curl assertions to CI.
8. **Optional: Clerk metadata sync** — on signup completion, persist the `lang_pref` cookie value to `user.publicMetadata.lang_pref` so signed-in users get their preferred locale on any device.

---

## Notes for future sessions

- ~~**Do NOT reintroduce the Weglot client SDK.**~~ **REVERSED 2026-09-02 evening.** Weglot Pro plan is active. Client SDK is back via `WeglotBoot` for Phase A. Phase B replaces it with Reverse Proxy at the CloudFront edge — see `infra/cloudfront-weglot-proxy.md`.
- **Do NOT add `Accept-Language` detection.** Explicit product decision: a German speaker on a US IP with no cookie sees English. Flagged with Amit.
- **The middleware-rewrite pattern is intentional.** Don't "migrate to `app/[locale]/`" as a cleanup. The rewrite handles the whole route tree with zero duplication; splitting into `[locale]` segments would require touching every page file.
- **Cache key stays path-only.** Never add country / cookie / user-agent to the CloudFront cache key. If a page needs per-country content, redirect at the CloudFront Function so origin caches per canonical URL.
- **Route matcher regex** (`proxy.ts` config) is what excludes `robots.txt`, `sitemap.xml`, `favicon.ico`, and static assets from Clerk + locale processing. If you extend it, keep those exclusions.
- The `useLocale()` hook in the language switcher returns the value the middleware passed via header. Reading it client-side after hydration is safe; the initial paint already has the correct locale in `<html lang>`.
- ~~Message JSON files are loaded via dynamic `import()` in `i18n/request.ts`~~ **Removed 2026-09-02 evening** — `next-intl` + `messages/` deleted. Weglot handles translation content end-to-end. `SUPPORTED_LOCALES` still governs URL routing (middleware, sitemap, hreflang, geo-redirect) but no longer requires a matching JSON file.
- **PII exposure via Weglot Reverse Proxy:** Weglot's proxy reads authenticated HTML server-side before serving the translated version. Personal data (filenames, name, email, user-uploaded content) must be marked with `data-wg-notranslate`. See files already marked: `pv-file-table.tsx` (row filenames), `identity-popover.tsx` (name + email), `dashboard-shell.tsx` (sidebar user block). Still pending: editor top chrome filename input in `PvEditorTopChrome.tsx` — file is locked (`.claude/LOCKED_PATHS`), needs explicit user unlock before adding.
