# E2E test report

_Generated 2026-06-22T14:03:58.990Z_

## Summary

- ✅ **52 passed**, ❌ **1 failed**, 🟡 0 flaky, ⏭ 7 skipped
- ⏱ Total duration: 108.0s

## Failures (fix these first)

### 1. ❌ pdf-editor/edit-text-export.spec.ts › PDF editor — Edit Text › Rotated page edge case › modified source text survives PDF export on rotated pages

- Status: `failed`
- Duration: 6.84s
- Error:

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 1000
Received:   873

  264 |       const stats = fs.statSync(downloadPath);
  265 |
> 266 |       expect(stats.size).toBeGreaterThan(1_000);
      |                          ^
  267 |
  268 |       const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  269 |       const data = new Uint8Array(fs.readFileSync(downloadPath));
    at /Users/softaims/pdf-viewer-app/tests/pdf-editor/edit-text-export.spec.ts:266:26
```

## Passing tests

- ✅ conversion/tools-modal.spec.ts › Conversion — Tools modal in editor › opens from the editor top bar  _(9.21s)_
- ✅ pdf-editor/controls.spec.ts › PDF editor — top-bar controls › Redo button is disabled when there is nothing to redo  _(8.47s)_
- ✅ pdf-editor/controls.spec.ts › PDF editor — top-bar controls › zoom-in changes the zoom percentage  _(6.44s)_
- ✅ pdf-editor/controls.spec.ts › PDF editor — top-bar controls › next-page button advances the page indicator  _(7.61s)_
- ✅ pdf-editor/edge-cases.spec.ts › PDF editor — edge cases › ?id= with empty value redirects out of the editor  _(7.23s)_
- ✅ pdf-editor/edge-cases.spec.ts › PDF editor — edge cases › ?id= with a bogus value redirects to sign-in (signed-out)  _(7.22s)_
- ✅ pdf-editor/edge-cases.spec.ts › PDF editor — edge cases › Local-mode editor opens without an id  _(1.92s)_
- ✅ pdf-editor/edge-cases.spec.ts › PDF editor — edge cases › Keyboard: Escape and Delete don't crash on empty editor  _(2.40s)_
- ✅ pdf-editor/edge-cases.spec.ts › PDF editor — edge cases › Cmd+Z / Cmd+Shift+Z don't crash on empty editor  _(2.93s)_
- ✅ pdf-editor/edge-cases.spec.ts › PDF editor — edge cases › Cmd+F opens Find & Replace once a PDF is loaded  _(3.17s)_
- ✅ pdf-editor/edge-cases.spec.ts › PDF editor — edge cases › Uploading non-PDF + non-supported file is rejected  _(4.46s)_
- ✅ pdf-editor/edge-cases.spec.ts › PDF editor — edge cases › Tool switch doesn't crash the editor  _(4.89s)_
- ✅ pdf-editor/edit-text-export.spec.ts › PDF editor — Edit Text › Sample PDF (upright pages) › modified source text survives PDF export  _(6.03s)_
- ✅ pdf-editor/edit-text-export.spec.ts › PDF editor — Edit Text › Sample PDF (upright pages) › save uploads merged PDF + editorState with edited text  _(7.05s)_
- ✅ pdf-editor/hamburger.spec.ts › PDF editor — hamburger menu › opens "/^create new$/i" without runtime errors  _(8.82s)_
- ✅ pdf-editor/hamburger.spec.ts › PDF editor — hamburger menu › opens "/^compress pdf$/i" without runtime errors  _(6.11s)_
- ✅ pdf-editor/hamburger.spec.ts › PDF editor — hamburger menu › opens "/^password protect$/i" without runtime errors  _(7.81s)_
- ✅ pdf-editor/hamburger.spec.ts › PDF editor — hamburger menu › opens "/^find.*replace/i" without runtime errors  _(4.36s)_
- ✅ pdf-editor/hamburger.spec.ts › PDF editor — hamburger menu › opens "/^add page numbers$/i" without runtime errors  _(5.28s)_
- ✅ pdf-editor/hamburger.spec.ts › PDF editor — hamburger menu › opens "/^split pdf$/i" without runtime errors  _(7.94s)_
- ✅ pdf-editor/hamburger.spec.ts › PDF editor — hamburger menu › opens "/^annotations$/i" without runtime errors  _(5.40s)_
- ✅ pdf-editor/hamburger.spec.ts › PDF editor — hamburger menu › Flatten form fields fires a mutation (or fails open)  _(14.28s)_
- ✅ pdf-editor/hamburger.spec.ts › PDF editor — hamburger menu › My PDFs item is gated when signed out  _(10.45s)_
- ✅ pdf-editor/manage-pages.spec.ts › PDF editor — Manage Pages › modal opens without runtime errors  _(9.82s)_
- ✅ pdf-editor/offline.spec.ts › Offline — banner + IDB schema › OfflineBanner is absent while online  _(11.88s)_
- ✅ pdf-editor/offline.spec.ts › Offline — banner + IDB schema › OfflineBanner appears when the context goes offline  _(8.70s)_
- ✅ pdf-editor/offline.spec.ts › Offline — banner + IDB schema › Banner mounts on auth routes too (proves global mount)  _(8.00s)_
- ✅ pdf-editor/offline.spec.ts › Offline — banner + IDB schema › IDB schema works in this Chrome (open + put + get)  _(8.23s)_
- ✅ pdf-editor/offline.spec.ts › Offline — banner + IDB schema › Account-switch invalidation drops the prior user's DB  _(9.36s)_
- ✅ pdf-editor/save-export.spec.ts › PDF editor — Save dropdown › Save button + Export options dropdown are present  _(9.89s)_
- ✅ pdf-editor/save-export.spec.ts › PDF editor — Save dropdown › Export menu lists all 8 formats  _(9.04s)_
- ✅ pdf-editor/split-pdf.spec.ts › PDF editor — Split PDF (in-editor) › opens with page count + filename header  _(10.63s)_
- ✅ pdf-editor/split-pdf.spec.ts › PDF editor — Split PDF (in-editor) › Custom ranges: valid input enables Split button + lists outputs  _(12.61s)_
- ✅ pdf-editor/split-pdf.spec.ts › PDF editor — Split PDF (in-editor) › Custom ranges: out-of-bounds shows inline error + keeps button disabled  _(7.94s)_
- ✅ pdf-editor/split-pdf.spec.ts › PDF editor — Split PDF (in-editor) › Custom ranges: malformed token shows readable error  _(6.80s)_
- ✅ pdf-editor/split-pdf.spec.ts › PDF editor — Split PDF (in-editor) › Custom ranges: reverse range (3-1) flagged  _(6.41s)_
- ✅ pdf-editor/split-pdf.spec.ts › PDF editor — Split PDF (in-editor) › Every N pages: switching modes resets validation  _(6.32s)_
- ✅ pdf-editor/split-pdf.spec.ts › PDF editor — Split PDF (in-editor) › Every N pages: 0 is rejected  _(5.29s)_
- ✅ pdf-editor/split-pdf.spec.ts › PDF editor — Split PDF (in-editor) › Cancel closes the modal without firing a download  _(5.96s)_
- ✅ pdf-editor/split-pdf.spec.ts › PDF editor — Split PDF (in-editor) › Split & download fires a download (single-range → PDF)  _(5.81s)_
- ✅ pdf-editor/split-pdf.spec.ts › Split PDF — standalone route (/tools/split-pdf) › Anonymous visit redirects to /sign-in with return path  _(2.29s)_
- ✅ pdf-editor/tools.spec.ts › PDF editor — tool activation › Select tool activates without runtime errors  _(6.91s)_
- ✅ pdf-editor/tools.spec.ts › PDF editor — tool activation › Text tool activates without runtime errors  _(6.87s)_
- ✅ pdf-editor/tools.spec.ts › PDF editor — tool activation › Draw tool activates without runtime errors  _(7.04s)_
- ✅ pdf-editor/tools.spec.ts › PDF editor — tool activation › Highlight tool activates without runtime errors  _(10.62s)_
- ✅ pdf-editor/tools.spec.ts › PDF editor — tool activation › Shapes tool activates without runtime errors  _(4.91s)_
- ✅ pdf-editor/tools.spec.ts › PDF editor — tool activation › Eraser tool activates without runtime errors  _(5.32s)_
- ✅ pdf-editor/tools.spec.ts › PDF editor — tool activation › Whiteout tool activates without runtime errors  _(5.03s)_
- ✅ pdf-editor/tools.spec.ts › PDF editor — tool activation › Signature tool activates without runtime errors  _(4.66s)_
- ✅ pdf-editor/tools.spec.ts › PDF editor — tool activation › Image tool activates without runtime errors  _(3.84s)_
- ✅ pdf-editor/tools.spec.ts › PDF editor — tool activation › Watermark tool activates without runtime errors  _(7.02s)_
- ✅ pdf-editor/tools.spec.ts › PDF editor — tool activation › Background tool activates without runtime errors  _(6.80s)_

---
_Open `playwright-report/index.html` for full HTML report with screenshots + traces._
