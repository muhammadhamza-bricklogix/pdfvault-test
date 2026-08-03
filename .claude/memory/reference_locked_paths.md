---
name: reference-locked-paths
description: Project has a PreToolUse hook that mechanically blocks Edit/Write on paths in .claude/LOCKED_PATHS
metadata: 
  node_type: memory
  type: reference
  originSessionId: 23ed6fcc-822c-4375-bd4c-9007f18b2f88
---

PDFedits enforces its off-limits list mechanically. `.claude/settings.json` registers a `PreToolUse` hook (`.claude/hooks/check-locked-paths.cjs`) that blocks `Edit`, `Write`, `MultiEdit`, `NotebookEdit` against any path in `.claude/LOCKED_PATHS`. Read tools still work.

**How to apply:**
- If a tool is blocked with `BLOCKED by .claude/LOCKED_PATHS`, the file is intentionally locked. ASK the user before bypassing — do not unlock unprompted.
- Bypass for current session: user must run `export CLAUDE_UNLOCK_PATHS=1` in their shell and restart Claude Code.
- Permanent unlock: user removes/comments the matching line in `.claude/LOCKED_PATHS`.
- LOCKED_PATHS supports globs (`lib/foo/**`) and negation (`!lib/foo/README.md`).
- The CLAUDE.md "Off-limits" list and LOCKED_PATHS are the same set of files — keep them in sync if either is updated.
- Stable rollback tag: `stable-2026-06-22`. New checkpoints follow `stable-YYYY-MM-DD` after mobile checklist passes.

Created 2026-06-22 to stop regression-introducing edits to PDF editor load-bearing files. See [[skill-pdf-editor-architecture]] and [[project-mobile-priority]].
