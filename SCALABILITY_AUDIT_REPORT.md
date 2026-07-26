# PDFedits / PDFVault — Scalability & Code Quality Audit

**Date:** 2026-07-26  
**Scope:** Frontend (`/Users/softaims/pdf-viewer-app`) + Backend (`/Users/softaims/Downloads/pdf-viewer-backend-main`)  
**Goal:** Identify code-quality, performance, and scalability blockers for serving 50,000 users with a super-fast experience.

---

## Executive summary

Both codebases are well-structured and the recent frontend cleanup pass left them in decent shape, but **several architectural choices will break at 50 K users**. The biggest risks are not cosmetic — they are memory, caching, and horizontal-scaling blockers.

**Verdict:** You can get to 50 K users, but only after a focused 4–6 week reliability + performance sprint. The highest-ROI fixes are: enable Redis caching, stop buffering whole files in memory, add bundle/code-splitting budgets, and fix the failing tests / lint errors so CI can gate deploys.

---

## Health-check snapshot

| Check | Frontend | Backend |
|---|---|---|
| Lint | 1 warning (`AdvancedSection` unused) | 80 errors, 6 warnings |
| TypeScript | ✅ `tsc --noEmit` passes | `strict` disabled; `strictNullChecks`/`noImplicitAny` off |
| Tests | Playwright suite configured, no unit tests | 11 failing tests in 6 suites (300 total) |
| Build | ✅ `next build` passes last checked | `nest build` passes, Docker builds |

---

## Part 1 — Frontend (Next.js 16 / React 19)

### Critical issues (fix first)

| # | Issue | Why it blocks 50 K | Location | Effort |
|---|---|---|---|---|
| F1 | **Share-link state is in-memory** | PDF bytes, token claims, password hashes, and revocation state live in module-level `Map`s. Data is lost on deploy/restart; multiple containers cannot share state; memory grows unbounded. | `lib/server/share/bytes-store.ts:26`, `metadata-store.ts:19`, `password.ts:43`, `deny-list.ts:18` | 2–3 days |
| F2 | **No bundle analyzer / size budget** | You cannot see how large the editor chunk is or prevent regressions. | `package.json` | ½ day |
| F3 | **PDF editor ships as one static chunk** | `/pdf-composer` eagerly downloads every modal and sidebar before the user drops a file. | `app/(tools)/pdf-composer/page.tsx:16`, `components/sections/pdf-editor/PdfEditorShell.tsx:41-55` | 1–2 days |
| F4 | **`@heroui/react` imported monolithically** | Easy to accidentally bundle unused components; hard to verify tree-shaking. | 66 files | 1–2 days |
| F5 | **Mantine bundled only for one legacy table** | `mantine-react-table` + `@mantine/core` are pulled in even though `PvFileTable` already replaced the old table. | `components/sections/dashboard/documents-table.tsx:13` | ½–1 day |
| F6 | **Thumbnail sidebar renders every page** | A 200-page PDF mounts ~200 thumbnail components and holds their pdf.js page proxies. | `components/sections/pdf-editor/ThumbnailSidebar.tsx:494` | 2–3 days |
| F7 | **Unbounded thumbnail cache** | Module-level `Map<string, string>` of base64 PNGs never evicts. | `components/sections/dashboard/document-thumbnail.tsx:12` | 1 day |
| F8 | **TypeScript target is `es5`** | Bloats output with legacy helpers even though Next.js 16 / React 19 target modern browsers. | `tsconfig.json:4` | ½ day |
| F9 | **Public folder bloat (8.3 MB)** | Contains mock assets, internal PDFs/DOCXs, and a manually-copied `pdf.worker.min.mjs`. | `public/` | 1 day |
| F10 | **No long-term CDN headers for public assets** | `pdf.worker.min.mjs`, PNGs, and policy files may not be cached efficiently. | `next.config.mjs` | ½ day |

### High issues

| # | Issue | Impact | Location | Effort |
|---|---|---|---|---|
| F11 | Heavy PDF save/export/merge runs on main thread | Freezes the tab for large files. | `lib/client/pdf-editor/save-utils.ts`, `merge-pdf.ts`, `render-page-png.ts`, `build-pages-pdf.ts` | 3–5 days |
| F12 | Dashboard does client-side search/sort over all loaded pages | O(n) cost each keystroke; unbounded memory growth. | `components/sections/dashboard/dashboard-home.tsx:97-127` | 2–3 days |
| F13 | TanStack Query document cache has no stale/gc time | Repeated dashboard visits hit the server unnecessarily. | `lib/client/query/queries/documents.query.ts:44`, `lib/config/tanstack.config.ts` | ½ day |
| F14 | IndexedDB eviction only removes one oldest entry | Large uploads can thrash and fail. | `lib/client/offline/pdf-bytes-cache.ts:71` | 1–2 days |
| F15 | Canvas DPR / raster scale uncapped | 4K displays create 8K textures; export scale is fixed at 3×. | `use-page-renderer.ts:39`, `render-page-png.ts` | ½–1 day |
| F16 | Debug `console.*` still leak in production | Weglot/landing logs fire on every mount/route change. | `language-switcher.tsx`, `weglot-loader.tsx`, `weglot-route-sync.tsx`, `landing-tools.tsx`, etc. | 1 day |
| F17 | Global providers mount on every route | Auth, IndexedDB, paywall, and offline listeners run even on marketing pages. | `lib/providers/app-providers.tsx:27-52` | 1 day |
| F18 | Sparse memoization; no React Compiler | Heavy sub-trees re-render on unrelated zustand changes. | Editor canvas, sidebars, modals | 2–3 days |
| F19 | Landing page has no code splitting | Below-the-fold sections ship on first load. | `app/(landing)/page.tsx` | 1 day |
| F20 | Clerk avatars use raw `<img>` | Bypasses Next.js optimization and central CSP/img-src policy. | `dashboard-shell.tsx:144`, `identity-popover.tsx:48` | ½ day |

### Frontend quick wins

- Remove `public/Dashboard/` mock assets (~2 MB).
- Delete or migrate `components/sections/dashboard/documents-table.tsx`.
- Add `sizes`/`placeholder` to `next/image` usages.
- Verify `@solidgate/react-sdk` dynamic import actually splits.
- Use `URL.revokeObjectURL` for generated blob URLs.

---

## Part 2 — Backend (NestJS / Prisma / PostgreSQL / Redis / S3)

### Critical issues (fix first)

| # | Issue | Why it blocks 50 K | Location | Effort |
|---|---|---|---|---|
| B1 | **Redis application cache is disabled** | `onModuleInit` skips `connect()`. All hot data (plans, catalog, entitlements, signed URLs) hits PostgreSQL/S3 on every request. | `src/redis/redis.service.ts:31` | 1–2 days |
| B2 | **Upload progress / SSE state held in-process** | With >1 replica the SSE client may connect to a different instance than the uploader and see no progress. | `src/documents/services/upload-progress.service.ts:17-20` | 2–3 days |
| B3 | **Database connection pool unconfigured** | Uses `pg` default `max: 10`; will exhaust under load. | `src/prisma/prisma.service.ts:24-25` | ½ day |
| B4 | **Every upload/conversion buffers the entire file in memory** | Default Multer memory storage; 100 MB × concurrent users = OOM. | `src/documents/documents.controller.ts:58`, `src/conversion/conversion.controller.ts:69`, `src/pdf-tools/pdf-tools.controller.ts:80` | 3–5 days |
| B5 | **Document downloads load the whole file into memory** | S3 object is concatenated into a `Buffer`; `res.send(buffer)` blocks memory. | `src/documents/documents.service.ts:583-677`, `src/aws/s3.service.ts:131-152` | 2–3 days |
| B6 | **Thumbnail worker downloads the entire PDF** | Just to render page 1, the full PDF is pulled into memory. | `src/documents/processsors/thumbnail.processor.ts:46` | 1–2 days |
| B7 | **Upload/versioning not transactionally consistent with S3** | S3 upload happens before DB write; DB failures create orphan S3 objects. | `src/documents/documents.service.ts:221-412` | 2–3 days |
| B8 | **Docker container runs migrations on every start** | Rolling deployments race and can lock the migration table. | `Dockerfile:66` | ½ day |
| B9 | **`findAll` fires synchronous backfill writes on every listing** | 20 `setThumbnailStatus` updates + 20 BullMQ jobs + 20–40 presigned URLs per page. | `src/documents/documents.service.ts:526-540` | 2–3 days |

### High issues

| # | Issue | Impact | Location | Effort |
|---|---|---|---|---|
| B10 | No caching of hot read-only data | Plans, tools catalog, entitlements, document lists hit DB/S3 every request. | `plan.service.ts`, `tools.service.ts`, `entitlement.service.ts`, `documents.service.ts` | 2–3 days |
| B11 | `billing.controller.ts` is 1,234 lines and touches Prisma directly | Violates project layer rules; hard to test and scale. | `src/billing/billing.controller.ts` | 3–5 days |
| B12 | `documents.service.ts` is 1,004 lines | Upload, download, versioning, restore, thumbnails all in one class. | `src/documents/documents.service.ts` | 3–5 days |
| B13 | 80 lint errors + weak type safety | `any` assignments, unsafe member access, disabled strict flags. | Multiple files | 1–2 weeks |
| B14 | 11 failing tests block CI gating | Regressions in conversion adapter / strategy specs. | `npm test` | 2–3 days |
| B15 | Webhook handler sends emails synchronously | Increases response time and retry-storm risk. | `src/billing/services/webhook-processor.service.ts:443-449`, `:569-579` | 1–2 days |
| B16 | Contact form swallows email failures | Returns 202 even if SES/SMTP failed. | `src/contact/contact.controller.ts`, `src/email/email.service.ts` | ½–1 day |
| B17 | No retries / circuit breaker for external APIs | S3, CloudConvert, Clerk, SES fail immediately on transient errors. | Multiple services | 2–3 days |
| B18 | Public conversion endpoint lacks per-IP cost control | Attackers can burn CloudConvert credits / CPU. | `src/conversion/conversion.controller.ts:30-31` | 1 day |
| B19 | Entitlement check uncached | Queries subscription table on every gated action. | `src/billing/services/entitlement.service.ts:24-40` | ½–1 day |
| B20 | Missing strategic DB indexes | `Document.updatedAt`, `Share.(userId, expiresAt)`, `Subscription.(status, currentPeriodEnd)` lack indexes. | `prisma/schema.prisma` | 1 day |

### Backend quick wins

- Remove unused `throttleTime` import (`documents.controller.ts:23`).
- Delete stray `=` file in repo root.
- Fix logging base name from `nestjs-boilerplate` to service name.
- Make `REDIS_URL` optional in env validation.
- Add Helmet/security headers in `src/main.ts`.
- Add non-root `USER` in Dockerfile.
- Move `NODE_OPTIONS=--experimental-require-module` into Dockerfile runtime env.

---

## Recommended roadmap

### Phase A — Stability & CI gating (1–2 weeks)

1. Fix backend lint errors and enable `strict: true` in `tsconfig.json`.
2. Fix the 11 failing backend tests.
3. Enable Redis connection and add readiness/health checks (DB, Redis, S3).
4. Configure the DB pool and add statement/connection timeouts.
5. Move Prisma migrations out of the app container CMD.
6. Add Helmet and review CORS defaults.

### Phase B — Memory & streaming (2–3 weeks)

1. Switch Multer to disk storage and cap concurrent in-flight uploads.
2. Stream S3 downloads directly to the response.
3. Stream cloud-file imports instead of `arrayBuffer()` buffering.
4. Use S3 range requests / streaming PDF libs for thumbnails.
5. Add disk-space guards and shorten temp-dir sweep intervals.
6. Replace in-memory frontend share-link stores with persistent backends.

### Phase C — Frontend performance (2–3 weeks)

1. Add `@next/bundle-analyzer` and set CI bundle budgets.
2. Lazy-load `PdfEditorShell` and editor modals with `next/dynamic`.
3. Move PDF save/export/merge pipeline to Web Workers.
4. Virtualize thumbnail sidebar and document lists.
5. Move dashboard search/sort to the server and tune TanStack Query cache.
6. Cap DPR / raster scale and optimize canvas memory.

### Phase D — Caching & scale architecture (2–3 weeks)

1. Cache plans, catalog, entitlements, and signed URLs in Redis.
2. Move upload-progress SSE state to Redis pub/sub or BullMQ progress.
3. Split `DocumentsService` and `BillingController` into smaller services.
4. Add an `email` BullMQ queue and move webhook emails out of band.
5. Add retry/circuit-breaker wrappers for external APIs.
6. Add composite DB indexes and verify with `EXPLAIN ANALYZE`.

---

## Bottom line

- **Frontend blockers:** in-memory share links, oversized editor bundle, main-thread PDF processing, unbounded thumbnail/cache growth.
- **Backend blockers:** disabled Redis, in-memory upload progress, unconfigured DB pool, full-file buffering on upload/download/conversion, migrations in the container CMD.

Fix the Phase A items first so you have a reliable CI and deployment pipeline. Then tackle Phase B memory/streaming and Phase C frontend performance. Without those changes, the system will struggle under 50 K users regardless of how many containers you add.
