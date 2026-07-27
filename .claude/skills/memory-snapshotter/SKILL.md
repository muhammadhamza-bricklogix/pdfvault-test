---
name: memory-snapshotter
description: Use to persist context from the current conversation into `/Users/softaims/.claude/projects/-Users-softaims-pdf-viewer-app/memory/` so it survives context compression, session end, and future conversations. Trigger explicitly whenever the user says "save memory", "update memory", "remember this", "snapshot context", "before we lose it", "context is filling up", or "wrap up the session". Trigger automatically at these moments even without being asked — (a) when a PreCompact reminder appears, (b) when the user closes out a multi-step task with any new preference / decision / feedback / project status change, (c) after a bug is diagnosed and root-caused (the WHY is worth keeping even if the fix isn't). This is the primary defense against context loss for a solo vibe-coder who cannot afford to re-explain the project every session — treat it as load-bearing, not optional. Skip only if the entire conversation was trivial lookups with no new user preferences, no new project state, and no non-obvious decisions.
---

# Memory snapshotter

The user is a solo developer (Uzair) who works with Claude across many short sessions. Losing context between sessions — or across a mid-session compaction — means re-explaining the same off-limits rules, mobile invariants, and business decisions every time. This skill is the ritual that keeps that from happening.

Your job: scan the current conversation for anything that a future Claude session would need to know, and write it into the memory system per the auto-memory format from the system prompt.

## The memory system (quick reference)

- Root: `/Users/softaims/.claude/projects/-Users-softaims-pdf-viewer-app/memory/`
- Index: `MEMORY.md` (keep entries ≤150 chars each, one line per memory)
- Types: `user`, `feedback`, `project`, `reference` (see system prompt for full spec)
- Filename convention: `{type}_{topic}.md` in kebab-case (e.g. `feedback_no_amend.md`)

## When to invoke

**Manual triggers** — the user says one of the phrases in the description.

**Automatic triggers** — even without being asked:

1. **PreCompact reminder fires** (system-reminder mentions context compression coming). Snapshot BEFORE the compaction eats the conversation.
2. **User expresses a new preference or correction.** ("Don't do X." "Always run Y first." "Yeah, that approach was right.") — save immediately as `feedback`.
3. **A project fact changes.** New branch focus, new deadline, decision to deprecate something, a stakeholder ask. Save as `project`.
4. **A bug's root cause is identified.** Even if the fix lands in git, the WHY (which surprising behavior, which library version, which browser quirk) is often invisible from `git log`. Save as `project` or extend a relevant `feedback` memory.
5. **The user references an external system** (Linear project, Grafana board, Slack channel, Notion page) that's not already in `reference_*`. Save as `reference`.

## Procedure

### 1. Read the current index

Open `MEMORY.md` first. This tells you what already exists — you'll update in place rather than duplicate.

### 2. Scan the conversation

Walk the current conversation and extract candidate memories. For each candidate, ask:

- Is this in `git log`, code, or existing docs already? → **skip** (per the system prompt's "What NOT to save").
- Is this specific to the current task and won't matter next session? → **skip** (use tasks or plans instead).
- Would a Claude that starts fresh next week be worse off without it? → **save**.

Watch for **quiet confirmations** too. If the user accepted a non-obvious approach without pushback ("yes exactly", "keep going", "that's the right call"), save it as feedback — one-sided memories of only corrections drift into over-caution.

### 3. Classify + write

For each surviving candidate, pick the right type and write one file:

```markdown
---
name: {kebab-case-slug}
description: {one-line summary — future Claude uses this to decide relevance}
metadata:
  type: {user|feedback|project|reference}
---

{body}
```

Body structure:
- **user, reference**: prose is fine.
- **feedback, project**: lead with the rule/fact, then a `**Why:**` line (the reason, ideally citing the incident) and a `**How to apply:**` line (when this triggers). The *why* is what lets future Claude judge edge cases instead of blindly rule-following.

Link related memories with `[[other-slug]]` — the slug is the other memory's `name:` field. Broken links are fine; they mark future work.

### 4. Update `MEMORY.md`

Append one line per new memory in this format:

```
- [Short title](file.md) — one-line hook (<150 chars)
```

Keep the index chronological? **No — semantic.** Group by topic; a solo dev scanning the index wants "all mobile stuff together" more than "what did I add last Tuesday".

If a new memory supersedes an old one, DELETE the old file and update the index line — don't leave stale entries behind.

### 5. Also update dates when relevant

If the user mentioned a relative date ("Thursday", "next week"), convert to absolute (`2026-08-06`) before saving. Today's date is in the system prompt (`# currentDate`).

### 6. Report

Give the user a compact summary:

```
Memory snapshot — <n> new, <m> updated, <k> removed

New:
  - feedback_no_amend.md — never amend commits after push
  - project_docversions_2fa.md — 2FA sign-in path is verify email code, not TOTP

Updated:
  - project_current_work.md — branch changed from feat/doc_versions to feat/2fa-flow

Removed:
  - project_locked_paths_temp_unlock.md — user re-locked PdfViewerCanvas 2026-07-27
```

If nothing was worth saving, say so plainly: "No new memories worth persisting from this conversation." Don't invent filler.

## Anti-patterns (do not do these)

- **Do NOT save what code already tells you.** File paths, architecture, patterns, conventions. Those are derivable — memory is for what isn't.
- **Do NOT save the conversation itself.** Memory ≠ transcript. Extract the invariants, drop the narrative.
- **Do NOT save ephemeral state.** "Currently debugging X" — that's what tasks are for, not memory.
- **Do NOT create a new memory when an existing one covers it.** Update in place. Duplicates rot into contradictions.
- **Do NOT overload `MEMORY.md`.** It's an index. If a line is >150 chars or spans two lines, condense it — the body goes in the file, not the index.
- **Do NOT save without a `**Why:**` line on feedback/project memories.** Future Claude needs the reason to judge edge cases.

## Special case — mid-session PreCompact

If invoked because the harness signaled an upcoming context compaction:

1. Snapshot with **higher recall** — err on the side of saving, since anything not saved is genuinely about to disappear.
2. Include a `project_current_work.md` update with **the state of the in-flight task**: which files edited, which tests passing, what's next. This lets the post-compaction Claude pick up cleanly.
3. Report to the user before the compaction lands.
