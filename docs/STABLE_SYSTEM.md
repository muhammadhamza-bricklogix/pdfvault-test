# PDFedits — Stable System Reference

**Snapshot date:** 2026-09-01
**Status:** Production. All flows below are shipped and load-bearing.
**Purpose:** Index for the per-feature reference. If a future change regresses a flow, use the feature file it belongs to + `.claude/LOCKED_PATHS` + `.claude/skills/pdf-editor-architecture/SKILL.md` to trace back to the known-good behavior.

## Per-feature reference

Each file below covers **one feature** — what it does, how it's implemented, how data flows, and the invariants that keep it stable.

### Foundation

- [`features/01-stack.md`](./features/01-stack.md) — Stack, versions, commands, path alias
- [`features/02-routes.md`](./features/02-routes.md) — Route map by group (landing / marketing / app / tools / share / api)
- [`features/03-providers.md`](./features/03-providers.md) — Provider tree + boot components
- [`features/14-environment.md`](./features/14-environment.md) — Env vars, config, secrets

### User flows

- [`features/04-auth.md`](./features/04-auth.md) — Sign-in / sign-up / 2FA / signed-out edit continuity (21-step chain)
- [`features/05-uploads-conversions.md`](./features/05-uploads-conversions.md) — Upload pipeline + X↔PDF conversion routing
- [`features/08-billing-paywall.md`](./features/08-billing-paywall.md) — Solidgate + paywall + entitlement + invoices + cancellation
- [`features/09-dashboard.md`](./features/09-dashboard.md) — Dashboard shell + documents table + settings
- [`features/10-share-links.md`](./features/10-share-links.md) — Public share links
- [`features/11-version-history.md`](./features/11-version-history.md) — Version history + preview + restore
- [`features/12-analytics.md`](./features/12-analytics.md) — Google Ads, GTM, CookieYes, Sentry, Weglot
- [`features/13-offline.md`](./features/13-offline.md) — Offline detection + resilience

### Editors (locked in production)

- [`features/06-pdf-editor.md`](./features/06-pdf-editor.md) — PDF Editor — load → render → edit → save → export + tools + modals + invariants
- [`features/07-w9-editor.md`](./features/07-w9-editor.md) — W-9 Form Editor — dual-UI, session contract, finalize

### Operations

- [`features/15-skills-regressions.md`](./features/15-skills-regressions.md) — Project skills + hooks + memory + specs
- [`features/16-locked-paths.md`](./features/16-locked-paths.md) — Locked paths — what's frozen and why
- [`features/17-recovery.md`](./features/17-recovery.md) — Regression rollback procedure

## Related docs

- [`../CLAUDE.md`](../CLAUDE.md) — canonical invariants, auth chain, mobile checklist
- [`./W9_EDITOR_ARCHITECTURE.md`](./W9_EDITOR_ARCHITECTURE.md) — W-9 deep dive
- [`./INFRASTRUCTURE.md`](./INFRASTRUCTURE.md) — non-technical infra overview
- [`./SUBSCRIPTION_USER_JOURNEY.md`](./SUBSCRIPTION_USER_JOURNEY.md) — billing + paywall journey
- [`./SHARE_LINKS_BACKEND_CONTRACT.md`](./SHARE_LINKS_BACKEND_CONTRACT.md) — share API contract
- [`../.claude/specs/`](../.claude/specs/) — dated session specs (evidence trails)
- [`../.repocards/AGENT_GUIDE.md`](../.repocards/AGENT_GUIDE.md) — pre-computed repo context

## Maintenance

- Each feature file has a `Snapshot date` header. When you touch a feature, bump the date and (if the change is substantial) update the file.
- Add new features as new numbered files under `features/` and register them in [`features/README.md`](./features/README.md) + here.
- Regenerate the repocards index after non-trivial changes: `npx repocards index`.
