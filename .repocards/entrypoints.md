# Entrypoints

Files where execution begins — servers, CLIs, library public API, scripts.

## `app/layout.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 75

**Exports:**

- `const` **metadata** — [`app/layout.tsx:23`](../app/layout.tsx#L23)
- `const` **viewport** — [`app/layout.tsx:36`](../app/layout.tsx#L36)
- `function` **RootLayout** — [`app/layout.tsx:43`](../app/layout.tsx#L43)

**Imports 1 local file:**

- `app/providers.tsx`

## `lib/providers/app-providers.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 32

**Exports:**

- `function` **AppProviders** — [`lib/providers/app-providers.tsx:19`](../lib/providers/app-providers.tsx#L19)

**Imports 1 local file:**

- `lib/providers/query-provider.tsx`

## `app/share/[token]/page.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 117

**Exports:**

- `const` **dynamic** — [`app/share/[token]/page.tsx:9`](../app/share/[token]/page.tsx#L9)
- `const` **revalidate** — [`app/share/[token]/page.tsx:10`](../app/share/[token]/page.tsx#L10)
- `const` **runtime** — [`app/share/[token]/page.tsx:11`](../app/share/[token]/page.tsx#L11)
- `const` **metadata** — [`app/share/[token]/page.tsx:13`](../app/share/[token]/page.tsx#L13)
- `function` **SharePage** — [`app/share/[token]/page.tsx:58`](../app/share/[token]/page.tsx#L58)

**Imports 2 local files:**

- `app/share/[token]/PasswordGate.tsx`
- `app/share/[token]/ViewerClient.tsx`

## `components/sections/dashboard/dashboard-home.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 137

**Exports:**

- `function` **DashboardHome** — [`components/sections/dashboard/dashboard-home.tsx:90`](../components/sections/dashboard/dashboard-home.tsx#L90)

**Imports 2 local files:**

- `components/sections/dashboard/documents-table.tsx`
- `components/sections/dashboard/upload-cta.tsx`

## `components/sections/dashboard/dashboard-shell.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 266

**Exports:**

- `function` **DashboardShell** — [`components/sections/dashboard/dashboard-shell.tsx:137`](../components/sections/dashboard/dashboard-shell.tsx#L137)

**Imports 1 local file:**

- `components/sections/dashboard/identity-popover.tsx`

## `components/sections/home/home-hero.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 148

**Exports:**

- `function` **HomeHero** — [`components/sections/home/home-hero.tsx:22`](../components/sections/home/home-hero.tsx#L22)

**Imports 2 local files:**

- `components/sections/home/home-cloud-upload-row.tsx`
- `components/sections/home/home-stats.tsx`

## `components/sections/pdf-editor/PdfEditorShell.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 322

**Exports:**

- `function` **PdfEditorShell** — [`components/sections/pdf-editor/PdfEditorShell.tsx:277`](../components/sections/pdf-editor/PdfEditorShell.tsx#L277)

**Imports 14 local files:**

- `components/sections/pdf-editor/BottomDock.tsx`
- `components/sections/pdf-editor/CompressModal.tsx`
- `components/sections/pdf-editor/CreatePdfModal.tsx`
- `components/sections/pdf-editor/FindReplaceModal.tsx`
- `components/sections/pdf-editor/FormFieldsModal.tsx`
- `components/sections/pdf-editor/PageNumbersModal.tsx`
- `components/sections/pdf-editor/PasswordModal.tsx`
- `components/sections/pdf-editor/EditorTopBar.tsx`
- `components/sections/pdf-editor/EditorLoadingShell.tsx`
- `components/sections/pdf-editor/PdfViewerCanvas.tsx`
- `components/sections/pdf-editor/PerformancePanel.tsx`
- `components/sections/pdf-editor/RightSidebar.tsx`
- `components/sections/pdf-editor/ManagePagesModal.tsx`
- `components/sections/pdf-editor/ThumbnailSidebar.tsx`

## `components/ui/file-upload/file-upload.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 195

**Exports:**

- `function` **FileUpload** — [`components/ui/file-upload/file-upload.tsx:23`](../components/ui/file-upload/file-upload.tsx#L23)

**Imports 3 local files:**

- `components/ui/file-upload/file-upload-dropzone-marketing.tsx`
- `components/ui/file-upload/file-upload-dropzone.tsx`
- `components/ui/file-upload/file-upload-preview.tsx`

## `components/ui/form/controlled-input-field.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 95

**Exports:**

- `function` **ControlledInputField** — [`components/ui/form/controlled-input-field.tsx:27`](../components/ui/form/controlled-input-field.tsx#L27)

**Imports 1 local file:**

- `components/ui/form/password-reveal-toggle.tsx`

## `components/ui/upload-toast/UploadToastProvider.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 93

**Exports:**

- `function` **UploadToastProvider** — [`components/ui/upload-toast/UploadToastProvider.tsx:28`](../components/ui/upload-toast/UploadToastProvider.tsx#L28)

**Imports 1 local file:**

- `components/ui/upload-toast/UploadToastRenderer.tsx`

## `lib/client/upload-toasts/controller.ts`

**Reason:** no-incoming-imports · **Language:** ts · **LOC:** 103

**Exports:**

- `type` **StartUploadToastInput** — [`lib/client/upload-toasts/controller.ts:10`](../lib/client/upload-toasts/controller.ts#L10)
- `const` **uploadToasts** — [`lib/client/upload-toasts/controller.ts:24`](../lib/client/upload-toasts/controller.ts#L24)

**Imports 1 local file:**

- `lib/client/upload-toasts/queue.ts`

## `lib/client/hooks/upload/use-upload-with-duplicate-check.ts`

**Reason:** no-incoming-imports · **Language:** ts · **LOC:** 99

**Exports:**

- `type` **DuplicatePrompt** — [`lib/client/hooks/upload/use-upload-with-duplicate-check.ts:21`](../lib/client/hooks/upload/use-upload-with-duplicate-check.ts#L21)
- `function` **useUploadWithDuplicateCheck** — [`lib/client/hooks/upload/use-upload-with-duplicate-check.ts:44`](../lib/client/hooks/upload/use-upload-with-duplicate-check.ts#L44)
- `type` **UseUploadWithDuplicateCheck** — [`lib/client/hooks/upload/use-upload-with-duplicate-check.ts:96`](../lib/client/hooks/upload/use-upload-with-duplicate-check.ts#L96)

**Imports 1 local file:**

- `lib/client/hooks/upload/use-tracked-upload.ts`

## npm scripts

- `npm run dev` → `next dev --turbopack`
- `npm run build` → `next build`
- `npm run start` → `next start`
- `npm run lint` → `eslint --fix`
- `npm run test:e2e` → `playwright test`
- `npm run test:e2e:ui` → `playwright test --ui`
- `npm run test:e2e:report` → `playwright show-report`
