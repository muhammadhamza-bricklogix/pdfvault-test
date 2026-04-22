# PDF Editor — Implementation Plan

> **Reference document.** Follow this phase-by-phase. Do not skip ahead.  
> Each phase ends with a working, testable state before the next begins.

---

## Architecture Decisions (Locked)

| Concern | Decision |
|---|---|
| PDF rendering | `pdfjs-dist` — renders original PDF pages to canvas |
| Edit layer | `Fabric.js` — transparent canvas overlay on top of pdf.js render |
| PDF generation | `pdf-lib` — merges Fabric.js edits into PDF binary on client |
| Heavy ops | FastAPI backend — compress, encrypt, redact, watermark, page numbers |
| Page ops (basic) | Client-side via `pdf-lib` — reorder, rotate, add/remove/blank pages |
| Multi-page layout | Thumbnail sidebar (left) + active page (main canvas) |
| Save (mid-edit) | Flatten current edits via pdf-lib → upload merged PDF binary to S3 |
| Export | Upload to S3 via backend → return signed URL → browser downloads |
| Find & Replace | Overlay approach: whiteout rect over original + new text box on top |
| Redact | Paint client-side to preview → backend PyMuPDF burns it permanently |
| Compress | Backend Ghostscript/PyMuPDF — High / Balanced / Light / Custom |
| Password protect | Backend pikepdf — 128/256-bit AES encryption |
| My PDFs list | Integrate with existing PRD backend (user file storage, already in scope) |
| Undo/redo | Client-side Fabric.js JSON state only — no server-side version history |
| Freemium gating | Deferred — implement in a dedicated later phase |

---

## How Editing Works (Core Loop)

```
User uploads PDF
     ↓
pdf.js renders each page → <canvas> elements
     ↓
Fabric.js canvas overlays each page (position: absolute, same dimensions)
     ↓
User edits on Fabric.js layer (text, shapes, draw, etc.)
     ↓
                    ┌─────────────────────────────────┐
                    │  Client-side (pdf-lib) handles:  │
                    │  - Reorder, rotate, add/remove   │
                    │    pages, add blank page          │
                    │  - Merge Fabric.js edits into PDF │
                    │  - Find & Replace (overlay trick) │
                    └─────────────────────────────────┘
                    ┌─────────────────────────────────┐
                    │  Backend (FastAPI) handles:      │
                    │  - Compress (Ghostscript)        │
                    │  - Encrypt/decrypt (pikepdf)     │
                    │  - Redact (PyMuPDF)              │
                    │  - Watermark, page numbers       │
                    │  - Save to S3, signed URL        │
                    └─────────────────────────────────┘
```

**Text editing trick:** To "edit" existing PDF text — draw a white filled rectangle over the original text (erasing it visually), then add a new Fabric.js text box on top. This is the standard browser PDF editor approach.

---

## Phase Overview

| Phase | Name | Outcome |
|---|---|---|
| 1 | Foundation & PDF Viewer | Upload PDF, render pages, thumbnail sidebar, zoom, navigation |
| 2 | Fabric.js Edit Layer | Canvas overlay, text tool + floating toolbar, undo/redo |
| 3 | Drawing & Shapes | Freehand brush, shapes (rect/circle/line/arrow), erase tool |
| 4 | Signature & Image | Signature modal (draw/type/upload), image insertion + placement |
| 5 | Highlight & Whiteout | Text highlight, sticky annotations, whiteout rectangle |
| 6 | Right Sidebar & Layers | Property panel (stroke, fill, opacity, link, position), layers panel |
| 7 | Page Management | Thumbnail drag-reorder, rotate, add/remove/blank pages, split modal |
| 8 | Toolbar & Hamburger Menu | Top toolbar, hamburger menu (My PDFs, New, Open, Save, Export) |
| 9 | Find & Replace | Full-document search, overlay-based replacement |
| 10 | Form Mode | Form field toggle, basic field placement |
| 11 | Save & Export (Backend) | Upload to S3, signed URL download, My PDFs list integration |
| 12 | Heavy Backend Ops | Compress, password protect/unprotect, redact, watermark, page numbers |
| 13 | Hotkeys & Accessibility | Keyboard shortcuts, ARIA roles, focus management |
| 14 | Freemium Gating | Auth checks, file-size caps, export limits per subscription tier |

---

## Phase 1 — Foundation & PDF Viewer

**Goal:** User can upload a PDF, see it rendered page by page, navigate via thumbnail sidebar, and zoom.

### What we build
- Route: `app/(tools)/pdf-editor/page.tsx`
- Layout: left thumbnail sidebar + main viewer area
- `pdfjs-dist` integration — configure worker, render each page to `<canvas>`
- Thumbnail sidebar: small canvas per page, click to jump to page
- Zoom controls: fit-to-width, fit-to-page, custom % (25–400%)
- Page counter: "Page 3 of 12"
- Upload entry point: drag-and-drop or file picker (reuse existing `FileUpload` component)
- Performance: only render pages near the viewport (virtual rendering / intersection observer)

### State shape (Zustand store: `usePdfEditorStore`)
```ts
{
  pdfDocument: PDFDocumentProxy | null,   // loaded pdf.js document
  pageCount: number,
  currentPage: number,
  zoom: number,                           // 1.0 = 100%
  pages: PageState[],                     // per-page metadata
}
```

### Key decisions
- Use `pdfjs-dist` v4.x (matches pdf.js 4 API)
- Worker: load from `pdfjs-dist/build/pdf.worker.min.mjs` via Next.js public dir or CDN
- Canvas resolution: render at `devicePixelRatio * zoom` for crisp display on retina
- Do NOT render all pages at once — use IntersectionObserver to lazy-render

### Done when
- Can upload a 20-page PDF and browse all pages via thumbnail sidebar
- Zoom in/out works without blurring
- No Fabric.js yet

---

## Phase 2 — Fabric.js Edit Layer + Text Tool

**Goal:** Transparent Fabric.js canvas sits over each rendered page. User can add text boxes, move and resize them, undo/redo.

### What we build
- For each active page: mount a `fabric.Canvas` absolutely positioned over the pdf.js canvas, same pixel dimensions
- Text tool: click anywhere on page → creates an `IText` object (inline editable)
- Floating text toolbar (appears when text object selected): font family, size, bold, italic, underline, color, alignment
- Undo/redo: maintain per-page Fabric.js JSON history stack (max 50 states)
- Selection: click to select, multi-select with shift, delete with Backspace/Delete
- White-rectangle eraser for covering existing text (manual step before adding new text)

### State additions
```ts
{
  fabricCanvases: Map<number, fabric.Canvas>,  // keyed by page index
  historyStacks: Map<number, string[]>,         // JSON snapshots per page
  historyIndex: Map<number, number>,
  activeTool: 'select' | 'text' | 'draw' | 'shape' | 'eraser' | 'highlight' | 'signature' | 'image' | 'form',
}
```

### Key decisions
- Use `fabric` v6.x (latest stable, ESM-compatible with Next.js)
- Fabric canvas is only mounted for the **currently active page** to avoid memory issues. When switching pages: serialize current canvas to JSON → store in `Map` → unmount → mount next page canvas → rehydrate from JSON
- Text tool uses `fabric.IText` not `fabric.Textbox` (IText is simpler for single-line labels; Textbox wraps)
- Floating toolbar is absolutely positioned relative to the selected object's bounding box

### Done when
- Can add multiple text boxes to a page
- Can move, resize, delete text boxes
- Undo/redo works within the session
- Switching pages preserves edits on each page

---

## Phase 3 — Drawing & Shapes

**Goal:** Freehand brush, geometric shapes, and eraser tool.

### What we build
- **Freehand draw:** activate `fabric.Canvas.isDrawingMode = true`, expose brush size + color picker
- **Shapes:** click-drag to draw rectangle, circle (ellipse), line, arrow. Each is a Fabric.js object (selectable, resizable after creation)
- **Arrow:** composite Fabric.js `Group` (line + triangle arrowhead)
- **Eraser:** a white-filled rectangle tool (not a real eraser — white rectangle drawn over content, consistent with the overlay model)
- Tool options panel (inline in toolbar): stroke color, fill color, stroke width, opacity

### Key decisions
- Shape creation: mousedown → mousemove → mouseup pattern via Fabric.js events
- After creating a shape, automatically switch to select mode so the user can reposition
- Eraser is not `fabric.EraserBrush` (too experimental) — it is a plain white `fabric.Rect` object

### Done when
- User can draw, place shapes, and cover content with white rectangles
- All drawn objects are selectable and resizable

---

## Phase 4 — Signature & Image Insertion

**Goal:** Signature modal with draw/type/upload tabs. Image insertion from file upload.

### What we build
- **Signature modal** (HeroUI Modal):
  - **Draw tab:** small Fabric.js canvas inside the modal for freehand signature drawing
  - **Type tab:** text input → renders signature-style font (e.g. Dancing Script via Google Fonts)
  - **Upload tab:** reuse `FileUpload` component, accepts PNG/JPG/SVG, shows preview
  - On confirm: converts signature to `fabric.Image` object → placed on main canvas at center → user drags to position
- **Image insertion:**
  - File picker (PNG/JPG/SVG) or drag-and-drop directly onto the canvas
  - Creates a `fabric.Image` object — selectable, resizable with aspect-ratio lock by default, rotatable

### Key decisions
- Signature: export from modal as PNG data URL via `canvas.toDataURL()` → `fabric.Image.fromURL()`
- Images: use `fabric.Image.fromURL(objectURL)` — no upload to backend at this stage
- Signature objects are just images on the canvas — treated identically to inserted images by pdf-lib at export time

### Done when
- User can draw/type/upload signature and place it on the PDF
- User can insert images and resize/reposition them

---

## Phase 5 — Highlight & Annotations

**Goal:** Highlight text on the PDF, add whiteout blocks, sticky note markers.

### What we build
- **Highlight tool:** user clicks and drags over text on the page → creates a semi-transparent `fabric.Rect` (yellow, 40% opacity, no stroke). Non-destructive — the PDF text underneath remains.
- **Whiteout (cover):** same mechanic as eraser from Phase 3 but explicitly labeled "Whiteout" in the toolbar. Opaque white rectangle.
- **Sticky note marker:** clicking the page drops a small sticky-note icon (`fabric.Group` of rect + triangle + text). Clicking the icon opens an inline text popover for the note content. Note content stored as `fabric.Text` hidden inside the group (used for export labeling).

### Key decisions
- Highlight is a Fabric.js `Rect` with `globalCompositeOperation = 'multiply'` for proper highlight blending
- Sticky notes do NOT need to survive export — they are visual markers only (no pdf-lib annotation API used)
- No comment threads, no cloud sync of annotations

### Done when
- User can highlight regions and add whiteout blocks
- Sticky note icon can be placed and edited

---

## Phase 6 — Right Sidebar & Layers Panel

**Goal:** Selection-aware property panel on the right. Full layers panel for Z-order management.

### What we build
- **Right sidebar** (context-sensitive, shows when object is selected):
  - **Position & Size:** X, Y, W, H numeric inputs (live-update selected object)
  - **Background:** fill color picker
  - **Stroke:** color picker + width slider
  - **Opacity:** 0–100% slider
  - **Link:** URL input to attach a hyperlink to any object (stored as object metadata; written as PDF annotation link at export)
  - **Arrange:** bring forward / send backward / bring to front / send to back
- **Layers panel** (collapsible section in sidebar or separate drawer):
  - Lists all Fabric.js objects on the current page by type + icon
  - Click to select, drag to reorder Z-index
  - Eye icon to toggle visibility, lock icon to prevent selection
  - Object name editable inline

### Key decisions
- Sidebar is always visible on the right as a fixed panel (not a floating popover)
- When nothing is selected: sidebar shows page-level properties (page background color if applicable)
- Layers panel uses Fabric.js `canvas.getObjects()` array order for Z-index (index 0 = bottom)
- Visibility toggle: `object.visible = false` — still serialized in JSON, just not rendered or exported

### Done when
- Selecting any object shows correct editable properties in the sidebar
- Layers panel reflects Z-order and reordering works via drag

---

## Phase 7 — Page Management

**Goal:** Full page operations via the thumbnail sidebar and split modal.

### What we build
- **Thumbnail sidebar drag-reorder:** drag a thumbnail to a new position → reorders both the pdf.js pages and Fabric.js state arrays
- **Right-click context menu on thumbnail:** Rotate left, Rotate right, Delete page, Add blank page before/after
- **Add blank page:** insert an empty white page at a given index (pdf-lib `PDFDocument.addPage()`)
- **Split modal** (matches pdfeditor.org UX):
  - **Range mode:** specify page ranges to extract (e.g. "1-3, 5, 7-9") → creates separate PDF files for each range
  - **Pages mode:** split every page into its own PDF
  - Output: each segment is a separate download or batch zip
- **Resize page:** change page dimensions (A4, Letter, custom) — applied via pdf-lib at export
- **Page numbers:** added at export time (Phase 12, backend)
- **Watermark:** added at export time (Phase 12, backend)

### Implementation note
All page ops are staged locally. pdf-lib processes the final page order + edits at export time. The page reorder in the thumbnail sidebar is purely a state reorder — no PDF mutation happens until Save/Export.

### State additions
```ts
{
  pageOrder: number[],          // indices into original pdf.js document, reflecting reorder
  pageRotations: Map<number, 0 | 90 | 180 | 270>,
  deletedPages: Set<number>,
  blankPages: { afterIndex: number }[],
}
```

### Done when
- User can reorder pages by dragging thumbnails
- Rotate, delete, add blank page work
- Split modal produces correct page-range PDFs

---

## Phase 8 — Toolbar & Hamburger Menu

**Goal:** Full top toolbar with all tools. Hamburger menu for file operations.

### What we build
- **Top toolbar** (horizontal, full width):
  - Tool group: Select, Text, Draw, Shapes, Signature, Image, Highlight, Whiteout, Eraser, Form toggle
  - Action group: Undo, Redo
  - View group: Zoom in/out, fit controls, performance panel toggle
  - File group: Save, Export
  - Overflow: hamburger menu
- **Hamburger menu** (dropdown):
  - My PDFs — opens a drawer/modal listing the user's saved PDFs (fetched from backend)
  - Create New — clears the editor and starts fresh
  - Open — file picker to open a new PDF (replaces current session)
  - Save — triggers Phase 11 Save flow
  - Export — triggers Phase 11 Export flow
- **Performance panel:** toggleable overlay showing current memory usage (approximate canvas object count, page count)

### Key decisions
- Top toolbar uses HeroUI `Toolbar` / `ButtonGroup` or custom flex row with HeroUI `Button` and `Tooltip`
- Active tool highlighted with a filled/tinted button state
- Hamburger menu built with HeroUI `Dropdown`

### Done when
- All tool switches work from the toolbar
- Hamburger menu opens and shows correct items
- Undo/Redo in toolbar matches keyboard shortcuts

---

## Phase 9 — Find & Replace

**Goal:** Search for text across all pages and replace it using the overlay approach.

### What we build
- **Find bar:** floating panel (or top bar insertion) with search input + prev/next match navigation
- **How find works:**
  - Use `pdf.js` `PDFPageProxy.getTextContent()` to extract all text + positions from each page
  - Match search term → compute bounding box of matching text on the rendered canvas
  - Draw a temporary highlight overlay (Fabric.js semi-transparent rect) on each match
  - Navigate between matches with Prev/Next
- **How replace works:**
  - User enters replacement text
  - For each match (or current match): add a white `fabric.Rect` over the original text bounding box (whiteout) + add a `fabric.IText` with the replacement text, positioned at the same coordinates, same font size approximation
  - The original PDF text is NOT modified — this is the overlay trick
- **Replace All:** iterates all matches across all pages and applies the above

### Key decisions
- Text positions from `getTextContent()` are in PDF coordinate space — must transform to canvas/screen coordinates using the pdf.js viewport transform
- Font size for replacement text is inferred from the pdf.js text item's `transform` matrix height
- This is an approximation, not true text editing. Document this limitation.

### Done when
- Find highlights all matches across pages
- Replace single and Replace All produce correct whiteout + new-text overlays

---

## Phase 10 — Form Mode

**Goal:** Toggle into form mode to place basic form fields.

### What we build
- Form mode toggle in toolbar switches into a special mode where clicking the canvas places a form field
- Field types: Text field, Checkbox, Radio button, Dropdown (select)
- Each field is a Fabric.js group (visible rectangle + label) on the canvas
- At export (pdf-lib): form fields are written as proper PDF AcroForm fields using `pdf-lib`'s `PDFForm` API
- Right sidebar in form mode: field label, placeholder text, required toggle, field name (for form data key)

### Key decisions
- Form fields are distinguishable from regular Fabric.js objects by a custom `type: 'form-field'` property
- pdf-lib has full AcroForm support — `pdfDoc.getForm().createTextField()`, etc.
- Signature fields use pdf-lib's signature field API (not the freehand signature from Phase 4)

### Done when
- User can place text fields and checkboxes on a PDF
- Exported PDF opens in any viewer with functional form fields

---

## Phase 11 — Save & Export (Backend Integration)

**Goal:** Save mid-edit and Export final PDF both upload to S3 via backend. My PDFs list works.

### What we build

#### Save flow
1. Client: collect current page order, rotations, Fabric.js JSON per page
2. Client: pdf-lib assembles the final PDF — applies page order, rotations, and flattens all Fabric.js overlays (as PNG images rendered from each Fabric.js canvas) into the PDF pages
3. Client: upload resulting PDF binary to `POST /api/editor/save` with metadata (filename, page count)
4. Backend: stores to S3 under `users/{userId}/pdfs/{fileId}.pdf`, records in DB, returns `{ fileId, url }`
5. Client: stores `fileId` in editor state for future Save calls (overwrite same file)

#### Export flow
- Same as Save but triggers browser download after upload completes
- Returns signed S3 URL → browser follows it → file downloads

#### How Fabric.js → PDF works (critical detail)
For each page:
1. pdf-lib loads the original PDF page
2. The Fabric.js canvas for that page is exported to a PNG: `canvas.toDataURL('image/png')`
3. pdf-lib embeds this PNG as a full-page image overlay on top of the original page
4. Result: original PDF content + all edits baked in as an image layer

#### My PDFs list
- `GET /api/editor/my-pdfs` → list of user's saved PDFs with name, size, updated_at, thumbnail URL
- Displayed in a drawer opened from the hamburger menu
- Click to load a saved PDF back into the editor (fetches from S3 signed URL)

### Key decisions
- Fabric.js canvases must match pdf.js render dimensions exactly for the PNG overlay to align correctly
- The PNG overlay is a lossy representation — fonts become rasterized. This is acceptable and standard.
- If a page was never edited (no Fabric.js objects), skip the PNG overlay for that page (preserve original PDF quality)

### Done when
- Save uploads a valid PDF to S3
- Export triggers a file download with all edits baked in
- My PDFs drawer lists saved files and can reload them into the editor

---

## Phase 12 — Heavy Backend Operations

**Goal:** Compress, password protect/unprotect, redact, watermark, and page numbers — all backend-processed.

### Operations and their API endpoints

#### Compress — `POST /api/editor/compress`
- Payload: `{ fileId, preset: 'high' | 'balanced' | 'light' | 'custom', customOptions?: { quality, resize, flatten } }`
- Backend: Ghostscript with matching dPDFSETTINGS flags (`/screen`, `/ebook`, `/printer`)
- Custom: pass quality % + image resize scale + flatten (merge all layers into single raster)
- Returns: new `fileId` for the compressed file

#### Password Protect — `POST /api/editor/encrypt`
- Payload: `{ fileId, userPassword, ownerPassword, keyLength: 128 | 256 }`
- Backend: pikepdf applies AES encryption
- Returns: new `fileId`

#### Password Unprotect — `POST /api/editor/decrypt`
- Payload: `{ fileId, password }`
- Backend: pikepdf decrypts, returns new `fileId`

#### Redact — `POST /api/editor/redact`
- Client: user paints redaction rectangles using the brush/rect tool in "redact mode" (red semi-transparent overlay to show intended areas)
- On confirm: serialize redaction rects (page index, x, y, w, h in PDF coordinate space)
- Backend: PyMuPDF `page.add_redact_annot()` + `page.apply_redacts()` — permanently removes underlying content
- Returns: new `fileId` for the redacted PDF

#### Watermark — `POST /api/editor/watermark`
- Payload: `{ fileId, text?, imageBase64?, opacity, position, rotation, pages: 'all' | number[] }`
- Backend: PyMuPDF overlays watermark on each specified page
- Returns: new `fileId`

#### Page Numbers — `POST /api/editor/page-numbers`
- Payload: `{ fileId, position, startAt, fontFamily, fontSize, pages: 'all' | number[] }`
- Backend: PyMuPDF inserts text annotation or direct text draw per page
- Returns: new `fileId`

### UI for these operations
Each operation gets a modal/dialog triggered from the toolbar or hamburger menu. The modal collects options → submits to backend → shows progress indicator → on complete, the editor loads the returned PDF as the new working document.

### Key decisions
- After any backend op, the editor reloads the returned PDF into pdf.js and clears Fabric.js state (edits are baked into the new PDF from the backend)
- Backend ops always produce a new S3 file, never mutate in-place

### Done when
- Compress, encrypt, decrypt, redact, watermark, page numbers all work end-to-end
- Redacted text cannot be extracted from the output PDF

---

## Phase 13 — Hotkeys & Accessibility

**Goal:** Keyboard-first operation, proper ARIA, screen reader compatibility.

### Hotkeys

| Key | Action |
|---|---|
| `Ctrl/Cmd+Z` | Undo |
| `Ctrl/Cmd+Shift+Z` | Redo |
| `Ctrl/Cmd+S` | Save |
| `Ctrl/Cmd+E` | Export |
| `Ctrl/Cmd+F` | Find |
| `V` | Select tool |
| `T` | Text tool |
| `B` | Brush / draw |
| `E` | Eraser |
| `Escape` | Deselect / close modal |
| `Delete / Backspace` | Delete selected object |
| `Arrow keys` | Nudge selected object (1px; +Shift = 10px) |
| `Ctrl/Cmd+D` | Duplicate selected object |
| `[` / `]` | Send backward / bring forward |
| `Ctrl/Cmd+[` / `]` | Send to back / bring to front |
| `+` / `-` | Zoom in / out |
| `0` | Fit to window |

### Accessibility
- All toolbar buttons: `aria-label`, `aria-pressed` for active state
- Fabric.js canvas: `role="application"` with `aria-label="PDF editing canvas, page N of M"`
- Thumbnail sidebar: `role="listbox"`, thumbnails are `role="option"` with `aria-selected`
- Modal dialogs: focus trap, `aria-modal`, close on Escape
- Layers panel: keyboard navigation with arrow keys

### Done when
- All hotkeys work and don't conflict with browser shortcuts
- Tab order through toolbar is logical
- Screen reader announces tool changes and page navigation

---

## Phase 14 — Freemium Gating

**Goal:** Enforce subscription tier limits on the PDF editor.

### Limits to define (confirm with client before implementing)
- Suggested free tier: max file size 10MB, max 5 saves/day
- Suggested paid tier: unlimited

### What we build
- Before upload: check file size client-side, show upgrade prompt if over free limit
- Before Save/Export: call `GET /api/user/usage` → if limit reached, show upgrade modal
- Backend `POST /api/editor/save` validates subscription tier and returns `403` with `{ reason: 'limit_reached' }` if over limit
- Frontend handles `403` gracefully: shows HeroUI Modal with plan comparison and Stripe checkout link
- Usage counter displayed in the UI for free users: "3 of 5 saves used today"

### Done when
- Free users cannot save beyond the daily limit
- Upgrade prompt appears at the right moment
- Paid users have no restrictions

---

## File & Folder Structure (Target)

```
app/
  (tools)/
    pdf-editor/
      page.tsx               # editor route
      layout.tsx             # editor-specific layout (no navbar, full-screen)

components/
  sections/
    pdf-editor/
      PdfEditorShell.tsx     # top-level composition: toolbar + sidebar + canvas area
      PdfViewerCanvas.tsx    # pdf.js render + Fabric.js overlay per page
      ThumbnailSidebar.tsx   # left sidebar with draggable page thumbnails
      RightSidebar.tsx       # property panel + layers panel
      TopToolbar.tsx         # tool buttons, zoom, save/export
      HamburgerMenu.tsx      # My PDFs, New, Open, Save, Export
      FindReplaceBar.tsx     # find & replace UI
      modals/
        SignatureModal.tsx
        SplitModal.tsx
        CompressModal.tsx
        EncryptModal.tsx
        WatermarkModal.tsx
        PageNumbersModal.tsx
        MyPdfsModal.tsx

lib/
  client/
    hooks/
      pdf-editor/
        use-pdf-loader.ts        # pdf.js document loading
        use-fabric-canvas.ts     # Fabric.js mount/unmount/hydrate per page
        use-editor-history.ts    # undo/redo stack management
        use-page-management.ts   # reorder, rotate, add/remove pages
        use-find-replace.ts      # search + overlay replacement
        use-editor-export.ts     # pdf-lib assembly + backend upload
    stores/
      pdf-editor-store.ts        # Zustand store (all editor state)
    mutations/
      pdf-editor/
        use-save-pdf.ts
        use-export-pdf.ts
        use-compress-pdf.ts
        use-encrypt-pdf.ts
        use-redact-pdf.ts
        use-watermark-pdf.ts
```

---

## Dependencies to Install

```bash
bun add pdfjs-dist fabric pdf-lib
bun add react-dnd react-dnd-html5-backend   # thumbnail drag-reorder
```

- `pdfjs-dist` — PDF rendering
- `fabric` — interactive canvas editing layer
- `pdf-lib` — client-side PDF assembly and page operations
- `react-dnd` — thumbnail sidebar drag-to-reorder (or use `@dnd-kit/core` if already preferred)

---

## Known Limitations & Caveats

1. **Text is rasterized on export.** Fabric.js edits are baked as a PNG image layer — text in edits is no longer selectable/searchable in the exported PDF.
2. **Find & Replace is overlay-only.** Original PDF text stream is not modified. The replacement text is an approximation of position and size.
3. **Form fields may not render in all viewers.** pdf-lib AcroForm support is good but complex existing forms may not round-trip perfectly.
4. **Encryption requires backend round-trip.** The PDF leaves the browser for encryption — communicate this to users (HTTPS only).
5. **Large PDFs (100+ pages) may be slow.** Virtual rendering (Phase 1) mitigates this but Fabric.js canvas-per-page has overhead. Set a soft warning at 50 pages.
6. **Redaction is permanent and irreversible.** Make this explicit in the UI before the user confirms.
7. **No real-time collaboration.** Single-user session only. My PDFs is async file storage, not live co-editing.
