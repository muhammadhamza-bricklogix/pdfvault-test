# 12 — Analytics + tracking

**Snapshot date:** 2026-09-01

## Providers active in production

| Provider | Purpose | Files |
|---|---|---|
| Google Tag Manager (GTM) | Central tag manager for GA4 + Ads | `gtag-conversion.tsx` + root layout script |
| Google Ads | Conversion tracking + click-ID capture | `google-ads-click-boot.tsx`, `google-click-id.ts`, `gtag-conversion.tsx` |
| Sentry | Error + performance monitoring | `@sentry/nextjs`, `sentry-user-context.tsx` |
| CookieYes | Cookie consent banner | Injected script in root layout |
| Weglot | Multi-language switcher | `weglot-loader.tsx` |

## Google Ads + GTM

- `components/shared/google-ads-click-boot.tsx` — mounts once at the root layout, captures the Google Ads click ID (`gclid`) from URL params + persists to storage
- `lib/client/analytics/google-click-id.ts` — click-ID helpers (read/write)
- `components/shared/gtag-conversion.tsx` — fires GTM + Google Ads conversion events (uploads, sign-ups, purchases)

### Recent history

- 2026-08 — CookieYes temporarily disabled to debug GTM (commit `09181d2`), then re-enabled (commit `7a038d2`). Do NOT disable again without a plan.

## Sentry

- Package: `@sentry/nextjs` v10.69.0
- `components/shared/sentry-user-context.tsx` — sets Sentry user scope (id, email) once Clerk hydrates
- Route wrapper: Sentry's Next.js integration handles server + client capture
- Smoke test: `app/api/sentry-test/` — hit in prod to verify DSN + capture

## Weglot

- `components/shared/weglot-loader.tsx` — initializes Weglot with `switchers: []`
- **Custom switcher only** — Weglot's built-in floating switcher is CSS-hidden via `globals.css`:
  ```css
  .country-selector, .wg-drop, .weglot-container, #weglot-listbox,
  [class*="weglot-inline"], [class*="wg-flags"] { display: none; }
  ```
- Custom `LanguageSwitcher` lives in the site navbar + dashboard sidebar + editor top chrome (invariant #21 in [`../../CLAUDE.md`](../../CLAUDE.md))
- Both the `switchers: []` init AND the CSS fence must stay

## CookieYes

- Root layout `<head>` injects the CookieYes script
- Consent banner surfaces on first visit
- Re-enabled 2026-08 after GTM debug (commit `7a038d2`)

## Console output control

- `NEXT_PUBLIC_APP_ENV` env var controls console output in production (commit `fe44131`)
- `lib/shared/utils/logger` uses it to gate `console.*` calls

## Related files

| File | Role |
|---|---|
| `components/shared/google-ads-click-boot.tsx` | Click-ID capture boot |
| `components/shared/gtag-conversion.tsx` | GTM + Ads conversion events |
| `components/shared/sentry-user-context.tsx` | Sentry user scope |
| `components/shared/weglot-loader.tsx` | Weglot init |
| `lib/client/analytics/google-click-id.ts` | Click-ID helpers |
| `app/api/sentry-test/` | Sentry smoke test |

## Related

- [`03-providers.md`](./03-providers.md) — boot components mounted globally
- [`14-environment.md`](./14-environment.md) — env vars for analytics keys
