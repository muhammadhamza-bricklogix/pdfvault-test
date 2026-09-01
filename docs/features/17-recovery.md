# 17 — Recovery procedure (regression rollback)

**Snapshot date:** 2026-09-01

Use this procedure when a regression ships and needs to be rolled back or root-caused. The goal is to identify **which prior invariant was broken** and fix that — not layer a new patch on top.

## Diagnostic steps

1. **Read the user's bug report closely.** Note: what worked before, when it stopped working, what step surfaces the bug.
2. **Load the `regression-forensics` skill** — it walks a `git log` + skill-log + `LOCKED_PATHS` + memory review before any fix.
3. **`git log --oneline --stat <path>` for the affected files.** Look for recent changes that overlap with the symptom.
4. **Cross-reference with the relevant feature doc:**
   - Editor bug → [`06-pdf-editor.md`](./06-pdf-editor.md) §"Load-bearing invariants" + [`../../.claude/skills/pdf-editor-architecture/SKILL.md`](../../.claude/skills/pdf-editor-architecture/SKILL.md) decisions log
   - W-9 bug → [`07-w9-editor.md`](./07-w9-editor.md) + [`../W9_EDITOR_ARCHITECTURE.md`](../W9_EDITOR_ARCHITECTURE.md)
   - Auth / paywall / export bug → [`04-auth.md`](./04-auth.md) + [`08-billing-paywall.md`](./08-billing-paywall.md) + [`../../CLAUDE.md`](../../CLAUDE.md) §"Auth + paywall + export flow"
   - Upload / conversion bug → [`05-uploads-conversions.md`](./05-uploads-conversions.md) + [`../../.claude/specs/2026-07-30-signout-edit-persistence.md`](../../.claude/specs/2026-07-30-signout-edit-persistence.md)
5. **Identify the invariant that regressed.** If a fix requires changing a documented invariant, ask the user first.
6. **Apply the fix at the root cause**, not a downstream patch.

## Full unwind (last resort)

Rollback target: `stable-2026-08-19` (commit `53892a5` — zoom + toolbar fixes). This is the last confirmed-clean editor state.

```bash
# Make a safety branch first — destructive operation
git branch backup/before-rollback-YYYYMMDD
git reset --hard stable-2026-08-19
```

Never run `git reset --hard` without a safety branch or a stash. Do not force-push to main. Ask the user before running any of the above.

## After a fix ships

1. **Walk the mobile pre-push checklist** — [`../../CLAUDE.md`](../../CLAUDE.md) §"Mobile pre-push checklist". 10 items, iOS Safari + Android Chrome.
2. **Update the relevant feature doc** if an invariant changed.
3. **Tag a new stable checkpoint** if the fix passed the checklist:
   ```bash
   git tag stable-YYYY-MM-DD
   git push origin stable-YYYY-MM-DD
   ```
4. **Add a session spec** at `.claude/specs/YYYY-MM-DD-<slug>.md` capturing the evidence trail (bug, root cause, fix, verification). Register in [`../../CLAUDE.md`](../../CLAUDE.md).
5. **Update memory** (`memory-snapshotter` skill) if a new preference / decision / root cause emerged.

## Anti-patterns to avoid

- **Layering fixes without root-cause diagnosis.** The default failure mode. Load `regression-forensics` first.
- **Bypassing the lock without user approval.** `.claude/LOCKED_PATHS` exists to force a pause; don't `CLAUDE_UNLOCK_PATHS=1` reflexively.
- **Skipping the mobile checklist.** Mobile is the #1 regression surface. Don't claim a change is ready without walking it.
- **`git reset --hard` without a safety branch.** Destructive.
- **Skipping hooks (`--no-verify`).** Investigate + fix the underlying issue.

## Related

- [`15-skills-regressions.md`](./15-skills-regressions.md) — skills + hooks + memory + specs
- [`16-locked-paths.md`](./16-locked-paths.md) — what's locked + how to unlock
- [`06-pdf-editor.md`](./06-pdf-editor.md) — editor invariants
- [`04-auth.md`](./04-auth.md) — auth chain
