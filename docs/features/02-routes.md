# 02 — Route map

**Snapshot date:** 2026-09-01

Routes are organized into route groups under `app/`. Every path below is production-live.

## Route groups at a glance

| Group | Folder | Auth | Layout wrap |
|---|---|---|---|
| Landing | `app/(landing)/` | Public | Landing header + footer |
| Marketing | `app/(marketing)/(site)/` | Public + auth cards | Marketing header + footer |
| App | `app/(app)/` | Signed-in | Dashboard shell (sidebar + topbar) |
| Tools | `app/(tools)/` | Signed-in editors | No sidebar; editor chrome |
| Share | `app/share/` | Public via token | Minimal chrome |
| API | `app/api/` | — | Server routes |

## Landing (`app/(landing)/`)

Public marketing + per-tool landings.

| Path | Component | Purpose |
|---|---|---|
| `/` | `home-hero.tsx` + `landing-tools.tsx` | Homepage — hero, tool grid, FAQ, closing CTA |
| `/all-tools` | `all-tools-catalog.tsx` (modal) | Full tool catalog |
| `/about` | static | Marketing |
| `/contact` | static | Marketing |
| `/edit` | `tool-landing-page.tsx` | Edit-PDF landing |
| `/compress` | `tool-landing-page.tsx` | Compress landing |
| `/split-pdf` | `tool-landing-page.tsx` | Split landing |
| `/watermark-pdf` | `tool-landing-page.tsx` | Watermark landing |
| `/rotate-pdf` | `tool-landing-page.tsx` | Rotate landing |
| `/organize-pdf` | `tool-landing-page.tsx` | Organize landing |
| `/unlock-pdf` | `tool-landing-page.tsx` | Unlock landing |
| `/password-protect-pdf` | `tool-landing-page.tsx` | Password-protect landing |
| `/sign-pdf` | `tool-landing-page.tsx` | Sign landing |
| `/extract-images` | `tool-landing-page.tsx` | Extract-images landing |
| `/delete-pages` | `tool-landing-page.tsx` | Delete-pages landing |
| `/remove-annotations` | `tool-landing-page.tsx` | Remove-annotations landing |
| `/convert/[slug]` | `tool-landing-page.tsx` + `CONVERT_ROUTES` | Every X↔PDF conversion — see [`05-uploads-conversions.md`](./05-uploads-conversions.md) |
| `/privacy` `/terms-and-conditions` `/cookies` `/refund-policy` `/subscription-terms` `/do-not-sell` | static | Legal |

## Marketing (`app/(marketing)/(site)/`)

Auth cards + secondary marketing.

| Path | Purpose |
|---|---|
| `/sign-in` | Custom Clerk sign-in card |
| `/sign-up` | Custom Clerk sign-up card |
| `/forgot-password` | Password recovery |
| `/sso-callback` | SSO callback |
| `/oauth-callback` | OAuth callback |
| `/tools/[slug]` | Alternate tool marketing surface |
| `/tools/split-pdf` | Split-PDF marketing |
| `/pricing` | Solidgate plan grid |
| `/forms/w-9` | W-9 form landing (long) |
| `/w9-form` | W-9 form landing (short paid-ads URL) |

## App (`app/(app)/`)

Signed-in dashboard.

| Path | Component | Purpose |
|---|---|---|
| `/dashboard` | `dashboard-shell.tsx` + `documents-table.tsx` | Main file table + quick tools |
| `/dashboard/activity` | `activity-feed.tsx` | Recent user activity |
| `/dashboard/forms` | `pv-forms-grid.tsx` | Available forms (W-9 today) |
| `/dashboard/tools` | quick tools listing | |
| `/dashboard/settings/general` | `settings/` | Profile |
| `/dashboard/settings/account` | | Account settings |
| `/dashboard/settings/language` | | Locale + Weglot toggle |
| `/dashboard/settings/billing` | `billing-settings-section.tsx` | Plan + invoices |
| `/dashboard/settings/danger` | | Danger zone (delete account) |

## Tools (`app/(tools)/`)

Signed-in editors.

| Path | Purpose |
|---|---|
| `/pdf-composer` | Main PDF editor (see [`06-pdf-editor.md`](./06-pdf-editor.md)) |
| `/pdf-editor` | Alternate legacy path — redirects into composer |
| `/forms/w-9` | W-9 landing (public in this group) |
| `/forms/w-9/edit` | W-9 editor (see [`07-w9-editor.md`](./07-w9-editor.md)) |
| `/w-9-form` | Short marketing URL for W-9 editor (308 redirect target) |

## Share (`app/share/[token]/page.tsx`)

Public view of a shared document. Contract: [`../SHARE_LINKS_BACKEND_CONTRACT.md`](../SHARE_LINKS_BACKEND_CONTRACT.md). Details: [`10-share-links.md`](./10-share-links.md).

## API (`app/api/`)

Only two internal routes:

- `app/api/sentry-test/` — Sentry smoke test
- `app/api/share/` — server-side share proxy

Everything else calls the NestJS backend directly via axios.

## Source of truth

- `lib/shared/constants/routes.ts` — `ROUTES.*` map (auth, public, legal, app, tools, forms, static)
- `lib/shared/constants/convert-routes.ts` — `CONVERT_ROUTES` slug map for `/convert/[slug]`
- `lib/shared/constants/tool-routes.ts` — canonical tool → editor route mapping
- `lib/shared/constants/tools.ts` + `landing-tools.ts` + `home-tool-grid.ts` — tool catalogs

## Middleware

`proxy.ts` at repo root is the Clerk middleware. Runs before every protected route request. Named `proxy.ts` for historical reasons; despite the name, it's `middleware.ts`-equivalent.

## Related

- [`04-auth.md`](./04-auth.md) — auth-gated redirects
- [`05-uploads-conversions.md`](./05-uploads-conversions.md) — `/convert/[slug]` behavior
- [`06-pdf-editor.md`](./06-pdf-editor.md) — `/pdf-composer`
- [`07-w9-editor.md`](./07-w9-editor.md) — `/forms/w-9/edit`
