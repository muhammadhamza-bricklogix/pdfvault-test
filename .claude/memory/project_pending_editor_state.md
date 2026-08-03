---
name: project-pending-editor-state
description: IDB pending-editor-file record carries file + fabricState + extractedPages so signed-out edits survive the sign-in redirect. Restore MUST run before router.replace on the post-signin path.
metadata: 
  node_type: memory
  type: project
  originSessionId: c529a735-2d03-40d7-bffc-33ce2f4afcb9
---

`lib/client/upload/pending-editor-file.ts` — `PendingRecord` stores three fields for the pre-signin snapshot:
1. `file: File` — the original PDF the user uploaded
2. `fabricState?: Array<[number, string]>` — Map<sourcePage, Fabric JSON> serialized as entries
3. `extractedPages?: number[]` — source page indices whose text is in Fabric IText overlay mode

**Why:** Signed-out users can upload → edit → click Download → sign-in redirect → return to editor. Without persisting `fabricJsonByPage` the edits vanish. Without ALSO persisting `extractedPages`, `PdfViewerCanvas.tsx` computes `suppressText = false` for the restored pages and pdf.js paints native text UNDERNEATH the Fabric IText → visible double text layer.

**How to apply:**
- Any change to `savePendingEditorFile` / `loadPendingEditorFile` must preserve all three fields
- In the hydrator's **post-signin restore path** (`components/shared/pending-editor-file-hydrator.tsx`), the `replaceFabricJsonByPage` + `setState({ extractedPages })` calls MUST run **BEFORE** `router.replace(?id=<newId>)`. The document loader's `setFile`/`setCurrentDocument`/`setState({ hasUnsavedChanges: false })` only patch specific fields — they don't clobber the pre-seeded state — but running the restore AFTER `router.replace` races the loader
- `use-export-editor.ts` must call `flushLiveFabricPage(page, liveCanvas)` before reading `fabricJsonByPage` from the store — otherwise the current page's live canvas state hasn't landed in the store yet
- `components/sections/new-landing/upload-workspace.tsx` also consumes `loadPendingEditorFile()` and expects the new `PendingEditorFileResult` shape (`{ file, fabricJsonByPage, extractedPages }`)

See [[2026-07-30-signout-edit-persistence]] for the full evidence trail and the two-pass debugging that got here.
