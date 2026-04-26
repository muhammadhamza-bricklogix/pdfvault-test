# Milestone 1b — Backend-Connected Frontend (Documents API)

> **Tracking document.** Wires the existing frontend to the backend document API and ships a real `/dashboard`. Each task has a status: DONE / IN PROGRESS / TODO. Updated as work progresses.

---

## Summary

**Goal:** Establish the three-layer frontend architecture (UI → React Query → typed API service) against the backend's Documents API, ship a `/dashboard` for signed-in users, and wire the existing PDF editor + tools pages to the same upload/save flow.

**Scope:** Frontend only (the backend exposes the endpoints listed below; no backend code in this repo).

**Out of scope:** PDF conversion endpoints, sharing/public links, trash/restore, search/filter, bulk actions, offline mutations, freemium gating, IndexedDB implementation (brainstorm only).

---

## Architecture (mental model)

```
┌──────────────────────────────────────────────────────────────────┐
│ UI layer       components/sections/dashboard/*, editor/*, etc.   │
│   uses ▼                                                         │
│ Data layer     lib/client/query/{queries,mutations}/documents/*  │
│   uses ▼                                                         │
│ API layer      lib/shared/api/services/documents.service.ts      │
│   uses ▼                                                         │
│ HTTP client    lib/shared/api/client.ts (axios + Clerk token)    │
│ Endpoints      lib/shared/api/endpoints.ts (typed paths)         │
│ DTOs           lib/shared/types/documents.types.ts (SoT)         │
└──────────────────────────────────────────────────────────────────┘
```

- DTOs in `lib/shared/types/documents.types.ts` are imported by services, queries, mutations, and UI — **single source of truth**.
- Query keys in `lib/shared/constants/query-keys.ts` as a typed factory (`documentKeys.list({ pageSize })`, `documentKeys.detail(id)`); mutations invalidate via the factory only — no string drift.
- One axios instance, with a request interceptor that attaches the Clerk JWT (`Authorization: Bearer <token>`) and a response interceptor that retries once with a fresh token on `401`, then signs the user out.

---

## Endpoints (assumed contracts — to be reconciled when swagger lands)

| Method | Path                       | Purpose                                                                                    |
| ------ | -------------------------- | ------------------------------------------------------------------------------------------ |
| POST   | `/documents/upload`        | Multipart: `file` + optional `id`. `id` present → update, else create. Returns `Document`. |
| GET    | `/documents?page&pageSize` | Paged list. Returns `{ items, page, pageSize, total, hasNextPage }`.                       |
| GET    | `/documents/{id}`          | Document metadata.                                                                         |
| GET    | `/documents/{id}/download` | `{ url, expiresAt }` (presigned S3).                                                       |
| PATCH  | `/documents/{id}/rename`   | Body `{ name }`. Returns updated `Document`.                                               |
| DELETE | `/documents/{id}`          | 204.                                                                                       |

Assumed `Document` shape:
`{ id, name, size, mimeType, pageCount?, createdAt, updatedAt }`.

---

## Overall Progress

| Area                                      | Status  | Notes                                                                                                                                                                                          |
| ----------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase A — API & data plumbing             | TODO    | axios client, endpoints, types, services, query keys, queries, mutations, toast helper                                                                                                         |
| Phase B — Routing & auth gates            | TODO    | Protect `/dashboard`, Clerk redirects, navbar Dashboard link                                                                                                                                   |
| Phase C — Dashboard UI                    | DONE    | Layout, sidebar, list (infinite scroll, real pdf.js thumbnails), per-row actions, upload CTA                                                                                                   |
| Phase D — Editor & tools-page integration | PARTIAL | Open from dashboard via `?id=`, tool-upload-section uploads-then-routes, home-hero uploads when signed-in. Save/Export still blocked on editor's pdf-lib export logic (UI marked Coming Soon). |
| Phase E — IndexedDB brainstorm            | TODO    | Document strategy only (no code)                                                                                                                                                               |

---

## Task Breakdown

### Phase A — API & data plumbing

**Status:** TODO

1. **Env + axios client.** Add `NEXT_PUBLIC_API_BASE_URL` to `.env`. Install `axios`. Create `lib/shared/api/client.ts` with one axios instance:
   - **Request interceptor:** attaches `Authorization: Bearer <token>` from Clerk (`window.Clerk?.session?.getToken()` for client, or via a small hook for components that need it).
   - **Response interceptor:** on `401`, retry once after `getToken({ skipCache: true })`; if still `401`, call `window.Clerk.signOut({ redirectUrl: '/sign-in' })`.
2. **Endpoints + types.** `lib/shared/api/endpoints.ts` exports `DOCUMENTS.{ UPLOAD, LIST, DETAIL(id), DOWNLOAD(id), RENAME(id), DELETE(id) }`. `lib/shared/types/documents.types.ts` defines `Document`, `DocumentListResponse`, `UploadDocumentInput`, `RenameDocumentInput`, `DownloadResponse`, `Paginated<T>`.
3. **Service.** `lib/shared/api/services/documents.service.ts` — one typed function per endpoint. `upload` builds `FormData`, conditionally appends `id`, supports `onUploadProgress` and `AbortSignal`.
4. **Query keys.** `lib/shared/constants/query-keys.ts` — `documentKeys` factory: `all`, `lists()`, `list(params)`, `details()`, `detail(id)`, `download(id)`.
5. **Queries.** Under `lib/client/query/queries/documents/`:
   - `use-documents.query.ts` — `useInfiniteQuery`, `getNextPageParam` from `hasNextPage`.
   - `use-document.query.ts` — single doc detail.
   - `use-document-download.query.ts` — lazy (`enabled: false` default), returns `{ url, expiresAt }` on demand.
6. **Mutations.** Under `lib/client/query/mutations/documents/`:
   - `use-upload-document.mutation.ts` — supports `onUploadProgress`; invalidates `documentKeys.lists()`.
   - `use-rename-document.mutation.ts` — optimistic update on the cached list + detail.
   - `use-delete-document.mutation.ts` — optimistic remove with rollback on error.
7. **Toasts helper.** `lib/shared/utils/toast.ts` — thin wrapper around HeroUI `addToast`, exposing `toast.success`, `toast.error`, `toast.info`. Used by mutations.

**Files to create:**

- `lib/shared/api/client.ts`
- `lib/shared/api/endpoints.ts`
- `lib/shared/api/services/documents.service.ts`
- `lib/shared/types/documents.types.ts`
- `lib/shared/constants/query-keys.ts`
- `lib/shared/utils/toast.ts`
- `lib/client/query/queries/documents/{use-documents,use-document,use-document-download}.query.ts`
- `lib/client/query/mutations/documents/{use-upload-document,use-rename-document,use-delete-document}.mutation.ts`

**Files to modify:**

- `.env` (add `NEXT_PUBLIC_API_BASE_URL`)
- `package.json` (add `axios`)
- `lib/client/query/queries/index.ts` and `lib/client/query/mutations/index.ts` (barrel exports)

---

### Phase B — Routing & auth gates

**Status:** TODO

1. **Protect `/dashboard`.** Update `proxy.ts` to require auth on `/dashboard(.*)` (using `auth().protect()` or equivalent in the Clerk middleware).
2. **Clerk redirects.** On `<SignIn />` and `<SignUp />` components, set `fallbackRedirectUrl="/dashboard"` (and `signInFallbackRedirectUrl` on `<SignUp />`). Update the existing server-side `auth() ? redirect(HOME)` checks in `app/(auth)/sign-in/page.tsx` and `app/(auth)/sign-up/page.tsx` to redirect to `/dashboard` instead of `/`.
3. **Add `ROUTES.DASHBOARD`.** Extend `lib/shared/constants/routes.ts` with `DASHBOARD: "/dashboard"`.
4. **Navbar Dashboard link.** In `components/shared/navigation/site-navbar.tsx`, render a "Dashboard" link inside `<Show when="signed-in">` (next to `<UserButton />`).

**Files to modify:**

- `proxy.ts`
- `lib/shared/constants/routes.ts`
- `app/(auth)/sign-in/page.tsx`, `app/(auth)/sign-up/page.tsx`
- `components/sections/auth/sign-in-section.tsx`, `components/sections/auth/sign-up-section.tsx` (set Clerk redirect props)
- `components/shared/navigation/site-navbar.tsx`

---

### Phase C — Dashboard UI

**Status:** TODO

**Layout:** sidebar (My Documents, Recents) + dense table.

```
┌──────────────┬──────────────────────────────────────────────┐
│ My Documents │  Header: "My Documents"      [+ Upload PDF]  │
│ Recents      │ ─────────────────────────────────────────────│
│              │  ┌──────┬──────────┬──────┬─────┬─────┬────┐ │
│              │  │ Thumb│ Name     │ Size │ Pgs │ Upd │ ⋮  │ │
│              │  ├──────┼──────────┼──────┼─────┼─────┼────┤ │
│              │  │ ░░░  │ doc.pdf  │ 1MB  │  4  │ ... │ ⋮  │ │
│              │  └──────┴──────────┴──────┴─────┴─────┴────┘ │
│              │                  (infinite scroll)            │
└──────────────┴──────────────────────────────────────────────┘
```

1. **Layout shell.** `app/dashboard/layout.tsx` wraps with `<DashboardShell />`. `components/sections/dashboard/dashboard-shell.tsx` is the two-pane layout.
2. **Sidebar.** `components/sections/dashboard/dashboard-sidebar.tsx` — minimal vertical nav with two items.
3. **Page.** `app/dashboard/page.tsx` renders the header (title + "Upload PDF" CTA) and `<DocumentList />`.
4. **Document list.** `components/sections/dashboard/document-list.tsx` — HeroUI `Table` with columns: Thumbnail, Name (inline rename), Size, Pages, Updated, Actions. Uses `useDocumentsQuery` (`useInfiniteQuery`); an `IntersectionObserver` sentinel triggers `fetchNextPage`. Skeleton rows during initial load; empty-state when zero documents.
5. **Thumbnail cell.** `components/sections/dashboard/document-thumbnail.tsx` — lazy-mounts when visible (IntersectionObserver), fetches presigned URL via `useDocumentDownloadQuery`, renders page 1 with pdf.js to a small canvas, caches the resulting `dataURL` in a module-level `Map<` `${id}:${updatedAt}` `, string>` to avoid re-rendering on scroll.
6. **Action menu.** Per-row HeroUI `Dropdown`:
   - **Open** → fetch download URL → load Blob → push to `usePdfEditorStore` (with `currentDocumentId`, `currentDocumentName`) → `router.push(ROUTES.TOOLS.PDF_EDITOR)`.
   - **Download** → fetch download URL → `<a download>` trigger.
   - **Rename** → toggle inline edit on the Name cell (Enter to commit, Escape to cancel) calling `useRenameDocumentMutation`.
   - **Delete** → HeroUI confirm `Modal`, then `useDeleteDocumentMutation`.
7. **Upload CTA.** `components/sections/dashboard/upload-button.tsx` — opens a HeroUI `Modal` containing the existing `<FileUpload />`. On select, calls `useUploadDocumentMutation` (no `id`); shows progress (axios `onUploadProgress` → HeroUI `Progress`); on success, closes modal, the new doc appears at the top of the list, and the user is routed to the editor with the returned `id`.

**Files to create:**

- `app/dashboard/layout.tsx`, `app/dashboard/page.tsx`
- `components/sections/dashboard/dashboard-shell.tsx`
- `components/sections/dashboard/dashboard-sidebar.tsx`
- `components/sections/dashboard/document-list.tsx`
- `components/sections/dashboard/document-row.tsx` (extracted row, inline rename + actions)
- `components/sections/dashboard/document-thumbnail.tsx`
- `components/sections/dashboard/upload-button.tsx`
- `components/sections/dashboard/delete-confirm-modal.tsx`

---

### Phase D — Editor & tools-page integration

**Status:** TODO

1. **Editor store extension.** Extend `usePdfEditorStore` (`lib/client/stores/pdf-editor-store.ts`) with:
   - `currentDocumentId: string | null`
   - `currentDocumentName: string | null`
   - setter `setCurrentDocument(id, name)` and clear in `clearFile()`.
2. **Open from dashboard.** Dashboard's Open action sets `currentDocumentId` + `currentDocumentName` alongside `setFile(blob)`.
3. **Editor Save.** Wire the editor menu's Save (currently disabled) to:
   - Lazy-load `pdf-lib` (`await import('pdf-lib')`).
   - Compose modified PDF from base PDF + per-page Fabric JSON overlays → `Blob`.
   - Call `useUploadDocumentMutation({ id: currentDocumentId, file })`. If no id, store the returned id in the store.
4. **Editor Export.** Same pdf-lib pipeline → trigger browser download (no upload).
5. **Tools pages upload flow.** Update `components/sections/tools/tool-upload-section.tsx` so on file select it:
   - Calls `useUploadDocumentMutation` (no id, multipart) — uploads in the background.
   - Pushes the file into `usePdfEditorStore` with the returned id.
   - Routes to `ROUTES.TOOLS.PDF_EDITOR`.

**Files to modify:**

- `lib/client/stores/pdf-editor-store.ts`
- `components/sections/pdf-editor/HamburgerMenu.tsx` (or wherever Save/Export live)
- `components/sections/pdf-editor/PdfEditorShell.tsx` (Open from store with id)
- `components/sections/tools/tool-upload-section.tsx`

---

### Phase E — IndexedDB brainstorm

**Status:** TODO (doc only)

Add a section to this doc capturing the strategy. **No code in this milestone.**

- **Why:** offline view of recently-opened PDFs; resilience when a presigned URL expires before the user reloads; faster repeat-opens.
- **What to cache:** PDF blob keyed by `documentId`, with `updatedAt` as cache version; metadata snapshot for offline list.
- **How:** `idb` library; single DB `pdfforge`; stores `documents-blobs` (key: `id`, value: `{ blob, updatedAt }`) and `documents-meta` (key: `id`, value: `Document`). Read-through pattern in the viewer: `getBlob(id, updatedAt)` → if hit, return; else fetch presigned URL → fetch blob → save to IDB → return.
- **Eviction:** LRU with ~200 MB cap; track `lastAccessedAt` per entry.
- **Conflict:** if server `updatedAt > local`, refetch and overwrite.
- **Out of scope:** offline mutations / queue / sync; service worker.

---

## Execution Order (recommended)

| Step | Task                                                           | Depends on                  |
| ---- | -------------------------------------------------------------- | --------------------------- |
| 1    | Phase A.1–A.4 (client, endpoints, types, services, query keys) | Nothing                     |
| 2    | Phase A.5–A.6 (queries, mutations)                             | 1                           |
| 3    | Phase A.7 (toast helper)                                       | Nothing (parallel)          |
| 4    | Phase B (routing, redirects, navbar link)                      | Nothing (parallel with 1–3) |
| 5    | Phase C.1–C.4 (shell, sidebar, page, list)                     | 2, 4                        |
| 6    | Phase C.5–C.7 (thumbnails, actions, upload CTA)                | 5                           |
| 7    | Phase D (editor + tools-page wiring)                           | 2, 6                        |
| 8    | Phase E (IndexedDB doc)                                        | Nothing (any time)          |

---

## Verification

1. `bun run lint` clean.
2. `bun run build` compiles with no type errors — confirms DTO types flow end-to-end.
3. Signed-out user visiting `/dashboard` is redirected to `/sign-in`.
4. Sign in → auto-lands on `/dashboard`; navbar shows Dashboard link.
5. Upload from dashboard → ghost row + progress → real row + thumbnail; total grows.
6. Scroll past visible rows → next page fetched (verify in React Query devtools).
7. Rename inline → optimistic update; refresh persists.
8. Delete → confirm modal → row disappears optimistically; rolls back on simulated 500.
9. Open → editor loads PDF; Save → success toast; `updatedAt` bumps in dashboard list.
10. Export → browser downloads, **no** server call (Network tab).
11. `/tools/pdf-to-excel` drop a PDF → uploaded and editor opens with the file.
12. Token expiry — clear Clerk session in another tab → on next request, interceptor refresh path kicks in or signs out.
13. Dashboard route bundle does **not** include `pdf-lib` (lazy-loaded only inside the editor's Save/Export path).

---

## Decisions

- **Auth:** Clerk JWT in `Authorization: Bearer` via axios request interceptor; 401 retry-once-then-sign-out.
- **HTTP client:** axios (new dep). Single instance. `onUploadProgress` for upload UI.
- **Document shape:** assumed shape (`id, name, size, mimeType, pageCount?, createdAt, updatedAt`) is the source of truth until backend swagger is updated.
- **Download:** presigned S3 URL response (`{ url, expiresAt }`).
- **Pagination:** `useInfiniteQuery`, `pageSize = 20`, `IntersectionObserver` sentinel.
- **Thumbnails:** real pdf.js render of page 1, lazy + cached by `${id}:${updatedAt}`.
- **Layout:** sidebar (My Documents, Recents) + dense table.
- **Actions v1:** Open, Download, Rename, Delete.
- **Toasts:** HeroUI `addToast` via thin wrapper.
- **Tools pages:** alternate upload entry points → upload then route to editor. Conversion endpoints out of scope.
- **IndexedDB:** brainstorm/document only; no code this milestone.
- **Existing `/tools/*` static pages remain mounted**; only the upload section behavior changes.
