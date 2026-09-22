---
name: problem-triage
description: MANDATORY load whenever the user reports ANY problem, bug, or unexpected behavior in this project — phrases like "X is broken", "X isn't working", "fix X", "why is X happening", "there's a bug in X", "X is acting weird", "investigate X", "diagnose X", "help me figure out X", "X stopped working", "check X", "look into X", or a bare paste of an error/screenshot/log. Also fires when the user describes symptoms without naming a fix (e.g. "GA isn't tracking US visitors", "Railway deploy is slow", "paywall dead-ends"). Enforces the analyze → propose → wait-for-approval → act loop so the user never has to re-explain the problem, and no Edit/Write fires until the user green-lights a specific fix. This is the default project workflow for turning a symptom into a shipped fix without wasted round-trips.
---

# Problem triage

This project's owner is a solo developer who is tired of re-prompting the same investigation. Every problem — GA broken, Railway sluggish, paywall glitching, mobile save failing — was previously handled by writing a fresh multi-paragraph prompt each time. The result: the same investigation ran 3+ times per week from scratch, the user paid tokens for context you already had, and half the time the fix skipped a load-bearing invariant.

Your job when this skill fires: **do the investigation first, hand the user a short diagnosis + a specific proposed fix, wait for explicit approval, then execute.** Never skip straight to Edit/Write.

## When this skill applies

Any user message that describes a problem to investigate — even one word like "broken" or a pasted screenshot with no text. Fires on:

- Direct asks: "fix X", "debug X", "why is Y", "investigate Z", "look into...", "check on..."
- Symptom reports: "Google Analytics isn't tracking US visitors", "the paywall dead-ends", "Railway restart loops", "sign-in bounces to sign-up"
- Bare error text or a screenshot with no other content
- Client-relayed problems: "my client says X is broken", "user reported Y"

If the message is a request for a NEW feature (not a fix), route to brainstorming instead. If it's a "push it" / "ship it" claim, route to `pre-push-guardian`. If it uses regression phrasing ("broken again", "worked yesterday", "same bug"), ALSO load `regression-forensics` — the two skills stack.

## The four phases — do not skip forward

### Phase 1 — Understand (before touching any tool)

Read the message. In one sentence, state what you understand the symptom to be, and one sentence on what you don't yet know. If you cannot state the symptom crisply, ask ONE clarifying question and stop. Do NOT investigate on a wrong premise — every minute of wrong-premise investigation is a minute the user has to correct.

Example good phase 1: *"Symptom: GA4 has no US visitor data. Unknown: whether GA4 property exists at all, or whether tags are gated by consent."*

### Phase 2 — Investigate (read-only)

Load applicable companion skills based on the surface:

| Surface hint | Load skills |
|---|---|
| PDF editor bug ("edit missing", "watermark broken", "mobile blank") | `pdf-editor-architecture` + often `pdf-composer-render-fix` |
| Sign-in / paywall / checkout / export | `auth-flow-guardian` |
| Analytics / GA / GTM / tracking / CookieYes | `analytics-check` |
| Railway / deploy / services / logs / metrics | `railway-triage` |
| "Broken again", "used to work", "regression" | `regression-forensics` |
| Push / PR / merge / ship claim | `pre-push-guardian` (not triage) |

Then investigate using **read-only tools only** — Grep, Read, Bash for read-only commands, Explore subagent for open-ended searches, WebFetch for docs. NO Edit, Write, MultiEdit, NotebookEdit in this phase.

If the search would be more than 3 greps, dispatch an `Explore` subagent. Keeps your context clean.

Also check:
- `.claude/LOCKED_PATHS` — is the suspect file locked? That's a signal it's load-bearing.
- CLAUDE.md — is there an existing invariant that covers the symptom?
- Existing session specs at `.claude/specs/` — has this exact problem been diagnosed before?
- Memory index at `.claude/memory/MEMORY.md` — any relevant feedback / project entries?

### Phase 3 — Propose (and wait)

Return a diagnosis in this exact shape. Keep it under ~200 words:

```
Symptom: <one line>

Root cause: <one line> (or "Ambiguous — top 2 candidates:")

Evidence:
  - <file:line + what it shows>
  - <observed behavior>
  - <any invariant or skill-log entry it violates>

Impact of NOT fixing: <one line>

Proposed fix: <describe the specific change — file, function, what changes>

Risk:
  - Invariants touched: <list from CLAUDE.md / LOCKED_PATHS / skill log>
  - Blast radius: <files affected, users affected>

Verification: <how you'll confirm the fix works — test, grep, manual step>

Alternatives (only if root cause is ambiguous): <1-2 other approaches with tradeoffs>

Need from user: green light to proceed, OR answers to <question>.
```

**Then STOP.** Do not call Edit, Write, MultiEdit, or NotebookEdit. Do not start the fix "to save time." Wait for the user to reply with "go", "yes", "do it", "proceed", or a modification.

If the user replies with anything other than approval — a question, a redirect, "wait", "not that" — treat it as new information and go back to Phase 2.

### Phase 4 — Execute (only after approval)

On explicit approval:

1. If the diff will touch >1 file OR the user is a paid customer of this repo, create a feature branch first: `git checkout -b fix/<slug>` (per `feedback_no_direct_push_to_main`).
2. Apply the change with Edit/Write.
3. Run the verification you promised in Phase 3.
4. Report: "changed X, verified Y, ready to push."
5. If the surface intersects the mobile checklist or auth chain, load `pre-push-guardian` before offering to push.

## Red flags — STOP and restart the phase

| Red flag | What it means |
|---|---|
| You're about to Edit/Write before returning the Phase 3 diagnosis | Skipped approval — go back |
| You have no file:line evidence | Investigation is thin — grep more before proposing |
| You skimmed CLAUDE.md instead of matching against the invariants | You may propose a fix that reverts a load-bearing rule |
| You're on Phase 4 and haven't seen an explicit "go" from the user | You mistook description-of-plan for approval |
| Proposal names >2 files to change without a listed reason for each | Scope creep — split into multiple fixes |
| You're about to say "quick fix" or "small change" | Those phrases correlate 1:1 with reverting an invariant |

## Common rationalizations (do not fall for these)

| Excuse | Reality |
|---|---|
| "The fix is obvious, I can skip the proposal" | Every "obvious" fix in this repo has burned a session at least once — see `regression-forensics` |
| "The user is tired, just do it" | The user is tired because prior sessions skipped Phase 3 and shipped bad fixes. Phase 3 IS the relief. |
| "I already looked at the code, no need to re-check LOCKED_PATHS" | LOCKED_PATHS changes weekly — check every time |
| "This is a one-liner, no branch needed" | User memory `feedback_no_direct_push_to_main` says branch always. One-liners still get a branch. |
| "The proposal is boilerplate, I can inline it in a normal message" | The proposal template is the forcing function. Skipping the shape = skipping the discipline. |

## What "approval" looks like

Explicit approval to proceed to Phase 4:
- "go", "yes", "do it", "proceed", "ship it", "apply it", "fix it", "make the change"
- A specific redirect that IS approval: "yes but do it on branch fix/ga-consent"

NOT approval:
- "sounds good, but what about X?" → question, back to Phase 2
- "hmm" → ambiguous, ask "shall I proceed with the proposed fix?"
- Silence for one message → NOT approval; do nothing
- "why?" → they want more evidence; provide it, do not fix

## Cross-references

- `regression-forensics` — always stack with this skill when the symptom is a regression
- `pre-push-guardian` — fires AFTER Phase 4 succeeds and user is ready to ship
- `analytics-check`, `railway-triage`, `auth-flow-guardian`, `pdf-editor-architecture` — surface-specific companions loaded in Phase 2
- `memory-snapshotter` — run after Phase 4 if the fix revealed a new invariant or preference worth persisting

## What NOT to do

- Do not open a plan mode / brainstorming skill for a bug fix. Those are for new work.
- Do not write a session spec at Phase 1 — specs are for closed / documented investigations. Write it at Phase 4 after the fix ships, if the investigation was non-trivial.
- Do not run `bun run build` in Phase 2 unless you have a specific reason. It burns 30+ seconds and is rarely diagnostic. Save it for Phase 4 verification.
