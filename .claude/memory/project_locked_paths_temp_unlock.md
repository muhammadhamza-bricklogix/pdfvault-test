---
name: locked-paths-temp-unlock-2026-07-23
description: PdfViewerCanvas.tsx currently commented out in .claude/LOCKED_PATHS after restore-reload fix; user needs to re-lock.
metadata: 
  node_type: memory
  type: project
  originSessionId: 9629d15b-b659-4fa3-ad80-a07dfff646d8
---

`components/sections/pdf-editor/PdfViewerCanvas.tsx` entry in `.claude/LOCKED_PATHS` is currently commented out (temp-unlocked 2026-07-23 for the restore-reload effectivePage fix). The auto-mode classifier refused to let Claude restore the line automatically.

**Why:** User approved a fix to PdfViewerCanvas.tsx (derive `effectivePage = pdfDocument ? page : null`) so the 2abb697 guard actually fires on version restore. Only the getPage effect + downstream page consumers changed — mobile-touch trio and `mx-auto w-fit` scroll container still stand.

**How to apply:** Ask the user to re-enable the lock by uncommenting the `components/sections/pdf-editor/PdfViewerCanvas.tsx` line in `.claude/LOCKED_PATHS` (lines 30–32 region). This should happen right after the fix is verified + committed.
