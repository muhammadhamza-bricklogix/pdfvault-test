# PDF Editor UI — Rigorous QA Report

**Branch:** `fea/pdf-composer`  
**Commit:** `817672f18150225c6a5f8a1ae9de65cb708421fa`  
**Run date:** 2026-07-09  
**Test runner:** Playwright (system Chrome, channel `chrome`)  
**Environment:** Next.js dev server on `localhost:3000`, backend on `localhost:7403`

## Executive summary

- **76 passed**, **1 failed**, **6 skipped**
- The updated desktop / mobile editor chrome is largely functional.
- One confirmed product bug: **PDF export of edited text on rotated pages produces an empty 872-byte file**.
- One confirmed layout issue: **the top tool toolbar clips `Select` / `Edit` (and `Manage Pages`) at 1280×720**; all tools are reachable only at 1920×1080 or wider.
- Auth-gated conversion tests were skipped because the Clerk dev test account could not complete sign-in (redirected to `/factor-two`).

## Test run details

```
bun run test:e2e -- --project=chromium
83 tests, 76 passed, 1 failed, 6 skipped
Duration: ~127 s
```

Playwright-generated markdown: `test-results/REPORT.md`  
HTML report: `playwright-report/index.html`

## Inventory coverage

### 1. Top App Bar
| Item | Status | Notes |
|------|--------|-------|
| Hamburger dropdown — 5 items | ✅ | Create New, Open File, My PDFs, Find and Replace, Version History visible |
| PDFVault logo → home | ✅ | `href="/"` asserted |
| Filename (truncated) | ✅ | `sample.pdf` shown on desktop, hidden on mobile |
| Undo / Redo pill | ✅ | Present and state updates after edits |
| Share via link | ✅ | Present; disabled / gated when signed out |
| Download ▼ — 8 formats | ✅ | PDF, Word, Excel, PowerPoint, JPG, PNG, HTML, Plain text listed |

### 2. Tool Toolbar
| Group | Tools | Status |
|-------|-------|--------|
| A | Select, Edit, Sign, Text, Draw, Highlight | ✅ All activate without crash |
| B | Shapes, Eraser, Whiteout, Redact, Image, Watermark, Background | ✅ All activate without crash |
| C | Compress, Secure, Merge, Split, Flatten, Extract, Page No, Annotate | ✅ Buttons present / modals open |
| Manage | Manage Pages | ✅ Modal opens |

### 3. Left Sidebar (ThumbnailSidebar)
| Item | Status |
|------|--------|
| Page thumbnails visible | ✅ |
| Click to jump page | ✅ |
| Drag handle for reorder | ✅ |
| Current-page active indicator | ✅ |

### 4. Right Sidebar (desktop, contextual)
| Tool | Panel shown | Status |
|------|-------------|--------|
| Shapes | Stroke / fill / opacity | ✅ |
| Highlight | Color properties | ✅ |
| Watermark | Watermark config | ✅ |
| Background | Background image config | ✅ |

### 5. Canvas interactions (smoke-level)
| Interaction | Status | Notes |
|-------------|--------|-------|
| Tool activation | ✅ | No `pageerror` on any tool |
| Edit Text export | ✅ | Upright pages retain edits after PDF export |
| Rotated page export | ❌ | Export yields 872-byte empty PDF (see Bugs) |
| Cmd+F | ✅ | Opens Find & Replace |
| Cmd+Z / Cmd+Y | ✅ | No crash on empty editor |
| Tool switch Draw → Select | ✅ | No crash |

### 6. Modals reachable
| Modal | Trigger | Status |
|-------|---------|--------|
| CreatePdfModal | Hamburger → Create New | ✅ |
| ManagePagesModal | Manage Pages pill | ✅ |
| CompressModal | Compress | ✅ |
| PasswordModal | Secure | ✅ |
| PageNumbersModal | Page No | ✅ |
| FindReplaceModal | Hamburger / Cmd+F | ✅ |
| AnnotationsModal | Annotate | ✅ |
| SplitPdfModal | Split | ✅ |

### 7. Mobile chrome
| Item | Status | Notes |
|------|--------|-------|
| EditorInfoBar (hamburger, filename, Save, page nav, zoom) | ✅ | Filename hidden on small screens |
| BottomDock (Undo, Redo, tool strip, Manage Pages) | ✅ | Tool strip renders as `role="radio"` |
| Mobile properties modal for Watermark | ✅ | |
| Mobile properties modal for Background | ✅ | |

### 8. Save / persistence
| Item | Status | Notes |
|------|--------|-------|
| Save button present | ✅ | Disabled in local / signed-out mode |
| beforeunload prompt on unsaved changes | ✅ | |
| Save uploads merged PDF + editorState | ✅ | Upright pages only |

### 9. Export / Download
| Format | Status | Notes |
|--------|--------|-------|
| Export menu lists all 8 formats | ✅ | UI surface only; backend round-trip not exercised |
| PDF export (upright) | ✅ | |
| PDF export (rotated) | ❌ | Empty output |

### 10. Behind-the-scenes / invariants
Not directly exercised by E2E assertions; covered indirectly where they surface as crashes or visible behavior.

## Bugs found

### 1. Rotated-page PDF export loses content
- **Severity:** High
- **Test:** `edit-text-export.spec.ts` › Rotated page edge case › modified source text survives PDF export on rotated pages
- **Observed:** Exported PDF is only **872 bytes** (valid `%PDF-1.7` header but essentially empty). Edited text is not baked into the output.
- **Repro:**
  1. Open `tests/fixtures/rotated-sample.pdf` (1-page, /Rotate 90).
  2. Activate Edit Text, edit the extracted text overlay.
  3. Export as PDF.
  4. Downloaded file size ~872 bytes.
- **Expected:** File size comparable to source (~several KB) and edited text preserved.

### 2. Toolbar overflows at common laptop resolution
- **Severity:** Medium
- **Test:** `toolbar-overflow.spec.ts` › Select and Manage Pages buttons are clipped from viewport
- **Observed:** At **1280×720**, the `Select` and `Edit` tools (left end) and `Manage Pages` (right end) are rendered outside the viewport.
- **Workaround in tests:** Desktop project viewport set to **1920×1080** so all tools are reachable.
- **Expected:** All primary tools should be visible on screens ≥1280 px wide, or the toolbar should provide horizontal scroll affordance.

### 3. Clerk dev auth setup blocked (test-only blocker)
- **Severity:** Low (test infrastructure)
- **Observed:** `tests/auth.setup.ts` redirects to `/factor-two` for the `e2e+clerk_test@example.com` account, so auth cache cannot be created.
- **Impact:** 6 auth-gated tests in `tests/conversion/tool-pages.spec.ts` and `tests/conversion/tools-modal.spec.ts` are skipped.
- **Recommendation:** Reset the Clerk test user or use a fresh `+clerk_test@` address, then re-run the setup project.

## Files changed / added

- `tests/helpers/editor.ts` — updated `openSamplePdfInEditor` ready signal; `waitForPdfReady` uses canvas label.
- `playwright.config.ts` — desktop viewport set to `1920×1080` with overflow comment.
- `tests/pdf-editor/tools.spec.ts` — tools are now buttons, label fix `Signature` → `Sign`.
- `tests/pdf-editor/controls.spec.ts` — rewritten for new top-bar chrome.
- `tests/pdf-editor/hamburger.spec.ts` — updated to 5-item hamburger menu.
- `tests/pdf-editor/split-pdf.spec.ts` — modal opened from toolbar Split button.
- `tests/pdf-editor/save-export.spec.ts` — mobile Save button selector fixed.
- `tests/pdf-editor/edit-text-export.spec.ts` — tool selector updated to button.
- `tests/pdf-editor/edge-cases.spec.ts` — tool selector updated to button.
- `tests/conversion/tools-modal.spec.ts` — toolbar selector updated.
- `tests/pdf-editor/toolbar-overflow.spec.ts` **(new)** — documents clipping at 1280×720.
- `tests/pdf-editor/ui-inventory.spec.ts` **(new)** — comprehensive inventory smoke tests.
- `tests/pdf-editor/mobile-chrome.spec.ts` **(new)** — mobile EditorInfoBar + BottomDock coverage.

## Recommendations

1. **Fix rotated-page export** in `lib/client/pdf-tools/merge-pdf.ts` (or the edit-text bake path) before shipping.
2. **Make the desktop tool toolbar responsive** so all tools are reachable at 1280×720 / 1440×900 without horizontal clipping.
3. **Resolve Clerk test-account 2FA** so the auth-gated conversion suite runs in CI.
4. Consider adding deeper canvas assertions (e.g., export round-trip text extraction) once the rotated-page bug is fixed.
