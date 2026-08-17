# PDFedits — Frontend Reference

> **What this is:** a single self-contained reference for the PDFedits
> frontend (`~/pdf-viewer-app`). Paste this into a Claude project as the
> foundational context document. Everything an assistant needs to be
> productive about this codebase is here.

---

## 1. Product overview

**PDFedits** — a cloud PDF tools platform. The frontend is a Next.js 16 App
Router app. The current product surface:

| Route | Purpose | Auth |
| --- | --- | --- |
| `/` | Marketing home with hero, tool grid, FAQ, footer | Public |
| `/pricing` | Marketing pricing placeholder | Public |
| `/sign-in`, `/sign-up`, `/sso-callback` | Clerk auth flows | Public |
| `/contact`, `/privacy`, `/terms`, `/cookies`, `/refund`, `/do-not-sell` | Legal pages | Public |
| `/tools/[slug]` | Conversion-tool upload landing (placeholder; uploads route to the editor when slug accepts PDF) — currently 4 valid slugs: `pdf-to-excel`, `excel-to-pdf`, `doc-to-pdf`, `pdf-to-doc` | Public |
| `/pdf-editor` | The full browser-based PDF editor — the most intricate part of the app | Public |
| `/dashboard` | User library — uploaded documents, with rename / delete / sort | **Protected** (Clerk) |
| `/dashboard/settings/{general,account,language,danger}` | Account settings tabs | **Protected** |

Clerk middleware (in `proxy.ts` — yes, that's the Next middleware file
despite the name) protects only `/dashboard(.*)`. Everything else is
public.

---

## 2. Tech stack

| Layer | Choice | Version |
| --- | --- | --- |
| Framework | Next.js (App Router, Turbopack dev) | 16.2 |
| Runtime / package manager | Bun | 1.2.19 |
| Language | TypeScript | 6.x, target ES5 (project pins this; see CLAUDE.md) |
| UI library | HeroUI v3 (built on React Aria) | 3.0.3 |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`) | 4.1.11 |
| Auth | Clerk (`@clerk/nextjs`) | 7.2 |
| Client state | Zustand | 5.0 |
| Server state | TanStack Query | 5.99 |
| Forms | react-hook-form + Zod v4 + `@hookform/resolvers` | |
| HTTP | axios with Clerk-token interceptor | 1.15 |
| PDF render | pdf.js (`pdfjs-dist`) | 5.6 |
| PDF write | pdf-lib (`pdf-lib` + `@pdf-lib/fontkit`) | 1.17 |
| Canvas | Fabric.js v7 (in PDF editor) | 7.3 |
| Drag/drop | `@dnd-kit/{core,sortable,utilities}` | |
| Icons | `@hugeicons/core-free-icons` + `@hugeicons/react` | |
| Date | `dayjs` | 1.11 |
| Tables | `mantine-react-table` (and the Mantine 6 dep chain it needs) | |
| Path alias | `@/*` → project root | |

---

## 3. Folder structure

```
~/pdf-viewer-app/
├── app/                            # Next.js App Router pages
│   ├── (app)/                      # Authed area
│   │   └── dashboard/              # /dashboard, /dashboard/settings/*
│   ├── (marketing)/
│   │   ├── (site)/                 # / · /pricing · /sso-callback
│   │   │   ├── (auth)/             # /sign-in · /sign-up
│   │   │   └── tools/[slug]/       # /tools/<slug> conversion-landing pages
│   │   └── (legal)/                # /privacy · /terms · /contact · …
│   ├── (tools)/
│   │   └── pdf-editor/             # /pdf-editor (the editor route)
│   ├── layout.tsx                  # root layout: Clerk → Theme → Query
│   └── providers.tsx               # AppProviders client wrapper
│
├── components/
│   ├── sections/                   # Page-level compositions
│   │   ├── home/                   # hero, tool grid, FAQ, etc.
│   │   ├── dashboard/              # library table, identity, settings
│   │   ├── pdf-editor/             # editor shell + every tool dialog
│   │   ├── tools/                  # tool-upload-section (slug landings)
│   │   ├── auth/                   # sign-in/up form sections
│   │   └── legal/                  # static legal page bodies
│   ├── ui/                         # Reusable controls
│   │   ├── form/                   # ControlledInputField, ControlledOtpField
│   │   ├── file-upload/            # dropzone + preview
│   │   ├── upload-toast/           # progress toasts for uploads
│   │   ├── auth/                   # OAuth buttons
│   │   ├── theme/                  # ThemeToggle, ThemeSegmented
│   │   ├── data-table/             # generic Mantine-React-Table wrapper
│   │   └── illustrations/          # SVG-React illustrations
│   └── shared/                     # Cross-cutting (navbar, footer)
│
├── lib/
│   ├── client/                     # Client-only code
│   │   ├── auth/                   # getAuthToken (Clerk session helper)
│   │   ├── hooks/                  # Shared hooks
│   │   │   └── pdf-editor/         # All editor hooks (load/render/tools/save)
│   │   ├── pdf-editor/             # Pure editor logic (extraction, merge, build)
│   │   ├── query/                  # TanStack Query setup
│   │   │   ├── mutations/          # documents.mutation.ts (uploads, rename, delete)
│   │   │   └── queries/            # documents.query.ts (list, detail)
│   │   ├── stores/                 # Zustand stores
│   │   │   ├── pdf-editor-store.ts
│   │   │   ├── dashboard-ui-store.ts
│   │   │   ├── preferences-store.ts
│   │   │   └── upload-toasts-store.ts
│   │   ├── sse/                    # Server-sent events helpers
│   │   ├── upload-toasts/          # Upload-toast tracker hook
│   │   └── utils/                  # Client-only utils
│   ├── shared/                     # Code usable on client + server
│   │   ├── api/services/           # documents.service.ts (axios calls)
│   │   ├── constants/              # routes, endpoints, query-keys, home-tool-grid
│   │   ├── schemas/auth/           # Zod schemas for sign-in/up forms
│   │   ├── types/                  # api.types, documents.types
│   │   └── utils/                  # toast, logger, api-error, file-upload-utils
│   ├── config/
│   │   ├── api-client.ts           # axios instance + interceptors
│   │   └── query-client.ts         # TanStack QueryClient factory
│   └── providers/                  # AppProviders (theme + query)
│
├── public/
│   ├── logo.svg, favicon.ico
│   ├── pdf.worker.min.mjs          # pdf.js worker bundle
│   └── static/forms/fw9.pdf        # IRS Form W-9 (used by future forms work)
│
├── styles/                         # globals.css (Tailwind + tokens)
├── proxy.ts                        # Clerk middleware (matches "/dashboard(.*)")
├── next.config.mjs
├── tsconfig.json
├── eslint.config.mjs
└── package.json
```

---

## 4. Root layout & provider nesting

`app/layout.tsx`:

```
<html>
  <body>
    <ClerkProvider>
      <Providers>          ← AppProviders (NextThemes + QueryClient)
        {children}         ← page content
      </Providers>
    </ClerkProvider>
  </body>
</html>
```

Fonts loaded via `next/font/google`:
- `Dancing_Script` → `--font-dancing-script` (used in editor signature placeholders)
- `Playfair_Display` → `--font-legal-serif` (used on legal pages)

---

## 5. Routes constant (`lib/shared/constants/routes.ts`)

```typescript
export const ROUTES = {
  AUTH:   { SIGN_IN, SIGN_UP, SSO_CALLBACK },
  PUBLIC: { HOME, PRICING },
  LEGAL:  { CONTACT, COOKIES, DO_NOT_SELL, PRIVACY, REFUND, TERMS },
  APP:    { DASHBOARD, SETTINGS, SETTINGS_GENERAL, SETTINGS_ACCOUNT,
            SETTINGS_LANGUAGE, SETTINGS_DANGER },
  TOOLS:  { PDF_EDITOR, PDF_TO_EXCEL, EXCEL_TO_PDF, DOC_TO_PDF, PDF_TO_DOC },
}
```

All hardcoded route strings live here. Pages, navbar, and link components
import from this single source of truth.

---

## 6. The PDF editor — most intricate area

The editor lets users open a PDF, edit text/shapes/images on top of it,
manage pages (reorder, rotate, duplicate, color, bg image, watermark), and
save back to the cloud.

### Source layout

| Folder | Purpose |
| --- | --- |
| `lib/client/pdf-editor/` | Pure logic — extraction, merge, build, vector drawers, color/coordinate helpers |
| `lib/client/hooks/pdf-editor/` | React glue — loaders, per-tool hooks, save/navigation, manage-pages draft state |
| `components/sections/pdf-editor/` | UI — shell, viewer, toolbar, sidebars, modals |
| `lib/client/stores/pdf-editor-store.ts` | Zustand store: file, pdfDocument, per-page Fabric JSON + history, watermark/bg-image config, page order |

### Pipeline (load → edit → save)

```
File / cloud doc
        │
        ▼
usePdfLoader        — loads pdf.js doc + sets `pdfDocument` in the store
        │
        ▼
usePageRenderer     — renders the current page to a <canvas> via pdf.js
                      (scale = zoom × DPR; suppressText: true)
        │
        ▼
useFabricCanvas     — overlays a Fabric.js canvas at the same CSS size
                      (enableRetinaScaling: true; setZoom(zoom))
        │
        ▼
useEditTextMode     — extractTextBlocks → FabricIText objects per text run
                      (fonts come from pdf.js's loadedName via document.fonts)
        │
        ▼
Per-tool hooks      — draw / highlight / shape / image / signature / watermark
                      (each tool layers Fabric objects onto the overlay)
        │
        ▼
Save paths:
  • Editor "Save"         → use-save-editor → persistEditorDocument
                            → save-utils.buildEditedPdfBytes
                            → merge-pdf.mergeFabricEditsIntoPdf → S3 upload
  • Manage Pages "Save"   → handleManagePagesSave in PdfEditorShell
                            → build-pages-pdf.buildPdfFromDraft
                            → new File replaces editor's source
  • Export PDF            → window event "editor:export"
                            → use-export-editor (local flatten + download)
```

### Editor sections components (`components/sections/pdf-editor/`)

| File | Purpose |
| --- | --- |
| `PdfEditorShell.tsx` | Top-level shell composing all editor pieces |
| `EditorTopBar.tsx` | File name, page nav, zoom, undo/redo, save dropdown |
| `PdfViewerCanvas.tsx` | Stacked pdf.js canvas + Fabric overlay |
| `ThumbnailSidebar.tsx` | Left sidebar with page thumbnails |
| `RightSidebar.tsx` | Right sidebar: shows tool-specific config (watermark, bg image) on desktop |
| `MobileToolPropertiesModal.tsx` | Mobile equivalent of RightSidebar |
| `BottomDock.tsx` | Mobile bottom toolbar |
| `HamburgerMenu.tsx` | Top-left burger menu |
| `FloatingTextToolbar.tsx`, `FloatingShapeToolbar.tsx` | Context toolbars over selected text/shape objects |
| `WatermarkPropertiesContent.tsx` | Watermark config (text + image variants, opacity, rotation, page scope) |
| `BackgroundImagePropertiesContent.tsx` | Background image preview/config (uses mix-blend-mode: multiply) |
| `HighlightPropertiesContent.tsx` | Highlight color picker |
| `ManagePagesModal.tsx` | Manage Pages dialog (reorder, rotate, duplicate, blank, color, bg image per page) |
| `PageResizeDialog.tsx` | Resize page (paper size) |
| `CreatePdfModal.tsx` | "Create new PDF" dialog |
| `SignatureModal.tsx` | Signature capture (draw / type / upload) |
| `ShapeLinkModal.tsx` | Add hyperlink to a shape |
| `PerformancePanel.tsx` | Dev-only performance metrics panel |
| `EditorLoadingShell.tsx` | Skeleton while editor boots |
| `shape-object-utils.ts` | Pure helpers for shape Fabric objects |

### Editor hooks (`lib/client/hooks/pdf-editor/`)

| File | Purpose |
| --- | --- |
| `use-pdf-loader.ts` | Loads pdf.js doc from File/ArrayBuffer/URL |
| `use-page-renderer.ts` | Paints the current page to `<canvas>` |
| `use-fabric-canvas.ts` | Mounts the Fabric overlay; zoom resizes (never re-mounts) |
| `use-edit-text-mode.ts` | Extracts text blocks → FabricIText objects |
| `use-draw-tool.ts`, `use-highlight-tool.ts`, `use-shape-tool.ts`, `use-eraser-tool.ts`, `use-image-tool.ts`, `use-signature-tool.ts`, `use-watermark-tool.ts` | One per tool — wires Fabric mouse events |
| `use-editor-history.ts` | Per-page undo/redo |
| `use-save-editor.ts` | Build flattened PDF + upload to backend |
| `use-export-editor.ts` | Build flattened PDF + browser download |
| `use-manage-pages-draft.ts` | Draft state for Manage Pages dialog (reorder, rotate, duplicate, blank, color, bg image) |
| `use-editor-document-loader.ts` | Top-level loader: file source → ready editor |
| `use-editor-navigation-save.ts` | "Save before navigating away" prompt + flush |
| `use-editor-auto-persist.ts` | Periodic auto-persist of editor state |

### Pure logic (`lib/client/pdf-editor/`)

The pure files (no React) handle:
- **text-extraction**: walks pdf.js `getTextContent()` + `getOperatorList()` to produce TextBlocks with font, size, color, and rect
- **vector-drawers**: writes Fabric IText / path / rect / image objects back to pdf-lib as vector content
- **merge-pdf**: takes Fabric JSON + source PDF and produces edited bytes
- **build-pages-pdf**: composes a new PDF from the manage-pages draft
- **append-pdf-page**: page-by-page assembly with rotation, background color, watermark

### Load-bearing invariants (do NOT violate)

1. **Fabric uses base coordinates at `zoom = 1`.** Serialized JSON is always zoom=1. `setZoom(zoom)` is applied only for rendering.
2. **Zoom changes resize the Fabric canvas; they never re-mount it.** Mount effect runs only on `sourcePage` change.
3. **Page rotation is baked into the content stream**, not `/Rotate` metadata. See `append-pdf-page.ts`. Do not call `setRotation(degrees(…))` for manage-pages output.
4. **Text color flows: pdf.js OPS → `TextBlock.color` → Fabric `fill` → `hexToPdfColor` at export.** Colors are zipped 1:1 by index from `extractSequentialTextColors`.
5. **Background image preview** uses `mix-blend-mode: multiply` on the PDF canvas. At export the same effect uses `BlendMode.Multiply` on `drawImage`.
6. **Per-page background color** (from Manage Pages) is baked at save in `appendColoredPageFromPdfJs`.
7. **Mobile**: `RightSidebar` isn't mounted. Watermark + bg-image config render via `MobileToolPropertiesModal` inside `BottomDock`.
8. **TypeScript target is `ES5`** — project pins this; do not bump.
9. **Editor modals are lazy** (`next/dynamic`): `CreatePdfModal`, `ManagePagesModal`, `PerformancePanel`.
10. **Save UX must always show a loading toast.** Cloud upload is multi-second — silent waits look like a hang.

### Off-limits (user has explicitly flagged these)

- The watermark code in `lib/client/pdf-editor/merge-pdf.ts` (the inline `renderPageToPng` + `TEXT_OPS_MIN/MAX/RASTER_SCALE` constants stay there even though a shared util exists for `build-pages-pdf.ts`).
- `objectCaching: false` on `IText` in `use-edit-text-mode.ts`.

If a fix requires changing one of these, **ask the user first**.

---

## 7. State management

### Zustand stores (`lib/client/stores/`)

| Store | Holds |
| --- | --- |
| `pdf-editor-store` | `file`, `pdfDocument`, `currentPage`, `zoom`, `activeTool`, per-page Fabric JSON + history, watermark / bg-image config, page order, `currentDocument` (for cloud-loaded docs), `isSignedIn` |
| `dashboard-ui-store` | Sidebar collapsed state, view mode, sort/filter selections |
| `preferences-store` | `dateFormat`, `language` |
| `upload-toasts-store` | Active upload tracker entries (used by upload toast UI) |

### TanStack Query

- `lib/config/query-client.ts` — factory for the QueryClient
- `lib/client/query/mutations/documents.mutation.ts` — upload, upload-cloud (Google Drive), rename, delete, bulk-delete
- `lib/client/query/queries/documents.query.ts` — list + detail + upload-progress SSE
- `lib/shared/constants/query-keys.ts` — typed query-key namespaces

---

## 8. Networking — axios client (`lib/config/api-client.ts`)

```typescript
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
  headers: { Accept: "application/json" },
});

// Request interceptor: injects "Authorization: Bearer <clerk-jwt>"
// Response interceptor: unwraps { success, data } envelope; on 401 tries
// one token refresh, then forces sign-out only if the request originally
// had a token.
```

### Endpoints (`lib/shared/constants/endpoints.ts`)

```
DOCUMENTS.UPLOAD              POST   /documents/upload         multipart
DOCUMENTS.UPLOAD_CLOUD        POST   /documents/upload/cloud
DOCUMENTS.UPLOAD_PROGRESS(id) GET    /documents/upload-progress/:trackingId   SSE
DOCUMENTS.LIST                GET    /documents
DOCUMENTS.DETAIL(id)          GET    /documents/:id
DOCUMENTS.RENAME(id)          PATCH  /documents/:id/rename
DOCUMENTS.DELETE(id)          DELETE /documents/:id
DOCUMENTS.BULK_DELETE         POST   /documents/bulk-delete
```

### Services (`lib/shared/api/services/`)

`documents.service.ts` — `uploadDocument`, `uploadCloudDocument`,
`listDocuments`, `getDocument`, `renameDocument`, `deleteDocument`,
`bulkDeleteDocuments`. All take typed input shapes; return typed
`Document` / `DocumentListResponse`.

---

## 9. Authentication — Clerk

- Keys in `.env` (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY`)
- Sign-in / sign-up pages at `/sign-in`, `/sign-up`, with custom HeroUI styling rather than Clerk's default `<SignIn />` component
- `proxy.ts` (Next middleware) wraps everything in `clerkMiddleware`. Only `/dashboard(.*)` is protected:
  ```typescript
  const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);
  ```
- `lib/client/auth/get-auth-token.ts` — async helper that returns the current Clerk JWT (used by the axios interceptor)
- The `currentSession?.publicMetadata` is read by the editor store on hydration to set `isSignedIn`

---

## 10. Marketing & dashboard sections

### Home (`/`)

`components/sections/home/`:
- `home-hero.tsx` — drag-and-drop / Browse / Connect cloud
- `home-tool-grid.tsx` + `home-tool-grid.ts` constant — 3 tabs (Edit PDF, Convert from PDF, Convert to PDF), driven by static card arrays
- `home-faq.tsx` — tabbed accordion FAQ (HeroUI Tabs + Accordion)
- `home-trust-strip.tsx`, `home-testimonials.tsx`, `home-feature-rows.tsx`

### Dashboard (`/dashboard`)

`components/sections/dashboard/`:
- `dashboard-sidebar.tsx` — collapsible left nav
- `documents-table.tsx` — Mantine-React-Table grid with sort/filter
- `document-row-actions.tsx`, `rename-document-modal.tsx`, `delete-confirmation-modal.tsx`, `bulk-delete-confirmation.tsx`
- `identity-popover.tsx` — Clerk identity + sign-out
- `settings/` — sub-pages for Account, General, Language, Danger

### Tool slug landings (`/tools/[slug]`)

A dynamic route with 4 static slugs. `components/sections/tools/tool-upload-section.tsx`:
- Shows hero + dropzone scoped to the tool's accepted MIME types
- If the tool accepts PDF, dropping a file loads it into the editor store and redirects to `/pdf-editor`
- Non-PDF inputs currently no-op (placeholder for future conversion wiring)

---

## 11. UI library — HeroUI v3

This codebase uses HeroUI v3 (`@heroui/react@3.0.3`), which is built on
React Aria primitives. Important API patterns to know:

### Composition pattern (instead of monolithic components)

```tsx
// Input field with error
<TextField isInvalid={Boolean(error)} name="email">
  <Label>Email</Label>
  <Input value={value} onChange={(e) => set(e.target.value)} />
  {error ? <FieldError>{error}</FieldError> : null}
</TextField>
```

```tsx
// Modal — Modal.Backdrop is the outermost, NOT a <Modal> wrapper
<Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
  <Modal.Container>
    <Modal.Dialog>
      <Modal.CloseTrigger />
      <Modal.Header><Modal.Heading>Title</Modal.Heading></Modal.Header>
      <Modal.Body>…</Modal.Body>
      <Modal.Footer>…</Modal.Footer>
    </Modal.Dialog>
  </Modal.Container>
</Modal.Backdrop>
```

```tsx
// ToggleButtonGroup with selectionMode="single" renders as <radiogroup>
<ToggleButtonGroup selectionMode="single" selectedKeys={...} onSelectionChange={...}>
  <ToggleButton id="select" aria-label="Select">…</ToggleButton>
</ToggleButtonGroup>
```

```tsx
// RadioGroup uses onChange (passes new value directly), not onValueChange
<RadioGroup value={value} onChange={(next: string) => setValue(next)}>
  <Radio value="a">Option A</Radio>
</RadioGroup>
```

```tsx
// Accordion (single-mode by default)
<Accordion variant="default">
  <Accordion.Item id="x">
    <Accordion.Heading>
      <Accordion.Trigger>…<Accordion.Indicator /></Accordion.Trigger>
    </Accordion.Heading>
    <Accordion.Panel>
      <Accordion.Body>…</Accordion.Body>
    </Accordion.Panel>
  </Accordion.Item>
</Accordion>
```

### Button props

- `variant`: `primary` (red) | `secondary` | `tertiary` | `outline` | `ghost` | `danger` | `danger-soft`
- `onPress` instead of `onClick` (React Aria convention)
- **No `isLoading` prop** — use `isDisabled` while pending and swap the label text instead
- For icon-only: `isIconOnly` + `aria-label`

### Common gotchas

- `getByRole("button")` may not match HeroUI buttons if they're wrapped in `ToggleButtonGroup` (then they're `role="radio"` instead)
- `textContent` returns raw DOM text **including** elements with `display: none`; use `innerText` for what the user actually sees
- The Next.js dev error overlay also uses `role="dialog"` with `data-nextjs-dialog` — exclude it when asserting on modals: `[role="dialog"]:not([data-nextjs-dialog])`

---

## 12. Styling — Tailwind v4 + tokens

- `styles/globals.css` registers Tailwind v4 (via `@tailwindcss/postcss`)
- Color tokens used everywhere:
  - `var(--color-background)`, `var(--color-foreground)` (theme-aware)
  - `var(--color-accent)` (the red brand color, ~#ef4444-ish)
  - `bg-default-50` / `bg-default-100` etc. — HeroUI's neutral scale
  - `dark:` variants for dark mode
- Tailwind v4 supports arbitrary-value classes like `bg-[var(--color-accent)]` and `text-[color-mix(in_oklab,var(--color-accent)_8%,transparent)]`
- Dark mode via `next-themes` (`data-theme` attribute on `<html>`)

---

## 13. Environment variables

`.env.example`:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY_HERE
CLERK_SECRET_KEY=YOUR_SECRET_KEY_HERE
NEXT_PUBLIC_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_HERE
NEXT_PUBLIC_GOOGLE_API_KEY=YOUR_BROWSER_API_KEY_HERE
```

The local `.env` may also set:
- `NEXT_PUBLIC_API_BASE_URL` — points the axios client at the NestJS backend (e.g. `http://localhost:7403` or a Railway staging URL)
- `NEXT_PUBLIC_SITE_URL` — used by canonical/OG metadata on marketing pages

---

## 14. Commands

```bash
bun install               # install all deps
bun run dev               # Next.js dev server on :3000 (Turbopack)
bun run build             # production build
bun run lint              # eslint --fix
bunx tsc --noEmit         # type-check only
```

There's no built-in `test` script; tests can be added later.

---

## 15. ESLint conventions

- **Import ordering** (enforced): types → builtins → external → internal → parent → sibling → index, with blank lines between groups
- **JSX props** must be sorted alphabetically, callbacks last, reserved props (`key`, `ref`) first
- Unused imports are auto-removed (`eslint-plugin-unused-imports`)
- `no-console` is a **warning**, not error — some intentional `console.log`s exist in `lib/client/pdf-editor/vector-drawers.ts` and `text-extraction.ts` for debugging (leave them)
- Blank line required **before** `return` and **after** variable declarations
- Path alias: `@/*` resolves to project root

---

## 16. Backend — what the frontend expects

The frontend calls a NestJS backend (separate repo, not in this folder) at
`NEXT_PUBLIC_API_BASE_URL`. The backend implements:

| Endpoint | Auth |
| --- | --- |
| `POST /documents/upload` (multipart) | Bearer JWT |
| `POST /documents/upload/cloud` | Bearer JWT |
| `GET /documents` + `:id` | Bearer JWT |
| `PATCH /documents/:id/rename` | Bearer JWT |
| `DELETE /documents/:id` + bulk-delete | Bearer JWT |
| `GET /documents/upload-progress/:trackingId` (SSE) | Bearer JWT |
| `POST /webhook/clerk` (Svix-signed) | Public |

User identity is synced into the backend's Postgres `User` table via the
Clerk webhook. On localhost the webhook can't reach the backend without a
tunnel (ngrok), so first uploads can fail with a FK error until the user
row exists — manual `INSERT` or ngrok forwarding fixes it.

---

## 17. Repo metadata files at the root

- `CLAUDE.md` — short conventions + commands (loaded automatically into Claude Code)
- `AGENTS.md` — alternate conventions doc for other agents
- `README.md` — public README
- `MILESTONE_1_PLAN.md`, `MILESTONE_1B_PLAN.md` — milestone planning docs
- `PDF_EDITOR_PLAN.md` — design notes for the editor
- `proxy.ts` — Clerk middleware (not actually a proxy)
- `next.config.mjs` — `outputFileTracingRoot` pinned to project to avoid parent-dir lockfile discovery
- `tsconfig.json` — strict mode, ES5 target, path alias
- `eslint.config.mjs` — flat config with the conventions above
- `skills-lock.json`, `.repocards/` — pre-computed context for AI tools

---

## 18. How to ask a Claude project questions about this codebase

After pasting this file into your Claude project, useful prompt patterns:

> "Where would I add a new home tool grid card?"
> → `lib/shared/constants/home-tool-grid.ts`

> "What's the right way to add a new authenticated dashboard sub-page?"
> → Create `app/(app)/dashboard/<slug>/page.tsx` and add to `ROUTES.APP` in `lib/shared/constants/routes.ts`; protected by the `/dashboard(.*)` matcher in `proxy.ts`.

> "I want to add a new tool that converts X to PDF — where do I start?"
> → Add a slug entry to `TOOLS` in `lib/shared/constants/tools.ts`. The dynamic route at `app/(marketing)/(site)/tools/[slug]/page.tsx` will pick it up via `generateStaticParams`. Wire the conversion in `components/sections/tools/tool-upload-section.tsx`.

> "How do I add a new tool to the PDF editor (e.g. a 'Stamp' tool)?"
> → 1. Add `"stamp"` to the `ActiveTool` union in `pdf-editor-store.ts`. 2. Create `lib/client/hooks/pdf-editor/use-stamp-tool.ts` modelled on `use-shape-tool.ts`. 3. Add the icon + label to the `TOOLS` array in `EditorTopBar.tsx`. 4. Wire it in `PdfEditorShell.tsx`. 5. If it needs a sidebar, add a `StampPropertiesContent.tsx` and reference it from `RightSidebar.tsx` (and `MobileToolPropertiesModal.tsx`). 6. Update `lib/client/pdf-editor/vector-drawers.ts` to write its objects to pdf-lib at save time.

> "How are uploads tracked?"
> → `useTrackedUpload` hook composes `useUploadDocumentMutation` with the `upload-toasts-store` to render progress toasts. See `lib/client/upload-toasts/` + `components/ui/upload-toast/`.

> "Where does the API error message come from?"
> → `lib/shared/utils/api-error.ts` — `toApiError` normalizes any thrown value (axios error, plain Error, unknown) into an `ApiError` with status code + user-friendly message.

---

## 19. Verification recipe

After any non-trivial change:

```bash
bunx tsc --noEmit
bun run lint
bun run build           # catches use-server / use-client mismatches
```

---

## 20. Pre-computed context for AI tools

- `CLAUDE.md` — automatically loaded by Claude Code, short orientation
- `.repocards/AGENT_GUIDE.md` — token-efficient cards (architecture, entrypoints, api-surface) generated by `npx repocards index`
- This file (`PROJECT_REFERENCE.md`) — the full reference you're reading

When starting a new chat in your Claude project, lead with:
> "First read `PROJECT_REFERENCE.md`. Then if I ask about the PDF editor specifically, also load `CLAUDE.md`'s editor section."
