# 16 — Locked paths

**Snapshot date:** 2026-09-01
**File:** [`../../.claude/LOCKED_PATHS`](../../.claude/LOCKED_PATHS)
**Hook:** [`../../.claude/hooks/check-locked-paths.cjs`](../../.claude/hooks/check-locked-paths.cjs)

## Purpose

Production freeze. Every path below is mechanically locked — a PreToolUse hook blocks `Edit`, `Write`, `MultiEdit`, and `NotebookEdit` against any listed path. Prevents unintended regression of load-bearing code.

## Bypass

Ask the user first. Then:

```bash
export CLAUDE_UNLOCK_PATHS=1
```

Re-launch Claude Code. To permanently remove a lock: delete the line in `.claude/LOCKED_PATHS` and tell Claude what changed.

## Locked areas (as of 2026-09-01)

### PDF editor (full lock)

- `lib/client/pdf-editor/**` — pure logic (extraction, merge, build, drawers, coord/color helpers)
- `lib/client/hooks/pdf-editor/**` — React glue (loaders, tools, save, navigation, manage-pages)
- `components/sections/pdf-editor/**` — UI (shell, viewer, toolbar, sidebars, modals)
- `lib/client/stores/pdf-editor-store.ts` — editor Zustand store
- `lib/client/stores/pdf-search-store.ts` — search state
- `app/(tools)/pdf-editor/**` — editor route
- `app/(tools)/pdf-composer/**` — main editor route

See [`06-pdf-editor.md`](./06-pdf-editor.md).

### W-9 form editor (full lock)

- `components/sections/forms/**` — FormEditor + FormCanvas + FormSidebar + all field components + W9 wrappers
- `lib/client/forms/**` — schema, validation, normalization, stamping, pending values, preview render
- `lib/client/stores/form-editor-store.ts` — W-9 store
- `lib/client/hooks/forms/**` — form hooks
- `app/(tools)/forms/w-9/**` — editor route
- `app/(tools)/w-9-form/**` — short marketing route
- `app/(marketing)/(site)/forms/w-9/**` — marketing route
- `app/(marketing)/(site)/w9-form/**` — landing route

See [`07-w9-editor.md`](./07-w9-editor.md).

### Auth + paywall + export chain

- `components/shared/pending-editor-file-hydrator.tsx`
- `components/shared/sign-in-prompt-modal.tsx`
- `components/sections/billing/PaywallModal.tsx`
- `components/sections/billing/PaywallProvider.tsx`
- `lib/client/hooks/billing/use-paywall.ts`
- `lib/client/hooks/billing/ensure-entitlement.ts`
- `lib/client/hooks/billing/entitlement-cache.ts`
- `lib/client/hooks/billing/paywall-bus.ts`
- `lib/client/hooks/auth/use-sign-in-flow.ts`
- `lib/client/hooks/auth/use-sign-up-flow.ts`
- `components/sections/new-landing/upload-workspace.tsx`
- `lib/client/upload/pending-editor-file.ts`
- `lib/client/upload/run-pending-conversion.ts`
- `lib/client/stores/pending-conversions-store.ts`

See [`04-auth.md`](./04-auth.md), [`05-uploads-conversions.md`](./05-uploads-conversions.md), [`08-billing-paywall.md`](./08-billing-paywall.md).

## Format

`.claude/LOCKED_PATHS` supports:

- Exact path: `lib/client/pdf-editor/merge-pdf.ts`
- Glob with `**`: `lib/client/pdf-editor/**`
- Leading `!` to negate (allow): `!lib/client/pdf-editor/README.md`
- Comments start with `#`
- Blank lines ignored
- Paths relative to repo root

## When something needs to change

1. Load the relevant skill (`pdf-editor-architecture`, `auth-flow-guardian`) + read the linked docs.
2. Verify the fix doesn't re-break a documented invariant. See [`06-pdf-editor.md`](./06-pdf-editor.md) §"Load-bearing invariants" or the specific feature doc.
3. Ask the user before bypassing.
4. Apply fix.
5. Walk the mobile checklist ([`../../CLAUDE.md`](../../CLAUDE.md) §"Mobile pre-push checklist") — 10 items, iOS Safari + Android Chrome.
6. If the invariant genuinely changed, update the feature doc + `CLAUDE.md`.

## Rollback target

The tag `stable-2026-08-19` (commit `53892a5`) marks the last confirmed-clean editor state. Rollback: see [`17-recovery.md`](./17-recovery.md).

## Related

- [`06-pdf-editor.md`](./06-pdf-editor.md) — editor invariants
- [`07-w9-editor.md`](./07-w9-editor.md) — W-9 architecture
- [`04-auth.md`](./04-auth.md) — auth chain
- [`15-skills-regressions.md`](./15-skills-regressions.md) — skills + hooks + memory
- [`17-recovery.md`](./17-recovery.md) — rollback procedure
