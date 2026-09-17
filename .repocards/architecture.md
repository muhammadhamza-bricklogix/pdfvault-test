# Architecture

**Package:** `pdf-vault` v0.0.1

**Stats:** 562 files · 6043 symbols · 2113 imports.

## Top-level layout

| Directory | Files | LOC |
|---|---:|---:|
| `components/` | 199 | 46208 |
| `lib/` | 195 | 28653 |
| `app/` | 80 | 4452 |
| `docs/` | 33 | 4923 |
| `tests/` | 29 | 4894 |
| `(root)` | 18 | 4030 |
| `scripts/` | 4 | 338 |
| `infra/` | 2 | 529 |
| `new-frontend-design-elements/` | 1 | 8 |
| `public/` | 1 | 31 |

## Hub files (most-connected)

These files sit at the center of the import graph. Changes here tend to ripple widely.

| File | Imported by | Imports | Total |
|---|---:|---:|---:|
| [`tests/helpers/editor.ts`](../tests/helpers/editor.ts) | 14 | 0 | 14 |
| [`components/sections/forms/FormFieldOverlay.tsx`](../components/sections/forms/FormFieldOverlay.tsx) | 1 | 9 | 10 |
| [`components/sections/dashboard/dashboard-home.tsx`](../components/sections/dashboard/dashboard-home.tsx) | 0 | 10 | 10 |
| [`components/sections/forms/FormSidebar.tsx`](../components/sections/forms/FormSidebar.tsx) | 1 | 8 | 9 |
| [`components/sections/forms/fields/types.ts`](../components/sections/forms/fields/types.ts) | 8 | 1 | 9 |
| [`components/sections/pdf-editor/PdfEditorShell.tsx`](../components/sections/pdf-editor/PdfEditorShell.tsx) | 0 | 8 | 8 |
| [`lib/client/pdf-editor/merge-pdf.ts`](../lib/client/pdf-editor/merge-pdf.ts) | 1 | 7 | 8 |
| [`components/sections/pdf-editor/RightSidebar.tsx`](../components/sections/pdf-editor/RightSidebar.tsx) | 2 | 4 | 6 |
| [`lib/client/pdf-editor/save-utils.ts`](../lib/client/pdf-editor/save-utils.ts) | 3 | 3 | 6 |
| [`components/sections/forms/FormEditor.tsx`](../components/sections/forms/FormEditor.tsx) | 0 | 5 | 5 |

## Entrypoints (summary)

- [`app/layout.tsx`](../app/layout.tsx) — no-incoming-imports
- [`app/(tools)/layout.tsx`](../app/(tools)/layout.tsx) — no-incoming-imports
- [`lib/providers/app-providers.tsx`](../lib/providers/app-providers.tsx) — no-incoming-imports
- [`app/share/[token]/page.tsx`](../app/share/[token]/page.tsx) — no-incoming-imports
- [`components/sections/auth/forgot-password-screen.tsx`](../components/sections/auth/forgot-password-screen.tsx) — no-incoming-imports
- [`components/sections/auth/login-screen.tsx`](../components/sections/auth/login-screen.tsx) — no-incoming-imports
- [`components/sections/auth/signup-screen.tsx`](../components/sections/auth/signup-screen.tsx) — no-incoming-imports
- [`components/sections/billing/PaywallProvider.tsx`](../components/sections/billing/PaywallProvider.tsx) — no-incoming-imports
- [`components/sections/forms/FormEditor.tsx`](../components/sections/forms/FormEditor.tsx) — no-incoming-imports
- [`components/sections/forms/W9FormFieldsPortal.tsx`](../components/sections/forms/W9FormFieldsPortal.tsx) — no-incoming-imports

_See [entrypoints.md](./entrypoints.md) for full detail._

## Documentation index

- [`AUDIT_REPORT.md`](../AUDIT_REPORT.md) — **PDFedits — Code Review Summary**
- [`CONVERSION_TEST_REPORT.md`](../CONVERSION_TEST_REPORT.md) — **PDFedits — File Conversion Test Report**
- [`MILESTONE_1B_PLAN.md`](../MILESTONE_1B_PLAN.md) — **Milestone 1b — Backend-Connected Frontend (Documents API)**
- [`MILESTONE_1_PLAN.md`](../MILESTONE_1_PLAN.md) — **Milestone 1 — Weeks 1-2: Core Viewer + Basic Editing + UI Foundation**
- [`PDF_EDITOR_PLAN.md`](../PDF_EDITOR_PLAN.md) — **PDF Editor — Implementation Plan**
- [`PROJECT_BRIEFING.md`](../PROJECT_BRIEFING.md) — **PDFedits — Project briefing for AI assistants**
- [`PROJECT_REFERENCE.md`](../PROJECT_REFERENCE.md) — **PDFedits — Frontend Reference**
- [`QA_REPORT.md`](../QA_REPORT.md) — **PDF Editor UI — Rigorous QA Report**
- [`README.md`](../README.md) — **PDFedits Frontend**
- [`docs/FRONTEND_CODE_AUDIT.md`](../docs/FRONTEND_CODE_AUDIT.md) — **PDFVault — Frontend Code Audit (Scale & Concurrent Users)**
- [`docs/INFRASTRUCTURE.md`](../docs/INFRASTRUCTURE.md) — **PDFedits — Infrastructure & System Overview**
- [`docs/PHASE2_ESTIMATE_REVIEW.md`](../docs/PHASE2_ESTIMATE_REVIEW.md) — **Phase 2 Estimate Review — Smart Vault + Intelligence + AI Actions**
- [`docs/PRODUCTION_READINESS_CHECKLIST.md`](../docs/PRODUCTION_READINESS_CHECKLIST.md) — **PDFVault — Production Readiness Checklist**
- [`docs/SHARE_LINKS_BACKEND_CONTRACT.md`](../docs/SHARE_LINKS_BACKEND_CONTRACT.md) — **Public Share Links — Backend Contract**
- [`docs/STABLE_SYSTEM.md`](../docs/STABLE_SYSTEM.md) — **PDFedits — Stable System Reference**
