---
name: feedback-off-limits-revisable
description: "User revises \"off-limits\" architectural decisions when they cause real user-reported UX friction — surface the conflict, propose the change, then apply"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 97a1c888-d2ae-4bf7-a4c9-37946d0b865b
---

When the user reports a bug whose fix conflicts with an item in the editor skill's "Off-limits" list (or a documented prior decision like a skill-log entry), do NOT just refuse and cite the rule. Surface the conflict — explain which off-limits item the fix would touch and why the original decision exists — then propose the fix and apply it when the user confirms (or has already implied confirmation in the bug report).

**Why:** On 2026-06-22 the user asked me to make the Select tool work on text immediately on PDF load. The fix required reversing the 2026-06-14 (b) decision that gated text extraction behind the "Edit Text" toolbar tool (a decision the user had explicitly requested "for both mobile and web"). I flagged the conflict in the response, applied the fix, and they accepted — confirming the prior decision was no longer their preference. The "off-limits" list and skill-log decisions are snapshots of preferences at a point in time, not permanent constraints. When the user reports the prior decision is hurting them, they want it revisited.

**How to apply:**
1. When reading a bug report, if the obvious fix conflicts with a CLAUDE.md off-limits item or a skill-log decision, do NOT silently refuse. Apply the fix path mentally and notice the conflict.
2. In the response, name the specific item being touched and the date / reasoning of the original decision (so the user can re-evaluate with context).
3. Apply the fix unless the user redirects — "make the reasonable call and continue" still applies here. They'll say "stop" if they want the old design back.
4. After applying, append a dated entry to the skill log explaining the reversal so future sessions don't re-apply the old design.

[[project-current-work]]
