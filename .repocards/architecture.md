# Architecture

**Package:** `pdfedits-frontend` v0.0.1

**Stats:** 198 files · 4392 symbols · 692 imports.

## Top-level layout

| Directory | Files | LOC |
|---|---:|---:|
| `components/` | 82 | 10880 |
| `lib/` | 79 | 7592 |
| `app/` | 28 | 1027 |
| `(root)` | 8 | 1640 |
| `public/` | 1 | 31 |

## Hub files (most-connected)

These files sit at the center of the import graph. Changes here tend to ripple widely.

| File | Imported by | Imports | Total |
|---|---:|---:|---:|
| [`lib/client/pdf-editor/merge-pdf.ts`](../lib/client/pdf-editor/merge-pdf.ts) | 1 | 7 | 8 |
| [`components/sections/pdf-editor/PdfEditorShell.tsx`](../components/sections/pdf-editor/PdfEditorShell.tsx) | 0 | 8 | 8 |
| [`components/sections/dashboard/documents-table.tsx`](../components/sections/dashboard/documents-table.tsx) | 1 | 5 | 6 |
| [`components/sections/pdf-editor/RightSidebar.tsx`](../components/sections/pdf-editor/RightSidebar.tsx) | 2 | 4 | 6 |
| [`lib/client/pdf-editor/vector-drawers.ts`](../lib/client/pdf-editor/vector-drawers.ts) | 1 | 4 | 5 |
| [`lib/client/pdf-editor/watermark-drawer.ts`](../lib/client/pdf-editor/watermark-drawer.ts) | 1 | 4 | 5 |
| [`lib/client/pdf-editor/font-mapping.ts`](../lib/client/pdf-editor/font-mapping.ts) | 3 | 1 | 4 |
| [`components/sections/pdf-editor/BottomDock.tsx`](../components/sections/pdf-editor/BottomDock.tsx) | 1 | 3 | 4 |
| [`components/sections/pdf-editor/PdfViewerCanvas.tsx`](../components/sections/pdf-editor/PdfViewerCanvas.tsx) | 1 | 3 | 4 |
| [`lib/client/pdf-editor/save-utils.ts`](../lib/client/pdf-editor/save-utils.ts) | 2 | 1 | 3 |

## Entrypoints (summary)

- [`app/layout.tsx`](../app/layout.tsx) — no-incoming-imports
- [`lib/providers/app-providers.tsx`](../lib/providers/app-providers.tsx) — no-incoming-imports
- [`lib/client/upload-toasts/controller.ts`](../lib/client/upload-toasts/controller.ts) — no-incoming-imports
- [`components/sections/dashboard/dashboard-home.tsx`](../components/sections/dashboard/dashboard-home.tsx) — no-incoming-imports
- [`components/sections/dashboard/dashboard-shell.tsx`](../components/sections/dashboard/dashboard-shell.tsx) — no-incoming-imports
- [`components/sections/home/home-hero.tsx`](../components/sections/home/home-hero.tsx) — no-incoming-imports
- [`components/sections/pdf-editor/PdfEditorShell.tsx`](../components/sections/pdf-editor/PdfEditorShell.tsx) — no-incoming-imports
- [`components/ui/file-upload/file-upload.tsx`](../components/ui/file-upload/file-upload.tsx) — no-incoming-imports
- [`components/ui/upload-toast/UploadToastProvider.tsx`](../components/ui/upload-toast/UploadToastProvider.tsx) — no-incoming-imports

_See [entrypoints.md](./entrypoints.md) for full detail._

## Documentation index

- [`MILESTONE_1B_PLAN.md`](../MILESTONE_1B_PLAN.md) — **Milestone 1b — Backend-Connected Frontend (Documents API)** — > **Tracking document.** Wires the existing frontend to the backend document API and ships a real `/dashboard`. Each task has a status: DONE
- [`MILESTONE_1_PLAN.md`](../MILESTONE_1_PLAN.md) — **Milestone 1 — Weeks 1-2: Core Viewer + Basic Editing + UI Foundation** — > **Tracking document.** Covers what's done, what's in progress, and what remains. > Updated as work progresses. Each task has a status: DON
- [`PDF_EDITOR_PLAN.md`](../PDF_EDITOR_PLAN.md) — **PDF Editor — Implementation Plan** — > **Reference document.** Follow this phase-by-phase. Do not skip ahead. > Each phase ends with a working, testable state before the next be
- [`README.md`](../README.md) — **PDFedits Frontend** — Next.js frontend foundation for PDFedits with custom auth flows, shared UI primitives, and a modular `lib/` structure.
