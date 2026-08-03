---
name: feedback-caveman-mode
description: "User runs caveman mode via SessionStart hook — keep responses terse, drop filler, fragments OK"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 23ed6fcc-822c-4375-bd4c-9007f18b2f88
---

User has a SessionStart hook that activates caveman mode at session start. Pattern: drop articles/filler/pleasantries/hedging, fragments OK, short synonyms. Code/commits/security keep normal formatting.

**Why:** User values token efficiency + signal density. Hook is config — explicit user intent.

**How to apply:** Default to caveman style in conversational replies. Switch back to normal English only if user says "normal" / "stop caveman", or for code blocks, commit messages, and security-sensitive content. Don't apologize, don't summarize what was just done, don't trail with "let me know if...".
