#!/usr/bin/env bash
# Pre-commit guard: blocks commits that touch locked paths.
# Reads .claude/LOCKED_PATHS (same format as the Claude hook).
# Bypass: CLAUDE_UNLOCK_PATHS=1

set -euo pipefail

if [ "${CLAUDE_UNLOCK_PATHS:-}" = "1" ]; then
  exit 0
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
LOCKED_FILE="$REPO_ROOT/.claude/LOCKED_PATHS"

if [ ! -f "$LOCKED_FILE" ]; then
  exit 0
fi

# Read staged files (cached diff)
staged_files=$(git diff --cached --name-only 2>/dev/null || true)

if [ -z "$staged_files" ]; then
  exit 0
fi

# Read locked patterns, skip comments and blank lines
while IFS= read -r pattern; do
  [[ "$pattern" =~ ^#.*$ ]] && continue
  [[ -z "$pattern" ]] && continue
  # Skip negation lines (allowlists handled separately if needed)
  [[ "$pattern" =~ ^! ]] && continue

  # Convert glob to a basic grep-compatible pattern
  # Replace ** with .* and * with [^/]* for simple matching
  regex="$(echo "$pattern" | sed 's|\*\*|__DOUBLESTAR__|g; s|\*|[^/]*|g; s|__DOUBLESTAR__|.*|g')"

  while IFS= read -r file; do
    if echo "$file" | grep -qE "^$regex$"; then
      echo "ERROR: Staged file '$file' matches locked path '$pattern'." >&2
      echo "       See .claude/LOCKED_PATHS. Get explicit approval before editing." >&2
      echo "       To bypass for one session: export CLAUDE_UNLOCK_PATHS=1" >&2
      exit 1
    fi
  done <<< "$staged_files"
done < "$LOCKED_FILE"

exit 0
