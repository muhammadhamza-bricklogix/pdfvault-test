---
name: project-mobile-priority
description: Mobile (iOS Safari + Android Chrome) is the
metadata: 
  node_type: memory
  type: project
  originSessionId: 23ed6fcc-822c-4375-bd4c-9007f18b2f88
---

Mobile is the highest-risk surface in PDFedits. Same code can render fine on desktop and break entirely on a phone (Fabric overlay, pdf.js fonts, touch-action, DPR, op-list shape all differ).

**Why:** User has been repeatedly burned by mobile-only regressions in the PDF editor — pdf.js `getTextContent` throwing on older iOS Safari WebKit, pinch-zoom blanking pages, touch tools needing two taps, etc. CLAUDE.md has a 10-point mobile pre-push checklist that is REQUIRED before claiming a PDF editor change is ready.

**How to apply:** Before reporting any pdf-editor change as done, walk the mobile checklist in CLAUDE.md ("Mobile pre-push checklist"). If you can only test in DevTools responsive mode (not a real device), say so explicitly. Never claim mobile is verified when only desktop was tested. Load [[skill-pdf-editor-architecture]] before editing the editor.
