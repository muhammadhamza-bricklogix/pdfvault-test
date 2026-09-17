# Entrypoints

Files where execution begins — servers, CLIs, library public API, scripts.

## `app/layout.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 345

**Exports:**

- `function` **generateMetadata** — [`app/layout.tsx:88`](../app/layout.tsx#L88)
- `const` **viewport** — [`app/layout.tsx:141`](../app/layout.tsx#L141)
- `function` **RootLayout** — [`app/layout.tsx:148`](../app/layout.tsx#L148)

**Imports 1 local file:**

- `app/providers.tsx`

## `app/(tools)/layout.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 84

**Exports:**

- `function` **ToolsLayout** — [`app/(tools)/layout.tsx:66`](../app/(tools)/layout.tsx#L66)

**Imports 1 local file:**

- `app/(tools)/tools-font-body-effect.tsx`

## `lib/providers/app-providers.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 62

**Exports:**

- `function` **AppProviders** — [`lib/providers/app-providers.tsx:30`](../lib/providers/app-providers.tsx#L30)

**Imports 1 local file:**

- `lib/providers/query-provider.tsx`

## `app/share/[token]/page.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 94

**Exports:**

- `const` **dynamic** — [`app/share/[token]/page.tsx:8`](../app/share/[token]/page.tsx#L8)
- `const` **revalidate** — [`app/share/[token]/page.tsx:9`](../app/share/[token]/page.tsx#L9)
- `const` **runtime** — [`app/share/[token]/page.tsx:10`](../app/share/[token]/page.tsx#L10)
- `const` **metadata** — [`app/share/[token]/page.tsx:12`](../app/share/[token]/page.tsx#L12)
- `function` **SharePage** — [`app/share/[token]/page.tsx:42`](../app/share/[token]/page.tsx#L42)

**Imports 2 local files:**

- `app/share/[token]/PasswordGate.tsx`
- `app/share/[token]/ViewerClient.tsx`

## `components/sections/auth/forgot-password-screen.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 49

**Exports:**

- `function` **ForgotPasswordScreen** — [`components/sections/auth/forgot-password-screen.tsx:16`](../components/sections/auth/forgot-password-screen.tsx#L16)

**Imports 1 local file:**

- `components/sections/auth/forgot-password-card.tsx`

## `components/sections/auth/login-screen.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 47

**Exports:**

- `function` **LoginScreen** — [`components/sections/auth/login-screen.tsx:14`](../components/sections/auth/login-screen.tsx#L14)

**Imports 1 local file:**

- `components/sections/auth/login-card.tsx`

## `components/sections/auth/signup-screen.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 47

**Exports:**

- `function` **SignupScreen** — [`components/sections/auth/signup-screen.tsx:14`](../components/sections/auth/signup-screen.tsx#L14)

**Imports 1 local file:**

- `components/sections/auth/signup-card.tsx`

## `components/sections/billing/PaywallProvider.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 69

**Exports:**

- `function` **PaywallProvider** — [`components/sections/billing/PaywallProvider.tsx:32`](../components/sections/billing/PaywallProvider.tsx#L32)
- `function` **usePaywallGuard** — [`components/sections/billing/PaywallProvider.tsx:58`](../components/sections/billing/PaywallProvider.tsx#L58)

**Imports 1 local file:**

- `components/sections/billing/PaywallModal.tsx`

## `components/sections/forms/FormEditor.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 373

**Exports:**

- `function` **FormEditor** — [`components/sections/forms/FormEditor.tsx:38`](../components/sections/forms/FormEditor.tsx#L38)

**Imports 5 local files:**

- `components/sections/forms/FormCanvas.tsx`
- `components/sections/forms/FinalizeModal.tsx`
- `components/sections/forms/SignatureModal.tsx`
- `components/sections/forms/FormFieldOverlay.tsx`
- `components/sections/forms/FormSidebar.tsx`

## `components/sections/forms/W9FormFieldsPortal.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 159

**Exports:**

- `function` **W9FormFieldsPortal** — [`components/sections/forms/W9FormFieldsPortal.tsx:33`](../components/sections/forms/W9FormFieldsPortal.tsx#L33)

**Imports 1 local file:**

- `components/sections/forms/FormCanvas.tsx`

## `components/sections/forms/W9LandingContent.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 493

**Exports:**

- `function` **W9LandingContent** — [`components/sections/forms/W9LandingContent.tsx:208`](../components/sections/forms/W9LandingContent.tsx#L208)
- `function` **buildW9JsonLd** — [`components/sections/forms/W9LandingContent.tsx:446`](../components/sections/forms/W9LandingContent.tsx#L446)

**Imports 1 local file:**

- `components/sections/forms/w9-faq.tsx`

## `components/sections/dashboard/dashboard-home.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 238

**Exports:**

- `function` **DashboardHome** — [`components/sections/dashboard/dashboard-home.tsx:59`](../components/sections/dashboard/dashboard-home.tsx#L59)

**Imports 10 local files:**

- `components/sections/dashboard/pv-mock-my-pdfs.ts`
- `components/sections/dashboard/bulk-delete-documents-modal.tsx`
- `components/sections/dashboard/delete-document-modal.tsx`
- `components/sections/dashboard/doc-picker-modal.tsx`
- `components/sections/dashboard/pending-conversion-banner.tsx`
- `components/sections/dashboard/pv-file-table.tsx`
- `components/sections/dashboard/pv-page-header.tsx`
- `components/sections/dashboard/pv-quick-tool-cards.tsx`
- `components/sections/dashboard/pv-search-toolbar.tsx`
- `components/sections/dashboard/rename-document-modal.tsx`

## `components/sections/dashboard/dashboard-shell.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 398

**Exports:**

- `function` **DashboardShell** — [`components/sections/dashboard/dashboard-shell.tsx:289`](../components/sections/dashboard/dashboard-shell.tsx#L289)

**Imports 1 local file:**

- `components/sections/dashboard/identity-popover.tsx`

## `components/sections/dashboard/documents-table.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 450

**Exports:**

- `function` **DocumentsTable** — [`components/sections/dashboard/documents-table.tsx:72`](../components/sections/dashboard/documents-table.tsx#L72)

**Imports 5 local files:**

- `components/sections/dashboard/bulk-delete-documents-modal.tsx`
- `components/sections/dashboard/delete-document-modal.tsx`
- `components/sections/dashboard/document-actions-menu.tsx`
- `components/sections/dashboard/document-thumbnail.tsx`
- `components/sections/dashboard/rename-document-modal.tsx`

## `components/sections/dashboard/upload-cta.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 58

**Exports:**

- `function` **UploadCta** — [`components/sections/dashboard/upload-cta.tsx:14`](../components/sections/dashboard/upload-cta.tsx#L14)

**Imports 1 local file:**

- `components/sections/dashboard/duplicate-upload-modal.tsx`

## `components/sections/home/home-hero.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 222

**Exports:**

- `function` **HomeHero** — [`components/sections/home/home-hero.tsx:25`](../components/sections/home/home-hero.tsx#L25)

**Imports 2 local files:**

- `components/sections/home/home-cloud-upload-row.tsx`
- `components/sections/home/home-stats.tsx`

## `components/sections/new-landing/all-tools-catalog.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 67

**Exports:**

- `function` **AllToolsCatalog** — [`components/sections/new-landing/all-tools-catalog.tsx:21`](../components/sections/new-landing/all-tools-catalog.tsx#L21)

**Imports 1 local file:**

- `components/sections/new-landing/all-tools-icon.tsx`

## `components/sections/new-landing/landing-hero.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 30

**Exports:**

- `function` **LandingHero** — [`components/sections/new-landing/landing-hero.tsx:3`](../components/sections/new-landing/landing-hero.tsx#L3)

**Imports 1 local file:**

- `components/sections/new-landing/upload-workspace.tsx`

## `components/sections/new-landing/landing-steps.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 69

**Exports:**

- `function` **LandingSteps** — [`components/sections/new-landing/landing-steps.tsx:29`](../components/sections/new-landing/landing-steps.tsx#L29)

**Imports 1 local file:**

- `components/sections/new-landing/section-heading.tsx`

## `components/sections/new-landing/landing-testimonials.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 77

**Exports:**

- `function` **LandingTestimonials** — [`components/sections/new-landing/landing-testimonials.tsx:21`](../components/sections/new-landing/landing-testimonials.tsx#L21)

**Imports 2 local files:**

- `components/sections/new-landing/section-heading.tsx`
- `components/sections/new-landing/trustpilot-widget.tsx`

## `components/sections/new-landing/landing-tools.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 482

**Exports:**

- `function` **LandingTools** — [`components/sections/new-landing/landing-tools.tsx:318`](../components/sections/new-landing/landing-tools.tsx#L318)

**Imports 1 local file:**

- `components/sections/new-landing/section-heading.tsx`

## `components/sections/new-landing/tool-landing-page.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 63

**Exports:**

- `function` **ToolLandingPage** — [`components/sections/new-landing/tool-landing-page.tsx:31`](../components/sections/new-landing/tool-landing-page.tsx#L31)

**Imports 3 local files:**

- `components/sections/new-landing/landing-footer.tsx`
- `components/sections/new-landing/landing-header.tsx`
- `components/sections/new-landing/upload-workspace.tsx`

## `components/sections/pdf-editor/ManagePagesModal.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 620

**Exports:**

- `function` **ManagePagesModal** — [`components/sections/pdf-editor/ManagePagesModal.tsx:274`](../components/sections/pdf-editor/ManagePagesModal.tsx#L274)

**Imports 2 local files:**

- `components/sections/pdf-editor/PageResizeDialog.tsx`
- `components/sections/pdf-editor/ThumbnailSidebar.tsx`

## `components/sections/pdf-editor/MergeModalHost.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 34

**Exports:**

- `function` **MergeModalHost** — [`components/sections/pdf-editor/MergeModalHost.tsx:17`](../components/sections/pdf-editor/MergeModalHost.tsx#L17)

**Imports 1 local file:**

- `components/sections/pdf-editor/MergePdfModal.tsx`

## `components/sections/pdf-editor/PdfEditorShell.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 715

**Exports:**

- `function` **PdfEditorShell** — [`components/sections/pdf-editor/PdfEditorShell.tsx:415`](../components/sections/pdf-editor/PdfEditorShell.tsx#L415)

**Imports 8 local files:**

- `components/sections/pdf-editor/BottomDock.tsx`
- `components/sections/pdf-editor/EditorTopBar.tsx`
- `components/sections/pdf-editor/EditorLoadingShell.tsx`
- `components/sections/pdf-editor/PdfSearchBar.tsx`
- `components/sections/pdf-editor/PdfViewerCanvas.tsx`
- `components/sections/pdf-editor/PvEditorTopChrome.tsx`
- `components/sections/pdf-editor/RightSidebar.tsx`
- `components/sections/pdf-editor/ThumbnailSidebar.tsx`

## `components/sections/pdf-editor/VersionHistoryModalHost.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 59

**Exports:**

- `function` **VersionHistoryModalHost** — [`components/sections/pdf-editor/VersionHistoryModalHost.tsx:32`](../components/sections/pdf-editor/VersionHistoryModalHost.tsx#L32)

**Imports 1 local file:**

- `components/sections/pdf-editor/VersionHistoryModal.tsx`

## `components/shared/navigation/site-navbar.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 300

**Exports:**

- `function` **SiteNavbar** — [`components/shared/navigation/site-navbar.tsx:73`](../components/shared/navigation/site-navbar.tsx#L73)

**Imports 1 local file:**

- `components/shared/navigation/language-switcher.tsx`

## `components/ui/form/controlled-input-field.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 95

**Exports:**

- `function` **ControlledInputField** — [`components/ui/form/controlled-input-field.tsx:27`](../components/ui/form/controlled-input-field.tsx#L27)

**Imports 1 local file:**

- `components/ui/form/password-reveal-toggle.tsx`

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

## `lib/client/offline/doc-cache.ts`

**Reason:** no-incoming-imports · **Language:** ts · **LOC:** 124

**Exports:**

- `type` **CachedDocument** — [`lib/client/offline/doc-cache.ts:12`](../lib/client/offline/doc-cache.ts#L12)
- `function` **replaceDocumentList** — [`lib/client/offline/doc-cache.ts:29`](../lib/client/offline/doc-cache.ts#L29)
- `function` **readCachedDocumentList** — [`lib/client/offline/doc-cache.ts:66`](../lib/client/offline/doc-cache.ts#L66)
- `function` **readCachedDocument** — [`lib/client/offline/doc-cache.ts:89`](../lib/client/offline/doc-cache.ts#L89)
- `function` **upsertCachedDocument** — [`lib/client/offline/doc-cache.ts:111`](../lib/client/offline/doc-cache.ts#L111)

**Imports 1 local file:**

- `lib/client/offline/idb-client.ts`

## `lib/client/offline/pdf-bytes-cache.ts`

**Reason:** no-incoming-imports · **Language:** ts · **LOC:** 163

**Exports:**

- `function` **putPdfBytes** — [`lib/client/offline/pdf-bytes-cache.ts:25`](../lib/client/offline/pdf-bytes-cache.ts#L25)
- `function` **readPdfBytes** — [`lib/client/offline/pdf-bytes-cache.ts:132`](../lib/client/offline/pdf-bytes-cache.ts#L132)
- `function` **deletePdfBytes** — [`lib/client/offline/pdf-bytes-cache.ts:150`](../lib/client/offline/pdf-bytes-cache.ts#L150)

**Imports 1 local file:**

- `lib/client/offline/idb-client.ts`

## `lib/client/pdf-editor/verify-pdf-password.ts`

**Reason:** no-incoming-imports · **Language:** ts · **LOC:** 69

**Exports:**

- `type` **VerifyPasswordResult** — [`lib/client/pdf-editor/verify-pdf-password.ts:4`](../lib/client/pdf-editor/verify-pdf-password.ts#L4)
- `function` **verifyPdfPassword** — [`lib/client/pdf-editor/verify-pdf-password.ts:23`](../lib/client/pdf-editor/verify-pdf-password.ts#L23)

**Imports 2 local files:**

- `lib/client/pdf-editor/load-pdfjs.ts`
- `lib/client/pdf-editor/pdfjs-worker.ts`

## `lib/client/tour/use-product-tour.ts`

**Reason:** no-incoming-imports · **Language:** ts · **LOC:** 172

**Exports:**

- `const` **TOUR_ENDED_EVENT** — [`lib/client/tour/use-product-tour.ts:23`](../lib/client/tour/use-product-tour.ts#L23)
- `function` **willTourAutoLaunch** — [`lib/client/tour/use-product-tour.ts:32`](../lib/client/tour/use-product-tour.ts#L32)
- `function` **useProductTour** — [`lib/client/tour/use-product-tour.ts:66`](../lib/client/tour/use-product-tour.ts#L66)

**Imports 1 local file:**

- `lib/client/tour/tour-config.ts`

## `lib/client/upload-toasts/controller.ts`

**Reason:** no-incoming-imports · **Language:** ts · **LOC:** 103

**Exports:**

- `type` **StartUploadToastInput** — [`lib/client/upload-toasts/controller.ts:10`](../lib/client/upload-toasts/controller.ts#L10)
- `const` **uploadToasts** — [`lib/client/upload-toasts/controller.ts:24`](../lib/client/upload-toasts/controller.ts#L24)

**Imports 1 local file:**

- `lib/client/upload-toasts/queue.ts`

## `lib/server/share/password.ts`

**Reason:** no-incoming-imports · **Language:** ts · **LOC:** 87

**Exports:**

- `function` **hashPassword** — [`lib/server/share/password.ts:23`](../lib/server/share/password.ts#L23)
- `function` **verifyPassword** — [`lib/server/share/password.ts:27`](../lib/server/share/password.ts#L27)
- `interface` **PasswordStore** — [`lib/server/share/password.ts:45`](../lib/server/share/password.ts#L45)
- `const` **passwordStore** — [`lib/server/share/password.ts:86`](../lib/server/share/password.ts#L86)

**Imports 1 local file:**

- `lib/server/share/fs-store-base.ts`

## `lib/server/share/resolve-share.ts`

**Reason:** no-incoming-imports · **Language:** ts · **LOC:** 57

**Exports:**

- `type` **ResolveShareResult** — [`lib/server/share/resolve-share.ts:5`](../lib/server/share/resolve-share.ts#L5)
- `function` **resolveShare** — [`lib/server/share/resolve-share.ts:30`](../lib/server/share/resolve-share.ts#L30)

**Imports 3 local files:**

- `lib/server/share/bytes-store.ts`
- `lib/server/share/deny-list.ts`
- `lib/server/share/sign-token.ts`

## `lib/client/utils/trigger-document-download.ts`

**Reason:** no-incoming-imports · **Language:** ts · **LOC:** 54

**Exports:**

- `function` **triggerDocumentDownload** — [`lib/client/utils/trigger-document-download.ts:22`](../lib/client/utils/trigger-document-download.ts#L22)

**Imports 1 local file:**

- `lib/client/utils/gate-entitled-action.ts`

## `lib/shared/constants/tool-routes.ts`

**Reason:** no-incoming-imports · **Language:** ts · **LOC:** 62

**Exports:**

- `type` **EditorToolSlug** — [`lib/shared/constants/tool-routes.ts:14`](../lib/shared/constants/tool-routes.ts#L14)
- `const` **TOOL_ROUTE** — [`lib/shared/constants/tool-routes.ts:48`](../lib/shared/constants/tool-routes.ts#L48)

**Imports 1 local file:**

- `lib/shared/constants/routes.ts`

## `lib/shared/utils/sentry.ts`

**Reason:** no-incoming-imports · **Language:** ts · **LOC:** 67

**Exports:**

- `function` **setSentryUser** — [`lib/shared/utils/sentry.ts:24`](../lib/shared/utils/sentry.ts#L24)
- `function` **getOrCreateSessionId** — [`lib/shared/utils/sentry.ts:36`](../lib/shared/utils/sentry.ts#L36)
- `function` **attachSessionIdTag** — [`lib/shared/utils/sentry.ts:60`](../lib/shared/utils/sentry.ts#L60)

**Imports 1 local file:**

- `lib/shared/utils/logger.ts`

## `components/sections/dashboard/settings/billing-settings-section.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 582

**Exports:**

- `function` **BillingSettingsSection** — [`components/sections/dashboard/settings/billing-settings-section.tsx:34`](../components/sections/dashboard/settings/billing-settings-section.tsx#L34)

**Imports 1 local file:**

- `components/sections/dashboard/settings/pv-settings-primitives.tsx`

## `components/sections/forms/fields/ConditionalField.tsx`

**Reason:** no-incoming-imports · **Language:** tsx · **LOC:** 26

**Exports:**

- `function` **ConditionalField** — [`components/sections/forms/fields/ConditionalField.tsx:19`](../components/sections/forms/fields/ConditionalField.tsx#L19)

**Imports 2 local files:**

- `components/sections/forms/fields/types.ts`
- `components/sections/forms/visibility.ts`

## `lib/client/hooks/billing/ensure-entitlement.ts`

**Reason:** no-incoming-imports · **Language:** ts · **LOC:** 53

**Exports:**

- `function` **ensureFreshEntitlement** — [`lib/client/hooks/billing/ensure-entitlement.ts:31`](../lib/client/hooks/billing/ensure-entitlement.ts#L31)

**Imports 1 local file:**

- `lib/client/hooks/billing/entitlement-cache.ts`

## `lib/client/hooks/billing/use-paywall.ts`

**Reason:** no-incoming-imports · **Language:** ts · **LOC:** 193

**Exports:**

- `function` **usePaywall** — [`lib/client/hooks/billing/use-paywall.ts:33`](../lib/client/hooks/billing/use-paywall.ts#L33)

**Imports 3 local files:**

- `lib/client/hooks/billing/paywall-bus.ts`
- `lib/client/hooks/billing/entitlement-cache.ts`
- `lib/client/hooks/billing/use-entitlement-allowlist.ts`

## `lib/client/hooks/upload/use-upload-with-duplicate-check.ts`

**Reason:** no-incoming-imports · **Language:** ts · **LOC:** 134

**Exports:**

- `type` **DuplicatePrompt** — [`lib/client/hooks/upload/use-upload-with-duplicate-check.ts:26`](../lib/client/hooks/upload/use-upload-with-duplicate-check.ts#L26)
- `function` **findDuplicateByFilename** — [`lib/client/hooks/upload/use-upload-with-duplicate-check.ts:37`](../lib/client/hooks/upload/use-upload-with-duplicate-check.ts#L37)
- `function` **useUploadWithDuplicateCheck** — [`lib/client/hooks/upload/use-upload-with-duplicate-check.ts:64`](../lib/client/hooks/upload/use-upload-with-duplicate-check.ts#L64)
- `type` **UseUploadWithDuplicateCheck** — [`lib/client/hooks/upload/use-upload-with-duplicate-check.ts:131`](../lib/client/hooks/upload/use-upload-with-duplicate-check.ts#L131)

**Imports 1 local file:**

- `lib/client/hooks/upload/use-tracked-upload.ts`

## npm scripts

- `npm run dev` → `next dev --turbopack`
- `npm run build` → `next build`
- `npm run start` → `next start`
- `npm run start:prod` → `node server.js`
- `npm run analyze` → `ANALYZE=true next build`
- `npm run lint` → `eslint --fix`
- `npm run test:e2e` → `playwright test`
- `npm run test:e2e:ui` → `playwright test --ui`
- `npm run test:e2e:report` → `playwright show-report`
