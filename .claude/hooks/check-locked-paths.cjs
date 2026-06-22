#!/usr/bin/env node
 
// PreToolUse hook: blocks Edit / Write / MultiEdit / NotebookEdit on paths
// listed in .claude/LOCKED_PATHS.
//
// Exit codes:
//   0  → allow
//   2  → block; stderr is shown to Claude as a tool error
//
// Bypass for one session: export CLAUDE_UNLOCK_PATHS=1

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const LOCKED_FILE = path.join(REPO_ROOT, ".claude", "LOCKED_PATHS");

function readStdinSync() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function globToRegex(glob) {
  // Convert glob → regex. Supports **, *, ?, and literal segments.
  let re = "";
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        re += ".*";
        i += 2;
        if (glob[i] === "/") i++;
      } else {
        re += "[^/]*";
        i++;
      }
    } else if (c === "?") {
      re += "[^/]";
      i++;
    } else if (/[.+^${}()|[\]\\]/.test(c)) {
      re += "\\" + c;
      i++;
    } else {
      re += c;
      i++;
    }
  }
  return new RegExp("^" + re + "$");
}

function loadRules() {
  if (!fs.existsSync(LOCKED_FILE)) return { lock: [], allow: [] };
  const lock = [];
  const allow = [];
  const lines = fs.readFileSync(LOCKED_FILE, "utf8").split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("!")) allow.push(globToRegex(line.slice(1)));
    else lock.push({ glob: line, re: globToRegex(line) });
  }
  return { lock, allow };
}

function isLocked(relPath, rules) {
  for (const re of rules.allow) if (re.test(relPath)) return null;
  for (const r of rules.lock) if (r.re.test(relPath)) return r.glob;
  return null;
}

function main() {
  if (process.env.CLAUDE_UNLOCK_PATHS === "1") process.exit(0);

  let payload;
  try {
    payload = JSON.parse(readStdinSync() || "{}");
  } catch {
    process.exit(0); // malformed input → don't block
  }

  const filePath = payload?.tool_input?.file_path;
  const toolName = payload?.tool_name || "";
  if (!filePath) process.exit(0);

  // Only enforce for write-style tools
  if (!/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(toolName)) process.exit(0);

  const abs = path.isAbsolute(filePath) ? filePath : path.join(REPO_ROOT, filePath);
  const rel = path.relative(REPO_ROOT, abs);
  if (rel.startsWith("..")) process.exit(0); // outside repo → not our business

  const rules = loadRules();
  const match = isLocked(rel, rules);
  if (!match) process.exit(0);

  process.stderr.write(
    [
      `BLOCKED by .claude/LOCKED_PATHS — "${rel}" matches "${match}".`,
      ``,
      `This file is locked because it contains load-bearing fixes the user has`,
      `explicitly flagged as off-limits. See CLAUDE.md "Off-limits" section and`,
      `.claude/skills/pdf-editor-architecture/SKILL.md decisions log.`,
      ``,
      `To proceed: ASK THE USER for explicit approval, then either`,
      `  (a) have them remove/comment the matching line in .claude/LOCKED_PATHS, or`,
      `  (b) have them run \`export CLAUDE_UNLOCK_PATHS=1\` for this session.`,
    ].join("\n"),
  );
  process.exit(2);
}

main();
