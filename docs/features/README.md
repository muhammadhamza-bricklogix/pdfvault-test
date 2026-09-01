# Feature reference index

**Snapshot date:** 2026-09-01
**Status:** Production. Each file below covers one feature — what it does, how it's implemented, how data flows, and the invariants that keep it stable.

If you need the one-page overview instead, read [`../STABLE_SYSTEM.md`](../STABLE_SYSTEM.md).

## Foundation

| # | File | Topic |
|---|---|---|
| 01 | [`01-stack.md`](./01-stack.md) | Stack, versions, commands, path alias |
| 02 | [`02-routes.md`](./02-routes.md) | Route map by group (landing / marketing / app / tools / share / api) |
| 03 | [`03-providers.md`](./03-providers.md) | Provider tree + boot components |
| 14 | [`14-environment.md`](./14-environment.md) | Env vars, config, secrets |

## User flows

| # | File | Topic |
|---|---|---|
| 04 | [`04-auth.md`](./04-auth.md) | Sign-in / sign-up / 2FA / signed-out edit continuity |
| 05 | [`05-uploads-conversions.md`](./05-uploads-conversions.md) | Upload pipeline + X↔PDF conversion routing |
| 08 | [`08-billing-paywall.md`](./08-billing-paywall.md) | Solidgate + paywall + entitlement + invoices + cancellation |
| 09 | [`09-dashboard.md`](./09-dashboard.md) | Dashboard shell + documents table + settings |
| 10 | [`10-share-links.md`](./10-share-links.md) | Public share links |
| 11 | [`11-version-history.md`](./11-version-history.md) | Version history + preview + restore |
| 12 | [`12-analytics.md`](./12-analytics.md) | Google Ads, GTM, CookieYes, Sentry |
| 13 | [`13-offline.md`](./13-offline.md) | Offline detection + resilience |

## Editors (locked in production)

| # | File | Topic |
|---|---|---|
| 06 | [`06-pdf-editor.md`](./06-pdf-editor.md) | PDF Editor — load → render → edit → save → export + tools + modals + invariants |
| 07 | [`07-w9-editor.md`](./07-w9-editor.md) | W-9 Form Editor — dual-UI (sidebar + overlay), session contract, finalize |

## Operations

| # | File | Topic |
|---|---|---|
| 15 | [`15-skills-regressions.md`](./15-skills-regressions.md) | Project skills + hooks + memory + specs |
| 16 | [`16-locked-paths.md`](./16-locked-paths.md) | Locked paths — what's frozen and why |
| 17 | [`17-recovery.md`](./17-recovery.md) | Regression rollback procedure |

## Maintenance

Each feature file has a `Snapshot date` header. When you touch a feature, bump the date and (if the change is substantial) update the relevant file. Add new features as new numbered files and register them in this index.
