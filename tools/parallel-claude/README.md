# parallel-claude

A single-file Bash orchestrator for running several Claude Code sessions **in
parallel**, each isolated inside its own Git worktree + feature branch. Built
to let one developer fan out independent features across several concurrent
agents without them stepping on each other's files.

## Why

The common failure mode when you spawn multiple AI coding agents against one
repo is that they all edit the same file and race each other to commit. This
tool:

1. Forces you to declare — up front, in a JSON manifest — which files each
   feature is allowed to touch.
2. Fails loudly when two features claim the same path (unless you explicitly
   `--force` through it).
3. Creates one Git worktree per feature under `../worktrees/<repo>-<name>`
   so each agent has its own working directory + branch.
4. Drops a strict `claudecode.md` system-instruction file into every worktree
   that pins the agent's scope and bans destructive git operations.
5. Spawns each session in its own tmux window (or `nohup` background process
   when tmux isn't installed) and tracks liveness via pid-files / tmux session
   names.
6. Gives you a safe `verify → commit → push → remove` close-out flow that
   prompts before anything destructive.

## Install

```bash
# One repo (recommended during trial):
chmod +x tools/parallel-claude/parallel-claude
./tools/parallel-claude/parallel-claude help

# Or symlink into PATH:
ln -s "$(pwd)/tools/parallel-claude/parallel-claude" ~/.local/bin/parallel-claude
```

Required: `git`, `jq`, `claude` (the Claude Code CLI).
Optional: `tmux` (dramatically nicer UX; without it the script falls back to
`nohup` + log files).

## Quick start

```bash
# 1. Scaffold state + prompt template inside the current repo.
parallel-claude init

# 2. Declare features — either one at a time:
parallel-claude add \
  --name paywall-copy \
  --branch feature/paywall-copy-refresh \
  --files "components/sections/paywall/PaywallModal.tsx" \
  --desc "Rewrite paywall headline + CTA copy" \
  --prompt-file prompts/paywall-copy.md

# ...or in bulk from a JSON file (see tools/parallel-claude/example-plan.json):
parallel-claude plan tools/parallel-claude/example-plan.json

# 3. Confirm no two features claim the same file.
parallel-claude check

# 4. Start every declared feature in parallel. Each gets its own worktree,
#    its own branch, its own Claude session.
parallel-claude start

# 5. Watch them work.
parallel-claude status
parallel-claude attach paywall-copy       # tmux mode
parallel-claude logs   paywall-copy       # nohup mode

# 6. When a session is done, close it out safely.
parallel-claude verify paywall-copy       # runs the configured lint/test
parallel-claude commit paywall-copy       # stages + commits (or let 'finish' do it)
parallel-claude push   paywall-copy       # prompts first — never silent
parallel-claude finish paywall-copy       # verify → commit → push → remove (all prompted)

# Or tear a worktree down without pushing:
parallel-claude remove paywall-copy
```

## Layout it creates

```
<repo-root>/
  .parallel-claude/
    manifest.json           # declared features + defaults
    claudecode.md           # prompt template (editable)
    logs/<feature>.log      # nohup-mode logs
    pids/<feature>.pid      # nohup-mode pid files
    .gitignore              # keeps logs/ and pids/ out of commits
../worktrees/
  <repo>-<feature>/         # one per feature; disposable
    claudecode.md           # rendered per-feature prompt
    ...checkout of the branch...
```

## The `claudecode.md` prompt

`parallel-claude init` writes a template with hard rules the spawned agent
MUST follow:

- Stay in scope — only edit files declared in `## Allowed files`.
- No `git push`, no remote operations (the orchestrator does that).
- No destructive git ops (`reset --hard`, `rebase`, branch deletes).
- No dependency drift unless the task explicitly asks.
- Run the project's lint + typecheck locally before claiming done.
- Keep secrets out of commits.
- Minimal churn; no speculative refactors.

Edit `.parallel-claude/claudecode.md` to match your repo's conventions. The
template substitutes `__BRANCH__`, `__BASE_BRANCH__`, `__DESCRIPTION__`,
`__FILES_BLOCK__`, `__TEST_COMMAND__`, `__PROMPT__` per feature at `start`
time.

## Flags

- `--yes` / `-y` — skip Y/N prompts (destructive ops still gated by `--force`).
- `--force` / `-f` — continue despite file overlap; discard dirty worktree on
  `remove`.

## Safety model

The orchestrator refuses to do anything irreversible without an explicit
confirmation:

| Action                              | Default behaviour                                |
| ----------------------------------- | ------------------------------------------------ |
| File overlap between features       | **aborts** — pass `--force` to override          |
| `push`                              | **prompts** every time                            |
| `remove` with uncommitted changes   | **prompts** — pass `--force` to discard          |
| `remove` while session is running   | **aborts** — pass `--force` to kill + tear down  |
| Local branch delete on `remove`     | **prompts** separately                           |
| Agent attempting its own `git push` | banned by the `claudecode.md` prompt             |

## Troubleshooting

- **`not inside a git repository`** — `cd` to the repo root first.
- **`missing required binary: jq`** — `brew install jq` / `apt install jq`.
- **tmux not installed** — the script will still work via `nohup`; `attach`
  won't be available, but `logs <name>` tails the log file. Install tmux
  (`brew install tmux`) for the nicer UX.
- **Session won't start** — check `.parallel-claude/logs/<name>.log` (nohup
  mode) or `tmux ls` (tmux mode). The most common cause is `claude` not being
  on `$PATH` in a non-login shell.
- **Features legitimately need to share a file** — split the feature so each
  owns a disjoint subset of lines, land one first, or rebase the second on top
  of the first. If you absolutely must run them concurrently, `--force` lets
  you through — but expect merge conflicts.

## Design notes

- Everything the orchestrator writes lives under `.parallel-claude/`. Deleting
  that folder (plus the worktree dirs) returns the repo to a clean state.
- The script never calls out to the network until you explicitly run `push`.
- Each worktree is self-contained — `cd` into it, run `bun install` if the
  feature depends on packages not already in `node_modules`, and iterate
  manually if the agent needs a hand.
- The manifest is plain JSON; feel free to edit it by hand (e.g. to tweak a
  prompt mid-flight — re-run `start <name>` to re-render the worktree's
  `claudecode.md`).
