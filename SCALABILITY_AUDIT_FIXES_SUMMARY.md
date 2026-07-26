# PDFVault / PDFedits — Scalability & Reliability Improvements

**Branch:** `feat/scalability-audit-fixes`
**Repositories:**
- Frontend: `pdf-viewer-app`
- Backend: `pdf-viewer-backend-main`
**Date:** 2026-07-26

This document summarizes the improvements delivered in response to the `SCALABILITY_AUDIT_REPORT.md`. The work focuses on the highest-impact blockers for serving 50,000 users: eliminating in-memory state, moving heavy work off the main thread, streaming large files, and hardening deployment/security.

---

## Executive Summary

| Area | Before | After |
|---|---|---|
| Frontend build health | Worker path disabled, import cycle risk | PDF merge worker enabled with safe fallback, cycle removed |
| Share links | In-memory Maps only | Pluggable Redis/S3 backends with graceful fallback |
| Dashboard search | Client-side filtering of all rows | Server-side debounced search |
| Backend state | In-memory SSE progress, no shared cache | Redis pub/sub progress + Redis cache service |
| File handling | Whole files buffered in memory | Disk storage + streaming uploads/downloads |
| Thumbnails | Full PDF downloaded per thumbnail | 2 MB S3 range request + full fallback |
| Deployment | Migrations ran in container CMD, root user | Migrations externalized, non-root user, Helmet headers |
| Test health | 11 failing backend tests | **308 passing, 0 failing** |

---

## Frontend Improvements

### 1. PDF save/export pipeline now runs in a Web Worker
- **What changed:** `lib/client/pdf-editor/save-utils.ts` now offloads the CPU-heavy `pdf-lib` merge to a dedicated Web Worker (`lib/client/pdf-editor/workers/pdf-merge.worker.ts`).
- **Safety guards:** The worker is used only when the merge does not need the live `pdf.js` document proxy (background-image baking) or a DOM canvas (images, annotations, or unknown Fabric types). If the worker fails, the merge falls back to the main thread.
- **Why it matters:** Large exports no longer freeze the browser tab.

### 2. Broken import cycle removed
- **What changed:** Shared Fabric rendering utilities (`parseFabricJson`, `renderFabricJsonToPng`, `renderFabricSubsetToPng`, `dataUrlToBytes`) were extracted into a new module `lib/client/pdf-editor/fabric-render.ts`.
- **Why it matters:** The worker → merge-pdf → save-utils → worker cycle caused the production build to hang. The new module breaks the cycle and keeps builds fast.

### 3. Share-link storage is now horizontally scalable
- **What changed:** `lib/server/share/bytes-store.ts`, `metadata-store.ts`, `password.ts`, and `deny-list.ts` now support pluggable backends selected by `SHARE_STORE`:
  - `memory` — in-process Map (default, zero-config)
  - `redis` — shared state across containers
  - `s3` — durable object storage for PDF bytes
- **Why it matters:** Share links previously lost state on deploy/restart and could not scale past one container. Redis/S3 backends solve both problems.

### 4. Dashboard search moved to the server
- **What changed:** `components/sections/dashboard/dashboard-home.tsx` now sends a debounced `nameQuery` to the documents API instead of filtering all loaded rows client-side.
- **Why it matters:** Client-side search was O(n) per keystroke and loaded unbounded data into memory.

### 5. Landing page code-splitting
- **What changed:** Below-the-fold landing sections (tools, banner, footer) are now lazy-loaded via `app/(landing)/_lazy-landing-sections.tsx`.
- **Why it matters:** First-load JavaScript for marketing pages is reduced.

### 6. Debug logging cleaned up
- **What changed:** `console.log` statements in landing and Weglot navigation components were replaced with the shared `logger` so debug noise does not leak to production.

### 7. Thumbnail cache bounded
- **What changed:** `components/sections/dashboard/document-thumbnail.tsx` no longer grows an unbounded module-level cache of base64 PNGs.

### 8. Removed dead code and bloat
- **What changed:**
  - Deleted `components/sections/dashboard/documents-table.tsx` (legacy Mantine table).
  - Removed `public/Dashboard/` mock assets (~2 MB).
  - Removed legacy `dashboard.css`.
- **Why it matters:** Eliminates unused dependencies and reduces bundle/public-folder size.

### 9. TypeScript target modernized
- **What changed:** `tsconfig.json` target moved from `es5` to `es2017`.
- **Why it matters:** Removes legacy helper bloat for a Next.js 16 / React 19 target.

---

## Backend Improvements

### 1. Redis is now a first-class dependency
- **What changed:** `src/redis/redis.service.ts` now connects during `onModuleInit`, exposes `isEnabled()`, and gracefully disables Redis features when `REDIS_URL` is missing.
- **Health check:** `src/redis/redis.controller.ts` exposes a public `/redis/health` endpoint.
- **Why it matters:** Previously Redis connection was skipped entirely, forcing every request to hit PostgreSQL/S3.

### 2. Upload-progress SSE now works across containers
- **What changed:** `src/documents/services/upload-progress.service.ts` publishes progress events to a Redis channel and subscribes to cross-instance events, falling back to in-process delivery when Redis is disabled.
- **Why it matters:** With more than one backend replica, the SSE client could land on a different instance than the uploader and see no progress.

### 3. Database connection pool configured
- **What changed:** `src/prisma/prisma.service.ts` now creates a `pg.Pool` with configurable `max`, `min`, `connectionTimeoutMillis`, and `statement_timeout`.
- **Why it matters:** Previously the pool defaulted to 10 connections, which would exhaust under load.

### 4. Uploads and conversions no longer buffer whole files in memory
- **What changed:**
  - `src/documents/documents.controller.ts` uses `multer.diskStorage` for `/documents/upload`.
  - `src/conversion/conversion.controller.ts` uses `multer.diskStorage` for `/conversion`.
  - `src/documents/documents.service.ts` reads from `file.path` instead of `file.buffer`.
- **Why it matters:** A 100 MB file × concurrent users previously risked OOM; disk storage caps memory use.

### 5. Document downloads are now streamed
- **What changed:**
  - `src/aws/s3.service.ts` added `downloadStream(key, range?)`.
  - `src/documents/documents.service.ts` `download()` returns a `Readable` stream.
  - `src/documents/documents.controller.ts` pipes the stream to the response.
- **Why it matters:** Downloads no longer load the entire S3 object into a `Buffer` before sending.

### 6. Thumbnail worker fetches only the PDF head
- **What changed:** `src/documents/processsors/thumbnail.processor.ts` requests only the first 2 MB of a PDF via `s3Service.downloadStream(s3Key, range)` to render page 1, falling back to the full download if the range request fails.
- **Why it matters:** Thumbnails previously downloaded the entire PDF just to render page 1.

### 7. Upload flow is transactionally safer
- **What changed:** `src/documents/documents.service.ts` writes the document metadata row first, then uploads bytes to S3. If S3 upload fails, `rollbackUpload()` removes the database record and S3 object.
- **Why it matters:** Previously S3 upload happened before the DB write, leaving orphan S3 objects on DB failures.

### 8. Upload concurrency capped
- **What changed:** A `Semaphore(MAX_CONCURRENT_UPLOADS = 10)` guards `DocumentsService.upsert`.
- **Why it matters:** Prevents runaway concurrent large uploads from overwhelming CPU/disk.

### 9. Public conversion endpoint throttled
- **What changed:** `src/conversion/conversion.controller.ts` applies `@Throttle({ "public-conversion": { limit: 5, ttl: 60_000 } })` to anonymous conversions.
- **Why it matters:** Prevents attackers from burning CloudConvert credits / CPU.

### 10. Dockerfile hardened
- **What changed:**
  - Removed `npx prisma migrate deploy` from the container CMD.
  - Added a non-root `appuser`.
  - Moved `NODE_OPTIONS=--experimental-require-module` into the image env.
- **Why it matters:** Rolling deployments no longer race on migrations, and the container runs with reduced privileges.

### 11. Security headers added
- **What changed:** `src/main.ts` registers `helmet()` with a lightweight CSP.
- **Why it matters:** Adds baseline protection against common injection and clickjacking vectors.

### 12. Hot data caching
- **What changed:**
  - `src/billing/services/plan.service.ts` caches plans in Redis.
  - `src/billing/services/entitlement.service.ts` caches entitlement checks.
  - `src/tools/tools.service.ts` caches the tools catalog.
  - `src/aws/s3.service.ts` caches presigned URLs in Redis.
- **Why it matters:** Repeated reads of mostly-static data no longer hit PostgreSQL/S3 on every request.

### 13. Lifecycle emails moved out of the webhook hot path
- **What changed:** `src/email/email.service.ts` enqueues lifecycle emails (trial started, trial ending, receipts, etc.) to a new BullMQ `EmailProcessor` (`src/email/email.processor.ts`) and falls back to inline sending when Redis is unavailable.
- **Why it matters:** Webhook handlers no longer block on SES/SMTP; transient email failures are retried without delaying the HTTP response or rolling back DB transactions.

### 14. Dashboard `findAll` backfill made asynchronous
- **What changed:** `src/documents/documents.service.ts` now triggers missing-thumbnail backfills in the background and caps them to 5 per page.
- **Why it matters:** Listing documents no longer synchronously writes 20 `setThumbnailStatus` rows and enqueues 20 BullMQ jobs per page.

### 15. Environment-variable naming corrected
- **What changed:** Renamed `TEMP_DISK_MAX_GB` to `TEMP_DISK_MAX_PERCENT` across config, services, tests, and `.env.example` because the value is a percentage, not gigabytes.

---

## Verification Results

| Check | Frontend | Backend |
|---|---|---|
| Build | ✅ `npm run build` succeeds | ✅ `npm run build` succeeds |
| TypeScript | ✅ `tsc --noEmit` passes | ✅ `tsc --noEmit` passes |
| Lint | ✅ `npm run lint` passes | ✅ `npm run lint` passes |
| Tests | Playwright configured | ✅ **308 passed, 0 failed** |

---

## Remaining Items for a Future Pass

1. **Backend strict TypeScript.** `tsconfig.json` still has `strictNullChecks: false`, `noImplicitAny: false`, etc. Enabling `strict: true` is recommended but is a larger cross-cutting refactor.
2. **Frontend bundle budgets.** Add `@next/bundle-analyzer` CI budgets to prevent future editor-chunk regressions.
3. **Virtualized thumbnail sidebar.** `ThumbnailSidebar.tsx` still renders all page thumbnails for large PDFs; virtualization would further reduce memory.
4. **Composite database indexes.** The audit flagged missing indexes on `Document.updatedAt`, `Share.(userId, expiresAt)`, and `Subscription.(status, currentPeriodEnd)`.

---

*Generated from the `feat/scalability-audit-fixes` branch changes on 2026-07-26.*
