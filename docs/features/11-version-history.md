# 11 — Version history

**Snapshot date:** 2026-09-01

## What it does

Every save creates a backend-managed version of the document. Users can list past versions, preview them, and restore. Versions are read-only snapshots.

## UI

- `components/sections/pdf-editor/VersionHistoryModal.tsx` — list of versions
- `components/sections/pdf-editor/VersionHistoryModalHost.tsx` — host component
- `components/sections/pdf-editor/VersionPreviewModal.tsx` — preview a specific version

All lazy-loaded via `next/dynamic` from `PdfEditorShell`.

## Version tracking helpers

- `lib/client/pdf-editor/baked-overlay-signature.ts` — hash of baked overlay to detect version drift + de-dupe consecutive saves that produce identical bytes

## Flow

1. User clicks Version History in the editor menu → `VersionHistoryModal` opens.
2. Modal fetches version list from backend (per-document).
3. User selects a version → `VersionPreviewModal` opens with pdf.js render of the historical bytes.
4. User confirms restore → backend swaps the version bytes into the current document → editor reloads.

## Related files

| File | Role |
|---|---|
| `components/sections/pdf-editor/VersionHistoryModal.tsx` | Version list |
| `components/sections/pdf-editor/VersionHistoryModalHost.tsx` | Host |
| `components/sections/pdf-editor/VersionPreviewModal.tsx` | Preview |
| `lib/client/pdf-editor/baked-overlay-signature.ts` | Signature helper |

All are locked (editor lock — see [`16-locked-paths.md`](./16-locked-paths.md)).

## Related

- [`06-pdf-editor.md`](./06-pdf-editor.md) — save pipeline that emits versions
- [`10-share-links.md`](./10-share-links.md) — sharing points at the current version, not history
