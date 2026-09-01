# 05 — Uploads + conversions

**Snapshot date:** 2026-09-01

## Upload pipeline

- `lib/client/hooks/upload/use-tracked-upload.ts` — axios request with `onUploadProgress` pumped into `upload-toasts-store`
- `lib/client/hooks/upload/use-upload-with-duplicate-check.ts` — wraps upload with `findDuplicateByFilename`
- `lib/client/hooks/upload/use-cloud-upload.ts` — signed-in upload used by dashboard + editor
- `lib/client/stores/upload-toasts-store.ts` — global upload state
- `components/ui/upload-toast/UploadToastProvider.tsx` — `placement="bottom start"` chip host

**Do not switch back to `toast.loading`** — that shows top-right with no progress bar; the current UX is bottom-left with filename + live %.

## Conversion routing (`CONVERT_ROUTES`)

Source of truth: `lib/shared/constants/convert-routes.ts`. Every `/convert/<slug>` route is defined there with `title`, `description`, `accept`, and optional `exportFormat`.

### Currently enabled (2026-09-01)

**X → PDF** (no `exportFormat`, uploads original + backend converts):

- `file-to-pdf` — generic X→PDF (accepts doc, docx, jpg, jpeg, png)
- `word-to-pdf` — doc, docx
- `png-to-pdf` — png
- `jpg-to-pdf` — jpg, jpeg

**PDF → X** (`exportFormat` set, opens editor + auto-exports):

- `pdf-to-word` → docx
- `pdf-to-png` → png
- `pdf-to-jpg` → jpg

### Currently hidden

- Excel + PowerPoint conversions (xls, xlsx, ppt, pptx) — hidden 2026-08-28 pending pipeline work
- GIF + HTML + TXT conversions — hidden 2026-08-29 (PM: PDF / Word / PNG / JPG only)
- `pdf-to-html`, `pdf-to-text` — hidden 2026-08-29

Everything is **commented, not deleted** — routes + backend intact for future re-enable. See [`../../.claude/memory/project_xlsx_pptx_hidden.md`](../../.claude/memory/project_xlsx_pptx_hidden.md).

## Post-signin branching in `UploadWorkspace`

The behavior after a signed-out user drops a file on a `/convert/[slug]` route depends on the direction. Source: `components/sections/new-landing/upload-workspace.tsx` (auth-gated on `pathname.startsWith("/convert/")`).

### X→PDF path

1. Register the file in `usePendingConversionsStore` (client-only tempId).
2. Fire `runPendingConversion(tempId, file)` as a **module-scope** background promise (survives component unmount).
3. `router.push('/dashboard')` immediately. Upload workspace shows NO toast.
4. Dashboard renders a "Preparing your document…" placeholder row driven by the store.
5. Runner sends the **original file** (not a pre-converted PDF) to `POST /documents/upload`. Backend handles X→PDF internally + persists `originalContentType = <source mime>` on the Document row.
6. When runner finishes: invalidate `documentKeys.lists()`. Placeholder swaps for real row on refetch.

**Do NOT** re-add client-side `uploadAsPdf` in `runPendingConversion` — sending a pre-converted PDF makes the backend set `originalContentType = null` (looks like a native upload), defeating the paywall distinction on the dashboard row.

### PDF→X path

1. NO early paywall.
2. Save + open editor with `?export=<format>`.
3. `useExportEditor` (auth chain items 1–4) triggers the paywall at auto-export time.

## Module-scope conversion runner

- `lib/client/upload/run-pending-conversion.ts` — the runner
- `lib/client/stores/pending-conversions-store.ts` — placeholder state
- `QueryProvider` calls `setPendingConversionsQueryClient(queryClient)` on mount so the runner can invalidate the docs list from outside React

## Dashboard entitlement gate

`gateEntitledAction(doc)` in `components/sections/dashboard/document-actions-menu.tsx`:

- Returns `true` immediately when `!isConvertedDocument(doc)` (i.e. `doc.originalContentType == null`) — native PDF uploads are free.
- Triggers the paywall for converted PDFs (`originalContentType != null`) when the user isn't subscribed.

The `Document` type carries `originalContentType` and `originalFilename` from the backend DTO. See invariant #17 in [`../../CLAUDE.md`](../../CLAUDE.md).

## Do-not-regress rules

- Do NOT reintroduce a `ensureFreshEntitlement` / `requestPaywall` / `toast.loading("Converting to PDF")` call in the upload-workspace convert branch — the prior version dead-ended users at "Couldn't start checkout" and blocked the source page with a spinner even after the redirect landed.
- `UploadWorkspace` runs `findDuplicateByFilename` before `documentsService.uploadDocument`. Do not remove.
- Post-signin save-first flow pipes `onUploadProgress` into `uploadToasts.setProgress`. Keep the bottom-left placement.
- `AllToolsCatalog` stays server-safe (no props). Landing header watches `usePathname()` and closes the modal on route change. Adding a callback prop back re-tripped Next 16's RSC serialization during `/all-tools` prerender.

## Related files

| File | Role |
|---|---|
| `components/sections/new-landing/upload-workspace.tsx` | Main upload workspace + post-signin branching |
| `lib/client/upload/pending-editor-file.ts` | IDB pending file (signed-out edits) |
| `lib/client/upload/run-pending-conversion.ts` | Module-scope background runner |
| `lib/client/stores/pending-conversions-store.ts` | Placeholder row store |
| `lib/client/stores/upload-toasts-store.ts` | Upload toast state |
| `lib/client/file-conversion/upload-to-pdf.ts` | Extension → conversion mapping |
| `lib/shared/constants/convert-routes.ts` | `CONVERT_ROUTES` source of truth |
| `components/sections/dashboard/document-actions-menu.tsx` | `gateEntitledAction` |
| `components/sections/dashboard/pending-conversion-banner.tsx` | Placeholder row UI |

## Related

- [`02-routes.md`](./02-routes.md) — `/convert/[slug]` route
- [`04-auth.md`](./04-auth.md) — auth-gated redirects
- [`08-billing-paywall.md`](./08-billing-paywall.md) — dashboard paywall gate
- [`09-dashboard.md`](./09-dashboard.md) — placeholder rows + docs table
