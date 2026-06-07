# PDFedits Frontend — Infrastructure & Services

> **Scope:** This document describes the **frontend application** (`pdfedits-frontend`) — its runtime, framework, layered architecture, third-party services, and how data flows from the browser to the backend API. The backend (Documents/Conversion/PDF-Tools/Audit API) is a **separate service**; this app consumes it over HTTPS.
>
> **Snapshot:** Next.js 16 · React 19 · TypeScript 6 · Bun 1.2.19 · Generated 2026-06-07.

---

## 1. Runtime & Toolchain

| Concern | Choice | Notes |
|---|---|---|
| Package manager | **Bun** `1.2.19` (pinned in `package.json#engines`) | Used for install and as the local dev runtime. |
| Framework | **Next.js** `16.2.4` (App Router) | Dev uses **Turbopack** (`next dev --turbopack`). |
| UI library | **React** `19.0.0` + **React DOM** `19.0.0` | |
| Language | **TypeScript** `^6.0.3` | Path alias `@/*` → project root. |
| Styling | **Tailwind CSS** `4.1.11` + `@tailwindcss/postcss` | v4 (CSS-first config). |
| Linting | ESLint `9.25.1`, `eslint-config-next`, custom rules | Import ordering, alphabetical JSX props, `no-console` warn, blank-line rules. Run via `bun run lint` (`eslint --fix`). |
| Formatting | Prettier `3.5.3` (via `eslint-plugin-prettier`) | |
| E2E tests | **Playwright** `^1.60.0` | Scripts: `test:e2e`, `test:e2e:ui`, `test:e2e:report`. |

**Scripts:**
```bash
bun install            # install deps
bun run dev            # next dev --turbopack
bun run build          # next build
bun run start          # next start
bun run lint           # eslint --fix
bun run test:e2e       # playwright test
```

---

## 2. Top-Level Layout

```
pdf-viewer-app/
├── app/                  # Next.js App Router (route groups + pages)
│   ├── (auth)/             # sign-in / sign-up (Clerk routes)
│   ├── (app)/              # authenticated app shell (dashboard)
│   ├── (tools)/            # tool surfaces (pdf-editor)
│   ├── (marketing)/        # public marketing pages
│   ├── layout.tsx          # root layout: fonts + ClerkProvider + Providers
│   └── providers.tsx       # client wrapper around AppProviders
│
├── components/
│   ├── sections/           # page-level compositions (auth, dashboard, home, pdf-editor, tools, legal)
│   ├── ui/                 # reusable primitives (file-upload, upload-toast, dropzone, theme toggle)
│   └── shared/             # cross-cutting (navbar, mobile-debug-boot)
│
├── lib/
│   ├── client/             # browser-only modules
│   │   ├── auth/             # Clerk-side helpers
│   │   ├── file-conversion/  # conversion client logic
│   │   ├── hooks/            # React hooks (auth, pdf-editor, upload, use-is-mobile)
│   │   ├── pdf-editor/       # pure logic — merge, extract, vector drawers, color/coord helpers
│   │   ├── query/            # TanStack Query: mutations/, queries/, index barrel
│   │   ├── sse/              # fetch-event-source for upload progress streaming
│   │   ├── stores/           # Zustand stores (dashboard-ui, pdf-editor, preferences, upload-toasts)
│   │   ├── upload-toasts/    # toast queue + controller (entrypoint: controller.ts)
│   │   └── utils/            # client utilities
│   ├── config/             # TanStack Query client config
│   ├── providers/          # AppProviders, QueryProvider
│   └── shared/             # cross-cutting (server-safe)
│       ├── api/services/     # axios-based service clients (documents, conversion, pdf-tools, tools, audit)
│       ├── constants/        # endpoints, query-keys, routes, breakpoints, tool catalogs
│       ├── schemas/auth/     # Zod v4 validation
│       ├── types/            # api, audit, conversion, documents, file-upload, pdf-tools, tools, upload-progress
│       └── utils/            # logger, Clerk error handling
│
├── public/                 # static assets
├── styles/                 # globals.css
├── proxy.ts                # Next.js middleware (Clerk route protection) — name is intentional
├── .repocards/             # pre-computed repo index (architecture, entrypoints, graph, symbol index)
└── package.json
```

**Codebase stats** (`.repocards/architecture.md`, 2026-05-19): 198 files · 4392 symbols · 692 imports. `components/` ≈ 10,880 LOC, `lib/` ≈ 7,592 LOC.

---

## 3. Provider Tree (root layout)

```
<html>
  <body>
    <ClerkProvider>                  // @clerk/nextjs — auth context
      <Providers>                    // app/providers.tsx (client wrapper)
        <AppProviders>               // lib/providers/app-providers.tsx
          <NextThemesProvider>       // next-themes — dark/light via data-theme
            <QueryProvider>          // TanStack Query client
              {children}
              <Toast.Provider />     // HeroUI toasts (top-end)
              <UploadToastProvider />// custom upload progress toasts
              <MobileDebugBoot />    // mobile debug overlay boot
            </QueryProvider>
          </NextThemesProvider>
        </AppProviders>
      </Providers>
    </ClerkProvider>
  </body>
</html>
```

Fonts are loaded at the root via `next/font/google`: **Dancing Script** (`--font-dancing-script`) and **Playfair Display** (`--font-legal-serif`).

---

## 4. Third-Party Services

| Service | Package | Purpose |
|---|---|---|
| **Clerk** | `@clerk/nextjs@^7.2.3` | Authentication. `ClerkProvider` at root, `clerkMiddleware` in `proxy.ts` protects `/dashboard(.*)` and `/tools/(.*)`. Custom sign-in/sign-up under `app/(auth)/`. |
| **Backend API** (internal) | called via `axios@^1.15.2` | REST API consumed by service clients in `lib/shared/api/services/`. Endpoints in `lib/shared/constants/endpoints.ts`. |
| **PDF rendering** | `pdfjs-dist@^5.6.205` | Renders PDF pages to canvases inside the editor. |
| **PDF writing** | `pdf-lib@^1.17.1` + `@pdf-lib/fontkit` | Builds/saves PDFs (merge, watermark, build-pages). |
| **Canvas editing** | `fabric@^7.3.1` | Per-page Fabric canvas — text, shapes, vectors, images. Coords stored at zoom=1. |
| **Drag & drop** | `@dnd-kit/core`, `sortable`, `utilities` | Page reorder in Manage Pages + thumbnail sidebar. |
| **Server state** | `@tanstack/react-query@^5.99.0` | Query/mutation cache; provider at `QueryProvider`. |
| **Client state** | `zustand@^5.0.12` | UI stores (dashboard-ui, pdf-editor, preferences, upload-toasts). |
| **Forms** | `react-hook-form@^7.72.1` + `@hookform/resolvers` + `zod@^4.3.6` | Auth forms + validation. |
| **UI kit** | `@heroui/react@3.0.3` + `@heroui/styles` + `@emotion/react` | Primary component library (React Aria–based). |
| **Tables / dates** | `@mantine/core@^6`, `@mantine/dates`, `mantine-react-table`, `dayjs` | Documents table + date pickers in dashboard. |
| **Icons** | `@hugeicons/react`, `@hugeicons/core-free-icons`, `@tabler/icons-react`, `react-icons` | |
| **Theming** | `next-themes@0.4.6` | Light/dark via `data-theme` attribute. |
| **Repo index** | `repocards@^0.1.1` | Generates `.repocards/` summary — agents should read `.repocards/AGENT_GUIDE.md` first. |

---

## 5. Backend API Surface (what the frontend calls)

All endpoints are declared in `lib/shared/constants/endpoints.ts` and wrapped by axios services in `lib/shared/api/services/`. Each service is paired with a TanStack Query mutation/query in `lib/client/query/`.

### Documents — `lib/shared/api/services/documents.service.ts`

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/documents/upload` | Multipart upload |
| `POST` | `/documents/upload/cloud` | Cloud-source upload |
| `GET`  | `/documents/upload-progress/:trackingId` | SSE — upload progress stream |
| `GET`  | `/documents` | List documents |
| `GET`  | `/documents/:id` | Detail |
| `PATCH`| `/documents/:id/rename` | Rename |
| `DELETE` | `/documents/:id` | Delete |
| `POST` | `/documents/bulk-delete` | Bulk delete |

### Conversion — `lib/shared/api/services/conversion.service.ts`

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/conversion` | Convert between formats |

### PDF Tools — `lib/shared/api/services/pdf-tools.service.ts` *(new in this branch)*

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/pdf-tools/compress` | Compress PDF |
| `POST` | `/pdf-tools/encrypt` | Password-protect |
| `POST` | `/pdf-tools/decrypt` | Remove password |
| `POST` | `/pdf-tools/flatten` | Flatten forms/annotations |
| `POST` | `/pdf-tools/extract-images` | Extract embedded images |

### Tools catalog — `lib/shared/api/services/tools.service.ts`

| Method | Endpoint | Purpose |
|---|---|---|
| `GET`  | `/tools` | List tools |
| `GET`  | `/tools/suggested` | Suggested tools |
| `GET`  | `/tools/:id` | Tool detail |

### Audit — `lib/shared/api/services/audit.service.ts`

| Method | Endpoint | Purpose |
|---|---|---|
| `GET`  | `/audit` | Audit log list |
| `GET`  | `/audit/documents/:id` | Document-scoped audit |

---

## 6. Data Flow Layers

```
UI component (components/sections/**)
    │
    ▼
React hook (lib/client/hooks/**)         ← Zustand store for client UI state
    │
    ▼
TanStack Query mutation / query           (lib/client/query/{mutations,queries}/)
    │
    ▼
Service client (axios)                    (lib/shared/api/services/)
    │
    ▼
Endpoint constant                         (lib/shared/constants/endpoints.ts)
    │
    ▼
Backend HTTPS API
```

**Auth:** Every authenticated request goes through Clerk — `proxy.ts` enforces session on protected routes; service clients attach the Clerk token before issuing the call.

**Real-time upload progress:** `lib/client/sse/fetch-event-source.ts` opens an SSE connection to `/documents/upload-progress/:trackingId`. Events feed the `upload-toasts-store` and render via `UploadToastProvider`.

---

## 7. Routing Map

| Group | Path prefix | Contents |
|---|---|---|
| `(marketing)` | `/` | Public landing, home hero, tool grid |
| `(auth)` | `/sign-in`, `/sign-up` | Clerk-backed auth UIs |
| `(app)` | `/dashboard` | Authenticated dashboard + documents table |
| `(tools)` | `/pdf-editor` | The PDF editor shell (see `.claude/skills/pdf-editor-architecture/SKILL.md`) |

Middleware (`proxy.ts`) gates `/dashboard(.*)` and `/tools/(.*)` behind Clerk.

Route constants live in `lib/shared/constants/routes.ts`. Query-key constants live in `lib/shared/constants/query-keys.ts`.

---

## 8. State Management

### Zustand stores (`lib/client/stores/`)

| Store | Purpose |
|---|---|
| `pdf-editor-store.ts` | File, `pdfDocument`, per-page Fabric JSON + history, watermark / bg-image config, page order. The center of the editor. |
| `dashboard-ui-store.ts` | Dashboard view modes, filters, selection state. |
| `preferences-store.ts` | User-facing preferences (persisted). |
| `upload-toasts-store.ts` | Active upload-toast queue. |

### TanStack Query (`lib/client/query/`)

- **Mutations:** `conversion`, `documents`, `pdf-tools`
- **Queries:** `documents`, `tools`, `audit`
- Client config: `lib/config/` (cache time, retry, etc.)

---

## 9. PDF Editor Stack (specialized)

The editor is the largest single feature. Before editing anything under `lib/client/pdf-editor/**`, `lib/client/hooks/pdf-editor/**`, or `components/sections/pdf-editor/**`, **load the project skill**:

```
Skill({ skill: "pdf-editor-architecture" })
```

**Key invariants** (full list in the skill):
- Fabric coords are stored at **zoom = 1**; zoom is applied for rendering only.
- Zoom changes **resize** the Fabric canvas — never re-mount it.
- Manage-Pages rotation is **baked into the content stream** (`append-pdf-page.ts`), not `/Rotate` metadata.
- Background image preview uses `mix-blend-mode: multiply`; export uses `BlendMode.Multiply` on `drawImage`.
- Mobile renders watermark + bg-image config in a Modal, not the right sidebar.
- Editor modals (`CreatePdfModal`, `ManagePagesModal`, `PerformancePanel`) are lazy-loaded via `next/dynamic`.

**Off-limits without explicit approval:**
- Watermark code in `lib/client/pdf-editor/merge-pdf.ts` (inline `renderPageToPng` + `TEXT_OPS_MIN/MAX/RASTER_SCALE`).
- `objectCaching: false` on IText in `use-edit-text-mode.ts`.

---

## 10. Conventions Snapshot

- **Imports** ordered: types → builtins → external → internal → parent → sibling → index (blank lines between groups).
- **JSX props** sorted alphabetically; callbacks last; reserved props first.
- Unused imports auto-removed.
- Blank line required before `return` and after variable declarations.
- `no-console` is a warn (use the logger in `lib/shared/utils/`).
- Path alias `@/*` → project root.

---

## 11. Where to Look First

| Question | File |
|---|---|
| "What does the repo look like?" | `.repocards/architecture.md` |
| "Where does execution start?" | `.repocards/entrypoints.md` |
| "Where is symbol X?" | `.repocards/index.json` |
| "Who imports / calls X?" | `.repocards/graph.json` |
| "How do I touch the PDF editor?" | `.claude/skills/pdf-editor-architecture/SKILL.md` |
| "What endpoints does the backend expose?" | `lib/shared/constants/endpoints.ts` |
| "What's the routing map?" | `lib/shared/constants/routes.ts` + `app/**/` |

Regenerate the repo index after non-trivial code changes:
```bash
npx repocards index
```
