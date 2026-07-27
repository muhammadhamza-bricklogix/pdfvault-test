---
name: regression-forensics
description: MANDATORY load before proposing ANY fix when the user reports a regression — phrases like "this broke again", "worked yesterday", "this used to work", "regression", "you broke X", "why did this stop working", "the fix keeps reverting", "same bug again", "I already fixed this", or any bug report referring to a previously-fixed feature. This app carries a long list of load-bearing fixes (mobile touch-action trio, watermark hasGenuineEdits guard, auth chain 21 invariants, iOS Safari cookie commit via window.location.assign, pdf.js polyfills, etc.). The default failure mode is: fix a new bug by unknowingly reverting one of these — user reports the OLD bug back next session, we re-fix, revert something else. This skill breaks the loop by forcing a git-log + skill-log + LOCKED_PATHS + memory review BEFORE any fix is proposed, so the true root cause (which prior fix regressed?) is found instead of layering a new patch on top. Do not skip; a wrong fix here costs multiple sessions of unravel-and-refix.
---

# Regression forensics

Solo vibe-coder workflow: user reports a bug, Claude proposes a fix, user accepts, ships. A week later, the ORIGINAL bug is back — because the "fix" reverted a load-bearing invariant. This has happened repeatedly in this project (mobile touch-action, watermark text preservation, auth redirect loops, iOS Safari cookie bounces). The pattern is not "Claude is careless"; it's "Claude proposed a fix without checking whether the current code was already the fix for a previous bug".

Your job: when a regression is reported, spend the first five minutes reconstructing what USED to work and WHY it stopped, before writing any code. Almost every regression in this repo is a re-broken invariant, not a genuinely new bug.

## When this skill fires

Any user message that includes phrasing about a bug returning, a fix reverting, or a previously-working feature being broken. Also fires on:
- "The X page is blank on mobile again"
- "Sign in loops back to sign-up now"
- "Watermark PDF lost its selectable text"
- "Save doesn't upload the live edits"
- "Duplicate uploads are back"
- "Pinch zoom broke text again"

If the report is a genuinely new bug on a genuinely new feature (branch was created today, feature didn't exist last week), you can note that and skip to normal debugging. But err on the side of investigating — 30 seconds of `git log -S` beats a wrong fix.

## Procedure

### 1. Identify the surface

Which user-visible behavior is broken? Which files most likely drive it? Don't guess — say what you're inferring.

### 2. Check LOCKED_PATHS first

```bash
cat .claude/LOCKED_PATHS
```

If any of the suspect files are locked, that's your first strong signal: the code there is deliberately load-bearing. Whatever change caused the regression may have been made under a `CLAUDE_UNLOCK_PATHS=1` bypass or before the lock was added. Read the reason (the LOCKED_PATHS comments cite CLAUDE.md and the skill log).

### 3. Read the relevant skill log

Load `.claude/skills/pdf-editor-architecture/SKILL.md` and read the "Known issues / decisions log" from the top down. Every load-bearing fix in the editor is documented there with the date, the failure mode, and the code change. Match the current regression against the log:

- Is the current symptom identical to one already in the log? → the fix documented there is your invariant; a recent change probably reverted it.
- Is it adjacent (e.g. new failure mode on the same surface)? → the log will tell you which recent fixes constrain your solution space.

For non-editor regressions (auth, paywall, upload), read the "Auth + paywall + export flow" section in CLAUDE.md — all 21 items.

### 4. Read memory

Check `/Users/softaims/.claude/projects/-Users-softaims-pdf-viewer-app/memory/` for any `project_*` or `feedback_*` entries mentioning the surface. The user's `feedback_off_limits_revisable` memory is especially relevant — off-limits calls get revised when the trade-off changes.

### 5. Run `git log -S` for the invariant

Pick the load-bearing snippet from the skill log (e.g. `allowTouchScrolling`, `hasGenuineEdits`, `window.location.assign`, `suppressText`) and search commit history:

```bash
git log --oneline -S 'allowTouchScrolling' -- lib/client/hooks/pdf-editor/use-fabric-canvas.ts
git log --oneline -S 'hasGenuineEdits' -- lib/client/pdf-editor/merge-pdf.ts
git log --oneline -S 'window.location.assign'
```

`-S` shows commits where the string count changed — this surfaces the ADD (the original fix) and any subsequent REMOVE (the accidental revert). If the string is currently absent but shows up in an older commit, that's your smoking gun.

### 6. Read the current state of the file

Only after steps 1–5, open the actual file and compare against the invariant. If it's been altered, you have three questions before touching code:

1. **When did it change?** `git log -p <file>` between the last-known-good tag (`stable-2026-06-22` is the current one) and HEAD.
2. **Why did it change?** Read the commit message and any linked PR.
3. **Was that change made without loading the relevant skill?** If yes, the revert is unintentional; the fix is to restore the invariant. If it was intentional (user approved), the current bug means the intent was wrong — surface it, get user input.

### 7. Propose the fix with the forensics baked in

Give the user a summary in this shape:

```
Regression forensics — <symptom>

Suspect surface: <files>

Skill-log match: <YES: reference the log entry> | <NO: novel bug>

Load-bearing invariant: <the code that's supposed to be there>
  Documented at: <CLAUDE.md line> / <skill log date>
  Original fix commit: <hash + message>
  Reverted at: <hash + message> | <still present, so not the cause>

Root cause: <what actually broke>

Proposed fix: <restore invariant | genuine new fix>
  Impact on other invariants: <checked N items in auth chain / mobile checklist, no conflicts>
```

If the root cause is a reverted invariant, the fix is `git show <revert-hash>` in reverse — restore the code. Don't rewrite it from scratch; use the exact prior version. Verify the invariant is again present with the same grep you used in Step 5.

### 8. Trigger the safety net

After the fix:
- Invoke `pre-push-guardian` before pushing — the mobile checklist catches the class of regression you're fixing.
- Invoke `memory-snapshotter` to record what got reverted and when, so this doesn't happen a third time. Ideally add or update a `feedback_*` memory that names the specific code the next Claude session must preserve.
- If the reverted invariant wasn't already in `.claude/LOCKED_PATHS`, propose adding it. This is the mechanical guard against a repeat.

## Anti-patterns

- **Do NOT propose a "cleaner" version.** If an invariant looks weird (`objectCaching: false`, `mx-auto w-fit` instead of flex, three synced touch-action flags), it looks weird because it's fighting a specific bug. Restore the exact prior form.
- **Do NOT add a layer on top.** If sign-in is looping, don't add a new state check — find the missing `authLoaded` guard that used to be there.
- **Do NOT test only the reported symptom.** The regression report describes the symptom, but the invariant may protect against multiple symptoms. Walk the relevant checklist (mobile or auth chain).
- **Do NOT skip step 5.** `git log -S` on the invariant string is the single highest-leverage command in this workflow. It reduces "where did this go" from an hour of reading to a single line of output.
