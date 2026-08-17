---
name: reference-repocards
description: Pre-computed repo context at .repocards/ — read AGENT_GUIDE.md before grepping source
metadata: 
  node_type: memory
  type: reference
  originSessionId: 23ed6fcc-822c-4375-bd4c-9007f18b2f88
---

Repo has pre-computed context cards at `.repocards/`. Entry point: `.repocards/AGENT_GUIDE.md`.

**How to apply:** At the start of any task about this project (or when user asks health-check questions like "are you reading repocards?"), open `.repocards/AGENT_GUIDE.md` BEFORE running Grep/Glob/Read on `app/`, `lib/`, `components/`. Routes to pre-computed cards (architecture, entrypoints, api-surface). Typical card read is 10–50× fewer tokens than a grep pass. Re-run `npx repocards index` after meaningful code changes to keep cards fresh.
