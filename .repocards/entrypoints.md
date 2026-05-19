# Entrypoints

Files where execution begins — servers, CLIs, library public API, scripts.

## `app/layout.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 70

**Exports:**

- `const` **metadata** — [`app/layout.tsx:23`](../app/layout.tsx#L23)
- `const` **viewport** — [`app/layout.tsx:36`](../app/layout.tsx#L36)
- `function` **RootLayout** — [`app/layout.tsx:43`](../app/layout.tsx#L43)

**Imports 1 local file:**

- `app/providers.tsx`

## `lib/providers/app-providers.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 28

**Exports:**

- `function` **AppProviders** — [`lib/providers/app-providers.tsx:17`](../lib/providers/app-providers.tsx#L17)

**Imports 1 local file:**

- `lib/providers/query-provider.tsx`

## `lib/client/upload-toasts/controller.ts`

**Reason:** no-incoming-imports · **Language:** ts · **LOC:** 103

**Exports:**

- `type` **StartUploadToastInput** — [`lib/client/upload-toasts/controller.ts:10`](../lib/client/upload-toasts/controller.ts#L10)
- `const` **uploadToasts** — [`lib/client/upload-toasts/controller.ts:24`](../lib/client/upload-toasts/controller.ts#L24)

**Imports 1 local file:**

- `lib/client/upload-toasts/queue.ts`

## `components/sections/dashboard/dashboard-home.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 27

**Exports:**

- `function` **DashboardHome** — [`components/sections/dashboard/dashboard-home.tsx:6`](../components/sections/dashboard/dashboard-home.tsx#L6)

**Imports 2 local files:**

- `components/sections/dashboard/documents-table.tsx`
- `components/sections/dashboard/upload-cta.tsx`

## `components/sections/dashboard/dashboard-shell.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 93

**Exports:**

- `function` **DashboardShell** — [`components/sections/dashboard/dashboard-shell.tsx:30`](../components/sections/dashboard/dashboard-shell.tsx#L30)

**Imports 1 local file:**

- `components/sections/dashboard/dashboard-sidebar.tsx`

## `components/sections/home/home-hero.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 115

**Exports:**

- `function` **HomeHero** — [`components/sections/home/home-hero.tsx:18`](../components/sections/home/home-hero.tsx#L18)

**Imports 2 local files:**

- `components/sections/home/home-cloud-upload-row.tsx`
- `components/sections/home/home-stats.tsx`

## `components/sections/pdf-editor/PdfEditorShell.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 172

**Exports:**

- `function` **PdfEditorShell** — [`components/sections/pdf-editor/PdfEditorShell.tsx:131`](../components/sections/pdf-editor/PdfEditorShell.tsx#L131)

**Imports 8 local files:**

- `components/sections/pdf-editor/BottomDock.tsx`
- `components/sections/pdf-editor/CreatePdfModal.tsx`
- `components/sections/pdf-editor/EditorTopBar.tsx`
- `components/sections/pdf-editor/EditorLoadingShell.tsx`
- `components/sections/pdf-editor/PdfViewerCanvas.tsx`
- `components/sections/pdf-editor/PerformancePanel.tsx`
- `components/sections/pdf-editor/RightSidebar.tsx`
- `components/sections/pdf-editor/ThumbnailSidebar.tsx`

## `components/ui/file-upload/file-upload.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 195

**Exports:**

- `function` **FileUpload** — [`components/ui/file-upload/file-upload.tsx:23`](../components/ui/file-upload/file-upload.tsx#L23)

**Imports 3 local files:**

- `components/ui/file-upload/file-upload-dropzone-marketing.tsx`
- `components/ui/file-upload/file-upload-dropzone.tsx`
- `components/ui/file-upload/file-upload-preview.tsx`

## `components/ui/upload-toast/UploadToastProvider.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 93

**Exports:**

- `function` **UploadToastProvider** — [`components/ui/upload-toast/UploadToastProvider.tsx:28`](../components/ui/upload-toast/UploadToastProvider.tsx#L28)

**Imports 1 local file:**

- `components/ui/upload-toast/UploadToastRenderer.tsx`

## npm scripts

- `npm run dev` → `next dev --turbopack`
- `npm run build` → `next build`
- `npm run start` → `next start`
- `npm run lint` → `eslint --fix`
