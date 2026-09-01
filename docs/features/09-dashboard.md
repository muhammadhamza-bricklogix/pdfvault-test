# 09 — Dashboard

**Snapshot date:** 2026-09-01
**Route:** `/dashboard` (+ subroutes under `/dashboard/*`)

## Shell composition

`components/sections/dashboard/dashboard-shell.tsx` composes:

- `components/sections/dashboard/pv-page-header.tsx` — page title + actions
- `components/sections/dashboard/pv-quick-tool-cards.tsx` — quick tool grid
- `components/sections/dashboard/pv-search-toolbar.tsx` — search + filters
- `components/sections/dashboard/documents-table.tsx` (a.k.a. `pv-file-table.tsx`) — main file table
- `components/sections/dashboard/pending-conversion-banner.tsx` — placeholder rows for background X→PDF conversions (see [`05-uploads-conversions.md`](./05-uploads-conversions.md))
- `components/sections/dashboard/upload-cta.tsx` — upload dropzone

## Documents table

`documents-table.tsx` — main file table.

- Server state via TanStack Query key `documentKeys.lists()`
- Placeholder rows driven by `pending-conversions-store`
- Row actions in `document-actions-menu.tsx`

## Row actions

`components/sections/dashboard/document-actions-menu.tsx`:

- **Open** — navigates to editor (`/pdf-composer?id=…`); passes through `gateEntitledAction`
- **Download** — direct download; passes through `gateEntitledAction`
- **Rename** — opens `rename-document-modal.tsx`
- **Delete** — opens `delete-document-modal.tsx`
- **Bulk delete** — `bulk-delete-documents-modal.tsx` from toolbar
- **W-9 suppression** — Delete + Rename are suppressed on W-9 documents (canonical filename enforcement; see [`07-w9-editor.md`](./07-w9-editor.md))

## Entitlement gate

`gateEntitledAction(doc)`:

- Returns `true` for native PDF uploads (`originalContentType == null`) — free
- Triggers paywall for converted PDFs (`originalContentType != null`) — non-subscribed users see paywall

## Duplicate upload

`duplicate-upload-modal.tsx` — surfaced by `findDuplicateByFilename` before every `documentsService.uploadDocument`.

## Doc picker

`doc-picker-modal.tsx` — picker for merge / split tools that pull from the user's library.

## Sidebar + identity

- `components/sections/dashboard/identity-popover.tsx` — user identity + sign-out
- Settings routes:
  - `/dashboard/settings/general` — profile
  - `/dashboard/settings/account` — account settings
  - `/dashboard/settings/language` — locale + Weglot toggle
  - `/dashboard/settings/billing` — plan + invoices (see [`08-billing-paywall.md`](./08-billing-paywall.md))
  - `/dashboard/settings/danger` — delete account + destructive actions

## Forms tab

`/dashboard/forms` → `pv-forms-grid.tsx` — currently W-9 only. `ROUTES.FORMS` also defines W-4, 1099-NEC, W-7 for future rollout.

## Activity feed

`/dashboard/activity` → `activity-feed.tsx` — recent user activity (uploads, edits, shares).

## Related files

| File | Role |
|---|---|
| `components/sections/dashboard/dashboard-shell.tsx` | Shell root |
| `components/sections/dashboard/dashboard-home.tsx` | Home content |
| `components/sections/dashboard/documents-table.tsx` | File table |
| `components/sections/dashboard/document-actions-menu.tsx` | Row actions + entitlement gate |
| `components/sections/dashboard/document-thumbnail.tsx` | Row thumbnail |
| `components/sections/dashboard/rename-document-modal.tsx` | Rename |
| `components/sections/dashboard/delete-document-modal.tsx` | Delete |
| `components/sections/dashboard/bulk-delete-documents-modal.tsx` | Bulk delete |
| `components/sections/dashboard/duplicate-upload-modal.tsx` | Duplicate detection UI |
| `components/sections/dashboard/pending-conversion-banner.tsx` | Placeholder row banner |
| `components/sections/dashboard/upload-cta.tsx` | Upload dropzone |
| `components/sections/dashboard/pv-quick-tool-cards.tsx` | Quick tool grid |
| `components/sections/dashboard/pv-search-toolbar.tsx` | Search + filters |
| `components/sections/dashboard/pv-forms-grid.tsx` | Forms tab (W-9) |
| `components/sections/dashboard/pv-tools-grid.tsx` | Tools tab |
| `components/sections/dashboard/activity-feed.tsx` | Activity page |
| `components/sections/dashboard/identity-popover.tsx` | Identity |
| `components/sections/dashboard/settings/settings-nav.tsx` | Settings nav |
| `components/sections/dashboard/settings/billing-settings-section.tsx` | Billing tab content |

## Related

- [`05-uploads-conversions.md`](./05-uploads-conversions.md) — placeholder rows + duplicate check
- [`06-pdf-editor.md`](./06-pdf-editor.md) — Open action target
- [`07-w9-editor.md`](./07-w9-editor.md) — W-9 delete/rename suppression
- [`08-billing-paywall.md`](./08-billing-paywall.md) — entitlement gate + billing settings
