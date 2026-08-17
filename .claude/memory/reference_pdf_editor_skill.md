---
name: skill-pdf-editor-architecture
description: Load pdf-editor-architecture skill before touching any code in the PDF editor folders
metadata: 
  node_type: memory
  type: reference
  originSessionId: 23ed6fcc-822c-4375-bd4c-9007f18b2f88
---

Project skill `pdf-editor-architecture` at `.claude/skills/pdf-editor-architecture/SKILL.md` documents the load → render → edit → save pipeline, load-bearing invariants, off-limits code, and the verification recipe.

**How to apply:** Before editing anything under `lib/client/pdf-editor/**`, `lib/client/hooks/pdf-editor/**`, or `components/sections/pdf-editor/**`, invoke `Skill({ skill: "pdf-editor-architecture" })`. The "Known issues / decisions log" at the bottom (newest first) records why each off-limits rule exists — always check before refactoring. Several recent fixes are load-bearing — reverting re-introduces user-visible regressions. See also [[project-mobile-priority]].
