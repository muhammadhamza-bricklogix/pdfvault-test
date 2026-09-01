# 14 — Environment + configuration

**Snapshot date:** 2026-09-01

## Env vars (required at build/runtime)

| Var | Purpose | Where used |
|---|---|---|
| `NEXT_PUBLIC_APP_ENV` | Controls console output in production (`prod` suppresses `console.*`, other values enable) | `lib/shared/utils/logger` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key | `@clerk/nextjs` |
| `CLERK_SECRET_KEY` | Clerk secret key (server-side) | Middleware + server helpers |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Sign-in route | Clerk config |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Sign-up route | Clerk config |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | Post-signin default | Clerk config |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | Post-signup default | Clerk config |
| `NEXT_PUBLIC_API_URL` (or equivalent) | NestJS backend base URL | Axios helpers |
| `NEXT_PUBLIC_SOLIDGATE_*` | Solidgate publishable + merchant IDs | `PaywallModal` |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN | `sentry-user-context.tsx` + Sentry init |
| `SENTRY_AUTH_TOKEN` | Sentry release upload (build-time) | Sentry Next.js integration |
| `NEXT_PUBLIC_GTM_ID` | Google Tag Manager container ID | `gtag-conversion.tsx` |
| `NEXT_PUBLIC_WEGLOT_API_KEY` | Weglot API key | `weglot-loader.tsx` |
| `NEXT_PUBLIC_COOKIEYES_ID` | CookieYes site ID | root layout script |

Check `.env.example` (if present) or the referenced files for the authoritative list per environment.

## Config files

- `next.config.mjs` — Next.js config, 308 redirects (`/w-9` → `/w-9-form`), image domains, headers
- `tsconfig.json` — TypeScript config + path alias (`@/*` → root)
- `eslint.config.*` — ESLint rules (import ordering, prop sort, unused imports, etc.)
- `postcss.config.*` + Tailwind v4 CSS-first config
- `playwright.config.*` — Playwright test runner config
- `server.js` — production runtime entrypoint (`bun run start:prod`)
- `package.json` — dependencies, scripts, `engines.bun`
- `sentry.*.config.*` — Sentry Next.js integration
- `proxy.ts` — Clerk middleware (named for historical reasons)

## Environment nuances

- **Staging Clerk requires password on signup** — email-only mode stranded users. See [`../../.claude/memory/project_signup_default_password.md`](../../.claude/memory/project_signup_default_password.md).
- **Solidgate Apple Pay** — requires Solidgate-side Apple domain verification. Frontend fully wired but Apple Pay button hidden until verification completes. See [`../../.claude/specs/2026-08-03-apple-pay-diagnostic.md`](../../.claude/specs/2026-08-03-apple-pay-diagnostic.md).
- **Backend invoice currency** — client-side USD override in place as a workaround. Remove after backend Payment writer fix. See [`../../.claude/memory/project_invoice_currency_workaround.md`](../../.claude/memory/project_invoice_currency_workaround.md).

## Deployment

- Production runtime: `bun run start:prod` (runs `node server.js`)
- Build: `bun run build`
- CI/CD: not documented in this repo (external)

## Related

- [`01-stack.md`](./01-stack.md) — stack + commands
- [`03-providers.md`](./03-providers.md) — global boot components that read env
- [`08-billing-paywall.md`](./08-billing-paywall.md) — Solidgate keys + Apple Pay
- [`12-analytics.md`](./12-analytics.md) — GTM + Sentry + Weglot + CookieYes
