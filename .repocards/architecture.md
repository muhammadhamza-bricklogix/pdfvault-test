# Architecture

**Package:** `pdfedits-frontend` v0.0.1

**Stats:** 294 files · 4852 symbols · 1072 imports.

## Top-level layout

| Directory | Files | LOC |
|---|---:|---:|
| `lib/` | 127 | 15302 |
| `components/` | 101 | 16690 |
| `app/` | 38 | 2169 |
| `(root)` | 12 | 3099 |
| `tests/` | 11 | 913 |
| `docs/` | 3 | 768 |
| `public/` | 1 | 31 |
| `scripts/` | 1 | 116 |

## Hub files (most-connected)

These files sit at the center of the import graph. Changes here tend to ripple widely.

| File | Imported by | Imports | Total |
|---|---:|---:|---:|
| [`components/sections/pdf-editor/PdfEditorShell.tsx`](../components/sections/pdf-editor/PdfEditorShell.tsx) | 0 | 14 | 14 |
| [`lib/client/pdf-editor/merge-pdf.ts`](../lib/client/pdf-editor/merge-pdf.ts) | 1 | 7 | 8 |
| [`tests/helpers/editor.ts`](../tests/helpers/editor.ts) | 7 | 0 | 7 |
| [`components/sections/pdf-editor/RightSidebar.tsx`](../components/sections/pdf-editor/RightSidebar.tsx) | 2 | 5 | 7 |
| [`components/sections/dashboard/documents-table.tsx`](../components/sections/dashboard/documents-table.tsx) | 1 | 5 | 6 |
| [`components/sections/pdf-editor/BottomDock.tsx`](../components/sections/pdf-editor/BottomDock.tsx) | 1 | 4 | 5 |
| [`lib/client/pdf-editor/save-utils.ts`](../lib/client/pdf-editor/save-utils.ts) | 3 | 2 | 5 |
| [`lib/client/pdf-editor/vector-drawers.ts`](../lib/client/pdf-editor/vector-drawers.ts) | 1 | 4 | 5 |
| [`lib/client/pdf-editor/watermark-drawer.ts`](../lib/client/pdf-editor/watermark-drawer.ts) | 1 | 4 | 5 |
| [`components/sections/pdf-editor/EditorTopBar.tsx`](../components/sections/pdf-editor/EditorTopBar.tsx) | 2 | 2 | 4 |

## Entrypoints (summary)

- [`app/layout.tsx`](../app/layout.tsx) — no-incoming-imports
- [`lib/providers/app-providers.tsx`](../lib/providers/app-providers.tsx) — no-incoming-imports
- [`app/share/[token]/page.tsx`](../app/share/[token]/page.tsx) — no-incoming-imports
- [`components/sections/dashboard/dashboard-home.tsx`](../components/sections/dashboard/dashboard-home.tsx) — no-incoming-imports
- [`components/sections/dashboard/dashboard-shell.tsx`](../components/sections/dashboard/dashboard-shell.tsx) — no-incoming-imports
- [`components/sections/home/home-hero.tsx`](../components/sections/home/home-hero.tsx) — no-incoming-imports
- [`components/sections/pdf-editor/PdfEditorShell.tsx`](../components/sections/pdf-editor/PdfEditorShell.tsx) — no-incoming-imports
- [`components/ui/file-upload/file-upload.tsx`](../components/ui/file-upload/file-upload.tsx) — no-incoming-imports
- [`components/ui/form/controlled-input-field.tsx`](../components/ui/form/controlled-input-field.tsx) — no-incoming-imports
- [`components/ui/upload-toast/UploadToastProvider.tsx`](../components/ui/upload-toast/UploadToastProvider.tsx) — no-incoming-imports

_See [entrypoints.md](./entrypoints.md) for full detail._

## Documentation index

- [`CONVERSION_TEST_REPORT.md`](../CONVERSION_TEST_REPORT.md) — **PDFedits — File Conversion Test Report** — **Project:** PDFedits frontend (`pdf-viewer-app`) **Report date:** 2026-06-01 **Scope:** All 37 conversion types exposed by the backend `/co
- [`MILESTONE_1B_PLAN.md`](../MILESTONE_1B_PLAN.md) — **Milestone 1b — Backend-Connected Frontend (Documents API)** — > **Tracking document.** Wires the existing frontend to the backend document API and ships a real `/dashboard`. Each task has a status: DONE
- [`MILESTONE_1_PLAN.md`](../MILESTONE_1_PLAN.md) — **Milestone 1 — Weeks 1-2: Core Viewer + Basic Editing + UI Foundation** — > **Tracking document.** Covers what's done, what's in progress, and what remains. > Updated as work progresses. Each task has a status: DON
- [`PDF_EDITOR_PLAN.md`](../PDF_EDITOR_PLAN.md) — **PDF Editor — Implementation Plan** — > **Reference document.** Follow this phase-by-phase. Do not skip ahead. > Each phase ends with a working, testable state before the next be
- [`PROJECT_BRIEFING.md`](../PROJECT_BRIEFING.md) — **PDFedits — Project briefing for AI assistants** — > Paste this entire file at the start of a new Claude (or any LLM) session to > get full context on the codebase. It is the human-readable s
- [`PROJECT_REFERENCE.md`](../PROJECT_REFERENCE.md) — **PDFedits — Frontend Reference** — > **What this is:** a single self-contained reference for the PDFedits > frontend (`~/pdf-viewer-app`). Paste this into a Claude project as 
- [`README.md`](../README.md) — **PDFedits Frontend** — Next.js frontend foundation for PDFedits with custom auth flows, shared UI primitives, and a modular `lib/` structure.
- [`docs/INFRASTRUCTURE.md`](../docs/INFRASTRUCTURE.md) — **PDFedits — Infrastructure & System Overview** — **Audience:** Project / product managers and non-engineering stakeholders. **Purpose:** Explain what the system is made of, how the pieces f
- [`docs/PHASE2_ESTIMATE_REVIEW.md`](../docs/PHASE2_ESTIMATE_REVIEW.md) — **Phase 2 Estimate Review — Smart Vault + Intelligence + AI Actions** — **Reviewer:** Engineering (principal-level estimate critique) **Date:** 2026-06-13 **Scope reviewed:** Your Phase 2 estimate sheet comparing
- [`docs/SHARE_LINKS_BACKEND_CONTRACT.md`](../docs/SHARE_LINKS_BACKEND_CONTRACT.md) — **Public Share Links — Backend Contract** — **Audience:** Backend engineering team. Read with [`INFRASTRUCTURE.md`](./INFRASTRUCTURE.md). **Purpose:** Specify exactly what the backend 
- [`tests/README.md`](../tests/README.md) — **E2E tests — PDF editor + file conversion** — Manual QA suite focused on two areas: the **PDF editor** and the **file conversion** flow. Runs against the local dev server using the syste
