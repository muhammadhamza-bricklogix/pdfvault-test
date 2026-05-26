# PDFedits — Project briefing for AI assistants

> Paste this entire file at the start of a new Claude (or any LLM) session to
> get full context on the codebase. It is the human-readable summary of
> what's at `.claude/skills/pdf-editor-architecture/SKILL.md`,
> `.repocards/`, and `CLAUDE.md`, plus the conversion + test work added on
> top.

---

## 1. What this is

**PDFedits** — a cloud PDF tools platform. Two main user surfaces:

1. **PDF editor** at `/pdf-editor` — open a PDF in-browser, add text /
   drawings / shapes / signatures / images / watermarks / background-image /
   per-page background-color, reorder/rotate/duplicate/delete pages, save
   back to the user's library, export to other formats.
2. **Conversion tools** at `/tools/<slug>` — single-purpose pages that take
   a file and convert it via a NestJS backend → CloudConvert. 38 supported
   conversions (31 PDF→X, 7 X→PDF), surfaced through 16 friendly catalog
   tiles + a tools-grid hub.

Built for a paid-ads launch — performance and reliability are first-class
concerns.

## 2. Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 16 (App Router, Turbopack), React 19, TypeScript (ES2022 target) |
| Package manager | Bun 1.2.19 |
| UI | HeroUI v3 (React Aria), Tailwind CSS v4 |
| Auth | Clerk (`@clerk/nextjs`) |
| State (client) | Zustand |
| State (server) | TanStack Query v5 |
| Forms | react-hook-form + Zod v4 |
| PDF render | pdf.js (pdfjs-dist v5) |
| PDF write | pdf-lib v1 |
| Canvas | Fabric.js v7 |
| HTTP | axios (project apiClient with Clerk-token interceptor) |
| Backend | NestJS 11, Prisma + PostgreSQL (Neon), Redis (optional), Clerk JWT, Svix webhooks |
| Conversion engine | CloudConvert via `cloudconvert` SDK |
| Storage | AWS S3 |
| Tests (E2E) | Playwright 1.60 (Chrome channel, no bundled Chromium) |

## 3. Repository layout

### Frontend (`~/pdf-viewer-app`)

```
app/                                # Next.js App Router pages
├── (marketing)/
│   ├── (site)/                     # / · /pricing · /sso-callback
│   │   ├── (auth)/                 # /sign-in · /sign-up
│   │   └── tools/[slug]/page.tsx   # all conversion-tool routes
│   └── (legal)/                    # /terms · /privacy · /contact · …
├── (app)/                          # Authed area
│   └── dashboard/                  # library, activity, settings
├── (tools)/
│   └── pdf-editor/                 # /pdf-editor (public)
├── layout.tsx · providers.tsx
└── proxy.ts                        # Clerk middleware (atypically named)

components/
├── sections/
│   ├── pdf-editor/                 # editor shell, toolbar, sidebar, modals
│   ├── tools/                      # ToolUploadSection (conversion page UI)
│   └── home/ · dashboard/ · auth/
├── ui/                             # form controls, file upload, dropzone
└── shared/                         # navbar, footer

lib/
├── client/
│   ├── pdf-editor/                 # PURE LOGIC: extraction, merge, build, drawers
│   ├── hooks/pdf-editor/           # React glue for the editor
│   ├── stores/                     # Zustand stores (pdf-editor-store, etc.)
│   └── query/                      # TanStack Query mutations + queries
├── shared/
│   ├── api/services/               # documents.service, conversion.service, tools.service
│   ├── constants/                  # routes, endpoints, query-keys, tools, home-tool-grid
│   ├── types/                      # conversion.types, documents.types, tools.types
│   └── utils/                      # toast, download (blob helper), api-error
└── config/
    ├── api-client.ts               # axios instance + interceptors
    └── query-client.ts             # TanStack Query client

tests/                              # Playwright suite (PDF editor + conversion only)
├── README.md
├── auth.setup.ts                   # one-time Clerk sign-in
├── helpers/                        # auth, editor (open PDF, wait for parse, etc.)
├── fixtures/                       # sample.pdf, sample.docx, sample.jpg
├── pdf-editor/                     # tool activation, controls, save dropdown, manage pages
└── conversion/                     # tool pages, tools-modal navigation

scripts/
├── smoke-test-conversions.sh       # curl-based backend smoke for 7 format families
└── playwright-report-md.mjs        # JSON → Markdown summary

.claude/
└── skills/
    └── pdf-editor-architecture/SKILL.md     # editor orientation map

.repocards/                         # pre-computed architecture cards (token-efficient context)
proxy.ts                            # Clerk middleware
playwright.config.ts
CLAUDE.md                           # project conventions
```

### Backend (`~/Downloads/pdf-viewer-backend-main`)

```
src/
├── auth/                           # Clerk strategy + provider
├── conversion/                     # POST /conversion (multipart → CloudConvert)
├── documents/                      # CRUD for uploaded PDFs (S3 + Prisma)
├── tools/                          # GET /tools (catalog), /tools/suggested, /tools/:id
├── user/ · webhook/                # Clerk → DB sync via Svix
├── aws/ · prisma/ · redis/         # infrastructure
├── common/                         # guards, filters, decorators (e.g. @Public, @SkipResponse)
├── config/ · swagger/
└── main.ts                         # bootstrap, CORS, port 7403
prisma/schema.prisma                # User · Document · Conversion models
```

## 4. PDF editor pipeline (load → edit → save)

```
File / cloud doc
   │
   ├── usePdfLoader        loads pdf.js doc, sets pdfDocument in store
   ├── usePageRenderer     renders current page to <canvas> (scale = zoom × DPR; suppressText: true)
   ├── useFabricCanvas     overlays Fabric.js canvas, setZoom(zoom)
   ├── useEditTextMode     extractTextBlocks → FabricIText per text run; fonts from pdf.js
   ├── per-tool hooks      draw / highlight / shape / image / signature / watermark / bg image
   │
   └── Save paths:
       • "Save"            → use-save-editor → buildEditedPdfBytes → merge-pdf.mergeFabricEditsIntoPdf → cloud upload
       • Manage Pages save → buildPdfFromDraft → replaces editor's source
       • "Export"          → window event editor:export → use-export-editor
                             (for non-PDF formats, flatten → POST /conversion)
```

### Load-bearing invariants (do NOT violate)

1. **Fabric uses base coords at `zoom = 1`.** Serialized JSON is always
   zoom=1. `setZoom(zoom)` is applied only for rendering.
2. **Zoom changes resize the Fabric canvas; they never re-mount it.** Mount
   effect runs only on `sourcePage` change.
3. **Page rotation is baked into the content stream**, not `/Rotate`
   metadata. See `append-pdf-page.ts`. Don't call `setRotation(degrees(…))`
   for manage-pages output.
4. **Text color flows: pdf.js OPS → `TextBlock.color` → Fabric `fill` →
   `hexToPdfColor` at export.** Colors are zipped 1:1 by index from
   `extractSequentialTextColors`.
5. **Background image preview** uses `mix-blend-mode: multiply` on the PDF
   canvas. At export the same effect uses `BlendMode.Multiply` on
   `drawImage`.
6. **Per-page background color** (from Manage Pages) is baked at save in
   `appendColoredPageFromPdfJs`.
7. **Mobile**: `RightSidebar` isn't mounted. Watermark + bg-image config
   render via `MobileToolPropertiesModal` inside `BottomDock`.
8. **TypeScript target is `ES2022`** — don't drop back to ES5.
9. **Editor modals are lazy** (`next/dynamic`): `CreatePdfModal`,
   `ManagePagesModal`, `PerformancePanel`.
10. **Save UX must always show a loading toast.** Cloud upload is
    multi-second — silent waits look like a hang.

### Off-limits (user has explicitly said don't touch)

- The watermark code in `lib/client/pdf-editor/merge-pdf.ts` (the inline
  `renderPageToPng` + `TEXT_OPS_MIN/MAX/RASTER_SCALE` constants stay there
  even though a shared util exists for `build-pages-pdf.ts`).
- `objectCaching: false` on `IText` in `use-edit-text-mode.ts`.

If a fix requires changing one of these, **ask the user first**.

## 5. Conversion system

### Backend endpoint

```
POST {NEXT_PUBLIC_API_BASE_URL}/conversion
multipart/form-data:
  file:  <binary>
  type:  <ConversionType enum>     # e.g. "pdf_to_docx"

Response:
  200 OK, Content-Type: application/octet-stream
  Content-Disposition: attachment; filename="<orig>.<ext>"
  body: converted file bytes

Errors:
  400 — invalid extension / oversize file (100 MB max)
  500 — CloudConvert failure (e.g. "Conversion failed: Unauthorized")
```

`@Public` — no auth required at the backend, but the frontend pages gating
them are auth-protected via Clerk middleware. Port 7403.

### 38 supported conversions

PDF→X: avif, azw3, bmp, doc, docx, dxf, emf, eps, epub, gif, html, ico,
jpg, lrf, md, mobi, oeb, pdb, png, ppt, pptx, ps, psd, rtf, svg, tiff,
txt, webp, wmf, xls, xlsx · X→PDF: doc, docx, xls, xlsx, pptx, jpg, png.

### Frontend pieces

| File | Purpose |
| --- | --- |
| `lib/shared/types/conversion.types.ts` | 38-value `ConversionType` union (mirrors backend) |
| `lib/shared/api/services/conversion.service.ts` | multipart POST, `responseType: "blob"`, parses `Content-Disposition`, inflates blob-error bodies back to JSON |
| `lib/client/query/mutations/conversion.mutation.ts` | `useConvertFileMutation` — loading/success/error toasts + auto-download |
| `lib/shared/utils/download.ts` | `triggerBlobDownload` + `parseContentDispositionFilename` |
| `lib/shared/constants/tools.ts` | 38 canonical TOOLS entries + 7 friendly-slug aliases (e.g. `pdf-to-word` → `pdf_to_docx`) |
| `components/sections/tools/tool-upload-section.tsx` | Auto-fires the mutation on file drop; "Convert another file" CTA |
| `components/sections/pdf-editor/EditorTopBar.tsx` | Save dropdown lists 8 formats — non-PDF picks flatten the current edit then call `/conversion` |
| `components/sections/pdf-editor/ToolsModal.tsx` | Editor-side tool browser; reads `GET /tools` from backend |

### Slug rule

Backend enum `pdf_to_docx` → URL slug `pdf-to-docx` (replace `_` with `-`).
Friendly aliases also resolve: `pdf-to-word`, `pdf-to-excel`,
`pdf-to-powerpoint`, `pdf-to-text`, `word-to-pdf`, `excel-to-pdf`,
`powerpoint-to-pdf`.

## 6. Authentication

- Clerk dev keys (`pk_test_*`) in `.env`. Sign-in pages at `/sign-in`,
  `/sign-up`.
- `proxy.ts` (Next.js middleware) protects `/dashboard/*` and `/tools/*`.
  `/pdf-editor` stays public.
- API client (`lib/config/api-client.ts`) injects the Clerk JWT on every
  request; on 401 it tries one refresh, then forces sign-out only if a
  token was originally present.
- Backend syncs Clerk users into Postgres via Svix webhook
  (`POST /webhook/clerk`). On localhost the webhook can't be delivered
  unless you tunnel via ngrok — see "Known gotchas" below.

## 7. Environment variables

### Frontend (`.env`)

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_…
CLERK_SECRET_KEY=sk_test_…
NEXT_PUBLIC_GOOGLE_CLIENT_ID=…
NEXT_PUBLIC_GOOGLE_API_KEY=…
NEXT_PUBLIC_API_BASE_URL=http://localhost:7403
```

### Backend (`~/Downloads/pdf-viewer-backend-main/.env`)

```
NODE_ENV=development
PORT=7403
DATABASE_URL=postgresql://…@neon.tech/…
REDIS_URL=redis://localhost:6379           # optional
CLOUDCONVERT_API_KEY=eyJ0eXAi…             # JWT, scopes: user/task/webhook read+write
CLOUDCONVERT_SANDBOX=false                 # toggle to match key type
CLERK_PUBLISHABLE_KEY=pk_test_…
CLERK_SECRET_KEY=sk_test_…
CLERK_JWKS_URL=https://…/.well-known/jwks.json
CLERK_WEBHOOK_SECRET=whsec_…
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=…
AWS_SECRET_ACCESS_KEY=…
AWS_S3_BUCKET=…
```

## 8. Commands

### Frontend

```bash
bun install                                # deps
bun run dev                                # Next dev (Turbopack) on :3000
bun run build                              # production build
bun run lint                               # ESLint --fix
bunx tsc --noEmit                          # type-check

bun run test:e2e                           # Playwright suite (~40s)
bun run test:e2e:ui                        # interactive mode
bun run test:e2e:report                    # open last HTML report
node scripts/playwright-report-md.mjs      # regenerate Markdown summary
bash scripts/smoke-test-conversions.sh     # curl-based backend smoke
```

### Backend

```bash
cd ~/Downloads/pdf-viewer-backend-main
npm install
npm run start:dev                          # NestJS dev on :7403
                                           # Swagger at /api/docs
```

## 9. Tests — Playwright structure

```
tests/
├── auth.setup.ts                  # one-time Clerk sign-in (test+clerk_test@ email)
├── helpers/
│   ├── auth.ts                    # skipIfUnauthenticated()
│   └── editor.ts                  # openSamplePdfInEditor() · waitForPdfReady()
├── fixtures/                      # sample.pdf, sample.docx, sample.jpg
├── pdf-editor/                    # tools.spec · controls.spec · save-export.spec · manage-pages.spec
└── conversion/                    # tool-pages.spec · tools-modal.spec
```

Current results: **18 passed, 0 failed, 6 skipped** (auth-gated; unlocked
once you sign up `e2e+clerk_test@example.com` / `ClerkE2EPassword!23` /
verification code `424242`).

## 10. ESLint conventions

- Import order: types → builtins → external → internal → parent → sibling
  → index, blank lines between groups.
- JSX props alphabetical, callbacks last, reserved props first.
- Unused imports auto-removed.
- `no-console` is a warning (some intentional console.logs in
  `vector-drawers.ts` and `text-extraction.ts` — leave them).
- Blank line before `return`, after variable declarations.

## 11. Routes (front + back)

### Frontend (browser URLs)

| Path | Purpose | Auth |
| --- | --- | --- |
| `/` | Marketing home + tool grid | Public |
| `/sign-in` · `/sign-up` | Clerk | Public |
| `/pdf-editor` | The PDF editor | Public |
| `/tools/<slug>` | Conversion tool (38 canonical + 7 friendly aliases) | **Required** |
| `/dashboard` · `/dashboard/settings/*` · `/dashboard/activity` | User library + settings | **Required** |
| `/pricing` · `/terms` · `/privacy` · `/contact` · `/cookies` · `/refund` · `/do-not-sell` | Marketing/legal | Public |

### Backend (NestJS, port 7403)

| Path | Purpose | Auth |
| --- | --- | --- |
| `POST /conversion` | File conversion via CloudConvert | `@Public` |
| `POST /documents/upload` | Upload PDF to S3 + Document row | Bearer JWT |
| `GET /documents` · `GET /documents/:id` · `PATCH /documents/:id/rename` · `DELETE /documents/:id` · `POST /documents/bulk-delete` | Document CRUD | Bearer JWT |
| `GET /tools` · `GET /tools/suggested` · `GET /tools/:id` | Catalog | Bearer JWT |
| `POST /webhook/clerk` | Svix-signed Clerk events | `@Public` |
| `/api/docs` | Swagger | Public |

## 12. Known gotchas

1. **Foreign-key error on first upload** — backend `Document.userId` FKs to
   `User.id` (Clerk ID). User row is created via Svix webhook, which can't
   reach localhost without a tunnel. Fix on dev:
   ```sql
   INSERT INTO "User" (id, email, name, role, "createdAt", "updatedAt")
   VALUES ('user_xxx', 'you@example.com', 'You', 'USER', NOW(), NOW())
   ON CONFLICT (id) DO NOTHING;
   ```
   Or run `ngrok http 7403` and point the Clerk dashboard webhook at
   `https://<ngrok>/webhook/clerk`.

2. **CloudConvert returns `Unauthorized`** — usually a sandbox/production
   key mismatch. Toggle `CLOUDCONVERT_SANDBOX` in backend `.env` or
   regenerate the key at
   https://cloudconvert.com/dashboard/api/v2/keys.

3. **Playwright can't download Chromium in sandboxed environments** —
   `playwright.config.ts` uses `channel: "chrome"` to use the locally
   installed Google Chrome instead. The `setup` project also doesn't gate
   the `chromium` project — auth-gated tests skip gracefully if the test
   user isn't signed up yet.

4. **`textContent` vs `innerText`** — pdf-editor page indicator hides the
   "Page " / " of" / "/" spans responsively. Use `innerText` (CSS-aware)
   not `textContent` (raw DOM).

5. **HeroUI `ToggleButtonGroup`** renders as `<radiogroup>` with `role="radio"`
   per item — not `role="button"`. Selectors must use
   `getByRole("radio", …)`.

6. **Next.js dev-tools error overlay** also has `role="dialog"`. When
   asserting on modals, exclude it:
   `[role="dialog"]:not([data-nextjs-dialog])`.

## 13. Recent work summary (chronological)

- **Bg image + bg color + watermark pipeline** — hybrid Fabric preview +
  pdf-lib vector export. Mobile uses a modal instead of the right
  sidebar.
- **Zoom UX fix** — split mount and resize effects in `use-fabric-canvas`
  so text doesn't blur or clutter on zoom.
- **Font color extraction** — pdf.js `getOperatorList` walked to extract
  `setNonStrokeRGBColor` ops, zipped 1:1 to text items.
- **Save UX** — loading toasts on `useSaveEditor` + navigation save.
- **Rotation in Manage Pages** — rotation baked into content stream via
  `embedPage` + `cm`, then later via `setRotation` after the
  text-positions-desync issue was diagnosed. Text overlays now mount with
  Fabric `angle = block.rotation`; revert-rotation flow re-extracts when
  the existing overlay's angle no longer matches the page's current
  rotation.
- **38-conversion frontend** — new types + service + mutation + helper +
  expanded TOOLS map; the `/tools/[slug]` dynamic route resolves both
  canonical and friendly slugs.
- **Editor Save-dropdown wired to conversion** — "Coming soon" toast
  replaced; non-PDF picks flatten the current edit, wrap as a `File`,
  hand to `useConvertFileMutation`.
- **Playwright suite** — `tests/pdf-editor/*` + `tests/conversion/*`, with
  `auth.setup.ts` for Clerk sign-in. 18 passing, 6 auth-gated.

## 14. Verification recipe

After any non-trivial change:

```bash
bunx tsc --noEmit
bun run lint
bun run build             # catches use-server/use-client mismatches
bun run test:e2e          # smoke through the editor + conversion UI
```

For conversion-pipeline changes, also run the backend smoke:

```bash
bash scripts/smoke-test-conversions.sh
```

This curls 7 representative conversion families against the live backend
(one per format family) — needs a working CloudConvert key.

## 15. Pre-computed context

- `CLAUDE.md` — short conventions + skill pointer
- `.claude/skills/pdf-editor-architecture/SKILL.md` — load when working
  under `lib/client/pdf-editor/**`, `lib/client/hooks/pdf-editor/**`, or
  `components/sections/pdf-editor/**`
- `.repocards/AGENT_GUIDE.md` — generated by `repocards`; quick
  architecture cards, entrypoints, api-surface

When starting a new chat, instruct your AI:
> "First read `PROJECT_BRIEFING.md`, then `CLAUDE.md`, then the relevant
> skill file under `.claude/skills/` if I'm asking about the PDF editor."
