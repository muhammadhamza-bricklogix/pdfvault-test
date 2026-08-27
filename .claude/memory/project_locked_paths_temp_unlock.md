---
name: locked-paths-permanent-unlock-2026-08-27
description: PdfViewerCanvas.tsx and merge-pdf.ts unlocked permanently in .claude/LOCKED_PATHS; invariants still hold, verify before changing.
metadata:
  node_type: memory
  type: project
---

`components/sections/pdf-editor/PdfViewerCanvas.tsx` and `lib/client/pdf-editor/merge-pdf.ts` are permanently unlocked in `.claude/LOCKED_PATHS` as of 2026-08-27. Previously PdfViewerCanvas.tsx was TEMP unlocked 2026-07-23 for the restore-reload effectivePage fix; user made both unlocks permanent while refreshing project docs.

**Why:** The mechanical block was getting in the way of the recurring fix cadence on these two files (mobile touch, scroll container, path/coord fixes, hasGenuineEdits). The invariants themselves are still load-bearing — the enforcement moved from the lock hook into CLAUDE.md's "Load-bearing invariants (verify before changing)" list.

**How to apply:** Do NOT re-lock these two paths without asking. When editing either file, read the CLAUDE.md "Load-bearing invariants" list first — same rules apply, just verify instead of unlock. Skill log entries the invariants trace back to: 2026-06-10 (e) mobile touch + scroll container, 2026-06-15 (c) hasGenuineEdits, 2026-08-19 fit-to-width cap.
