#!/usr/bin/env node

// PreCompact / SessionEnd hook: injects a reminder for Claude to invoke the
// `memory-snapshotter` skill before context is compressed or the session ends.
//
// This guards the solo-dev workflow — losing conversation context without a
// snapshot means re-explaining project state, off-limits rules, and recent
// decisions in the next session.
//
// Exit codes:
//   0  → success; stdout is injected into Claude's context as an additional
//        system message (per Claude Code hook spec for PreCompact / SessionEnd)
//   1  → non-blocking failure; stderr is logged but session continues

try {
  const payload = require("fs").readFileSync(0, "utf8");
  const parsed = payload ? JSON.parse(payload) : {};
  const trigger = parsed?.hook_event_name || "unknown";

  const reminder = [
    `<memory-snapshot-reminder trigger="${trigger}">`,
    ``,
    `Context is about to be ${trigger === "PreCompact" ? "compressed" : "closed"}.`,
    `Before that happens, invoke the memory-snapshotter skill:`,
    ``,
    `    Skill({ skill: "memory-snapshotter" })`,
    ``,
    `Extract any new user preferences, project state changes, feedback, or`,
    `non-obvious decisions from this conversation into the memory system at`,
    `~/.claude/projects/-Users-<username>-pdf-viewer-app/memory/ (resolve $HOME).`,
    `so they survive into the next session.`,
    ``,
    `If nothing in this conversation is worth persisting, say so plainly.`,
    `Don't invent filler — but don't skip the check either.`,
    `</memory-snapshot-reminder>`,
  ].join("\n");

  process.stdout.write(reminder);
  process.exit(0);
} catch (err) {
  process.stderr.write(`remind-memory-snapshot: ${err.message}\n`);
  process.exit(1);
}
