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
| 2 | Fabric.js Edit Layer | Canvas overlay, add-text tool + floating toolbar, undo/redo |
| 2B | **Edit Text Mode** | **Click existing PDF text to edit in-place (overlay approach)** |
| 3 | Drawing & Shapes | Freehand brush, shapes (rect/circle/line/arrow), eraser tool |
| 4 | Signature & Image | Signature modal (draw/type/upload), image insertion + placement |
| 5 | Highlight & Whiteout | Text highlight (4 preset colors), whiteout rectangle, eraser (click-to-delete) |
| 5B | **PDF Annotations** | **True PDF annotation sticky notes via pdf-lib (survive export)** |
| 6 | Right Sidebar & Layers | Property panel (stroke, fill, opacity, link, position), layers panel |
| 7 | Page Management | Thumbnail drag-reorder, rotate, add/remove/blank pages, split modal |
| 8 | Toolbar & Hamburger Menu | Top toolbar, hamburger menu (My PDFs, New, Open, Save, Export) |
| 9 | Find & Replace | Full-document search, overlay-based replacement |
| 10 | Form Mode | Form field toggle, field placement, AcroForm export, tab order |
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

## Phase 2B — Edit Text Mode

**Goal:** User can click on existing PDF text and edit it in-place. Separate "Edit Text" toolbar button alongside the existing "Add Text" button.

> **Context:** Every browser-based PDF editor (PDFGuru, Sejda, SmallPDF, PDFEscape) uses the same approach — they do NOT modify the PDF content stream. They extract text positions, render editable overlays, and hide the original text. This looks like "real" editing to the user but is technically an overlay trick. True content stream editing is impractical in the browser (requires parsing binary font encodings, handling font subsets, managing PDF operator streams).

### How it works

```
User activates "Edit Text" tool
     ↓
pdf.js getTextContent() extracts text items with positions + transforms
     ↓
Text blocks detected → rendered as clickable bounding boxes on Fabric canvas
     ↓
User clicks a text block
     ↓
1. White Rect placed over original text (auto-whiteout, editorType: "editTextCover")
2. IText created at same position with extracted text, approximate font size
3. FloatingTextToolbar appears for formatting
     ↓
User edits the IText content
     ↓
Toggle out of Edit Text → edits become permanent overlays (white rect + IText stay)
```

### What we build
- **"Edit Text" toolbar button** — separate from "Add Text", switches into Edit Text mode
- **Text extraction hook (`use-text-extraction.ts`):**
  - Calls `page.getTextContent()` on the current pdf.js page
  - Parses `TextItem[]` — each has `str` (text), `transform` (6-element matrix with position, scale, rotation), `width`, `height`
  - Transforms PDF coordinate space → canvas pixel coordinates using the pdf.js viewport transform matrix
  - Groups adjacent text items into logical text blocks (same line, similar font size)
- **Text block visualization:**
  - When Edit Text mode is active, render light blue semi-transparent bounding boxes over each detected text block (visual hint showing what's editable)
  - These are temporary — removed when switching out of Edit Text mode or when a block is clicked for editing
- **Click-to-edit behavior:**
  - User clicks a text block bounding box
  - System creates: (1) opaque white `Rect` covering the original text area (`editorType: "editTextCover"`) + (2) `IText` with the extracted text content, positioned at the same coordinates
  - Font size approximated from the text item's transform matrix height component
  - `IText` enters editing mode automatically
  - FloatingTextToolbar appears for font/size/style changes
- **Toggle-out behavior:**
  - Switching away from Edit Text mode removes the blue bounding box hints
  - Edited text blocks (white rect + IText) remain permanently on the canvas as overlay objects
  - Un-clicked text blocks revert to showing the original PDF text (no overlay created)
  - User can undo individual edits via the history system

### Interaction with Whiteout tool
- Edit Text's auto-whiteout uses `editorType: "editTextCover"` to distinguish from manual whiteout blocks (`editorType: "whiteout"`)
- Both are visually identical (opaque white rects) but semantically different
- The Layers panel (Phase 6) can show them with different labels

### Coordinate transformation (critical detail)
```
PDF coordinates → Canvas coordinates:

PDF space: origin at bottom-left, Y increases upward, units in PDF points (1/72 inch)
Canvas space: origin at top-left, Y increases downward, units in CSS pixels

Transform matrix from getTextContent():
[scaleX, skewY, skewX, scaleY, translateX, translateY]

Canvas position:
  x = translateX * viewport.scale
  y = (pageHeight - translateY) * viewport.scale   // Y-flip
  fontSize ≈ scaleY * viewport.scale               // approximate
```

### Key decisions
- Font family is NOT reliably extractable from PDF text items — default to a close match (serif/sans-serif heuristic based on font name substring)
- Text blocks are approximations — complex layouts (columns, tables, rotated text) may not group perfectly
- This is NOT true text editing — the original PDF text stream is untouched. Document this limitation.
- Edit Text mode does NOT work on scanned PDFs (no text layer) — show a "No text found on this page" message

### State additions
```ts
{
  editTextBlocks: Map<number, TextBlock[]>,  // extracted text blocks per page
  // TextBlock = { text, x, y, width, height, fontSize, fontFamily }
}
```

### Files to create
- `lib/client/hooks/pdf-editor/use-text-extraction.ts` — extract + transform text positions
- `lib/client/hooks/pdf-editor/use-edit-text-tool.ts` — Edit Text mode logic

### Done when
- User can switch to Edit Text mode and see blue bounding boxes over existing text
- Clicking a text block makes it editable with correct text content and approximate positioning
- Edited text persists after switching out of Edit Text mode
- Undo reverts individual text edits
- Un-edited text blocks remain as original PDF content

---

## Phase 3 — Drawing & Shapes

**Goal:** Freehand brush, geometric shapes, and eraser tool.

### What we build
- **Freehand draw:** activate `fabric.Canvas.isDrawingMode = true`, expose brush size + color picker
- **Shapes:** click-drag to draw rectangle, circle (ellipse), line, arrow. Each is a Fabric.js object (selectable, resizable after creation)
- **Arrow:** composite Fabric.js `Group` (line + triangle arrowhead)
- **Eraser:** click on any Fabric.js object (text, shape, image, etc.) to **delete it** from the canvas. The cursor changes to indicate deletion mode. This is a true eraser — it removes objects, not covers them.
- Tool options panel (inline in toolbar): stroke color, fill color, stroke width, opacity

### Key decisions
- Shape creation: mousedown → mousemove → mouseup pattern via Fabric.js events
- After creating a shape, automatically switch to select mode so the user can reposition
- Eraser is a **click-to-delete** tool (removes the targeted Fabric.js object), NOT a white rectangle

### Done when
- User can draw, place shapes, and delete objects with the eraser
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

## Phase 5 — Highlight & Whiteout

**Goal:** Highlight text on the PDF and add whiteout blocks to cover content.

### What we build
- **Highlight tool:** user clicks and drags over text on the page → creates a semi-transparent `fabric.Rect` (35% opacity, no stroke). Non-destructive — the PDF text underneath remains visible through the highlight.
- **Highlight color presets:** 4 color swatches in the toolbar (yellow `#FFEB3B`, green `#A5D6A7`, blue `#90CAF9`, pink `#F48FB1`). Visible when highlight tool is active. Selected color stored in Zustand store.
- **Whiteout (cover):** drag-to-create opaque white rectangle tool. Distinct from the Eraser tool — whiteout **covers** content with a white block, while eraser **deletes** Fabric.js objects.
- **Eraser tool (click-to-delete):** click any Fabric.js object to remove it from the canvas. Separate from whiteout.

### Tool distinction (important)
| Tool | Action | Use case |
|---|---|---|
| Eraser | Click an object → object is deleted from canvas | Remove a text box, shape, or image you added |
| Whiteout | Drag to create opaque white rectangle | Cover/hide existing PDF content underneath |

### Custom properties
All Phase 5 objects use `editorType` custom property for identification:
- `editorType: "highlight"` — highlight rectangles
- `editorType: "whiteout"` — whiteout rectangles
- Registered on `FabricObject.customProperties` for JSON serialization

### Key decisions
- Highlight uses `opacity: 0.35` on a filled Rect (not `globalCompositeOperation = 'multiply'` — simpler, more predictable across backgrounds)
- Highlight color customization via preset swatches (not full color picker — Phase 6 property panel can add that)
- Whiteout and Eraser are separate tools with separate toolbar buttons and different icons

### Done when
- User can highlight regions with 4 color options
- User can add whiteout blocks to cover content
- User can click-to-delete any object with the eraser
- All objects persist across page switches via custom property serialization

---

## Phase 5B — PDF Annotations (Sticky Notes, Comments)

**Goal:** True PDF annotation objects that survive export and are interactive in any standard PDF viewer (Adobe Acrobat, Preview, Chrome PDF viewer, etc.).

> **Prerequisite:** Requires `pdf-lib` to be installed and integrated (needed by Phase 7 for page ops anyway). This phase should be implemented after Phase 11 (Save & Export) is working, since annotations must be written into the PDF binary at export time.

### What we build

#### Sticky Notes (Text Annotations)
- **Toolbar button:** "Sticky Note" — click-to-place on the PDF page
- **During editing:** a small annotation icon is rendered on the Fabric.js canvas as a visual placeholder (similar to how Adobe Acrobat shows a small note icon)
- **Floating panel:** clicking the icon opens a floating editor with:
  - Textarea for note content
  - Author name (from Clerk user profile)
  - Timestamp (auto-set)
  - Color picker (yellow, blue, green, pink, orange)
- **On export (pdf-lib):**
  - Each sticky note is written as a PDF `/Type /Annot /Subtype /Text` annotation object
  - Includes: `Contents` (note text), `T` (author), `CreationDate`, `C` (color array), `Name` (icon type)
  - The annotation is NOT a visual overlay — it's a PDF spec annotation that any viewer can render natively
  - The Fabric.js placeholder icon is NOT baked into the page image

#### How PDF Text Annotations work (spec reference)
```
PDF annotation dictionary:
{
  /Type /Annot
  /Subtype /Text
  /Rect [x1 y1 x2 y2]        ← position on page (PDF coordinates)
  /Contents (Note text here)   ← the actual note content
  /T (Author Name)             ← author
  /CreationDate (D:20260424)   ← creation date
  /C [1 0.92 0.23]             ← color (RGB, 0-1 range)
  /Name /Comment               ← icon type: Comment, Note, Help, Key, etc.
  /F 4                         ← flags (4 = NoZoom)
  /Open false                  ← whether popup is initially open
}
```

#### pdf-lib implementation approach
```ts
import { PDFDocument, PDFName, PDFArray, PDFString, PDFNumber, PDFDict } from 'pdf-lib';

// For each sticky note on a page:
const page = pdfDoc.getPage(pageIndex);
const { width, height } = page.getSize();

// Convert Fabric canvas coords → PDF coords (flip Y axis)
const pdfX = fabricNote.left * (width / canvasWidth);
const pdfY = height - (fabricNote.top * (height / canvasHeight));

// Create annotation dictionary
const annotDict = pdfDoc.context.obj({
  Type: 'Annot',
  Subtype: 'Text',
  Rect: [pdfX, pdfY, pdfX + 24, pdfY + 24],
  Contents: PDFString.of(noteText),
  T: PDFString.of(authorName),
  C: [1, 0.92, 0.23],  // yellow
  Name: 'Comment',
  F: 4,
  Open: false,
});

// Add to page's /Annots array
const annots = page.node.get(PDFName.of('Annots')) ?? pdfDoc.context.obj([]);
annots.push(pdfDoc.context.register(annotDict));
page.node.set(PDFName.of('Annots'), annots);
```

### Interaction with Fabric.js layer
- During editing: sticky notes exist as Fabric.js `Group` objects on the canvas (visual placeholders only)
- These placeholder objects have `editorType: "stickyNote"` and `noteText` custom properties
- At export time: the hook iterates all objects with `editorType: "stickyNote"`, extracts position + content, writes PDF annotations via pdf-lib, and **excludes** these objects from the PNG flatten (they should NOT be rasterized)
- After opening an exported PDF back in the editor: pdf.js renders the annotation icons natively via its AnnotationLayer

### Key decisions
- Sticky notes are true PDF annotations — they appear in Adobe Acrobat's comment panel, can be replied to, printed, etc.
- The Fabric.js placeholder during editing is a simple icon (not the final annotation) — it's just for positioning and content entry
- Color mapping: Fabric.js hex colors → PDF RGB arrays (0-1 range) at export time
- Coordinate transformation: Fabric.js canvas pixels → PDF points (account for zoom, page dimensions, Y-axis flip)
- No comment threads or replies in our editor — just single notes (replies are a PDF viewer feature)

### Files to create
- `lib/client/hooks/pdf-editor/use-sticky-note-tool.ts` — click-to-place + floating editor (upgrade existing)
- `lib/client/hooks/pdf-editor/use-annotation-export.ts` — convert Fabric.js sticky notes to pdf-lib annotation objects
- `components/sections/pdf-editor/FloatingStickyNoteEditor.tsx` — floating note editor panel (upgrade existing)

### Done when
- User can place sticky notes on the PDF and enter text content
- Exported PDF contains proper Text Annotations viewable in Adobe Acrobat / Preview
- Sticky note icons are NOT baked into the page image (they're metadata annotations)
- Opening the exported PDF in any standard viewer shows native comment icons

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

**Goal:** Toggle into form mode to place and configure interactive form fields. Reference: pdfeditor.org's form mode.

> **Prerequisite:** Requires `pdf-lib` for AcroForm export. Can be built visually (Fabric.js placeholders) before pdf-lib integration, but export requires Phase 11.

### What we build

#### Form mode toggle
- **Toolbar button** "Form Mode" — toggles between normal editing and form mode (similar to pdfeditor.org's form mode toggle)
- When form mode is active: toolbar shows form-specific tools (field type picker), normal drawing tools are disabled
- Visual indicator: toolbar/canvas border changes color to indicate form mode is active

#### Field types
| Field | Fabric.js representation | pdf-lib export |
|---|---|---|
| Text field | Rect + label text | `form.createTextField()` |
| Checkbox | Small square + checkmark icon | `form.createCheckBox()` |
| Radio button | Circle + dot icon | `form.createRadioGroup()` |
| Dropdown | Rect + chevron icon | `form.createDropdown()` |
| Signature field | Dashed rect + "Sign here" text | `form.createSignatureField()` |

#### Field placement
- Click on canvas → places selected field type at that position
- Field renders as a Fabric.js `Group` (border rect + type indicator icon + label)
- Fields are selectable, movable, resizable
- All fields have `editorType: "formField"` and `formFieldType: "text" | "checkbox" | ...` custom properties

#### Field configuration (Right Sidebar in Form Mode)
When a form field is selected, the right sidebar (Phase 6) shows form-specific properties:
- **Field name** — unique identifier for form data key (e.g., "first_name")
- **Label text** — visible label next to the field
- **Placeholder text** — greyed text inside text fields
- **Required toggle** — marks field as mandatory
- **Default value** — pre-filled value
- **Max length** — character limit for text fields
- **Options list** — for dropdowns and radio groups (add/remove/reorder options)
- **Tab order** — numeric input to control tab navigation order between fields
- **Read-only toggle** — for pre-filled fields that users shouldn't edit

#### Tab order management
- Form fields have a numeric tab order stored as a custom property
- In form mode, tab order numbers are displayed as small badges on each field
- Drag-to-reorder in the right sidebar updates tab order automatically
- At export: tab order is written to the PDF form structure

#### Export (pdf-lib AcroForm)
```ts
const form = pdfDoc.getForm();

// Text field
const textField = form.createTextField('field_name');
textField.setText(defaultValue);
textField.addToPage(page, { x, y, width, height });

// Checkbox
const checkbox = form.createCheckBox('agree_terms');
checkbox.addToPage(page, { x, y, width: 14, height: 14 });

// Dropdown
const dropdown = form.createDropdown('country');
dropdown.setOptions(['Option 1', 'Option 2', 'Option 3']);
dropdown.addToPage(page, { x, y, width, height });
```

### Key decisions
- Form fields are distinguishable from regular Fabric.js objects by `editorType: "formField"` custom property
- pdf-lib has full AcroForm support — `pdfDoc.getForm().createTextField()`, etc.
- Signature fields use pdf-lib's signature field API (not the freehand signature from Phase 4)
- Form fields are NOT rasterized in the PNG overlay — they must be written as proper AcroForm objects at export time (similar to how sticky note annotations are excluded from the flatten)
- Existing form fields in uploaded PDFs: detected via pdf-lib's `pdfDoc.getForm().getFields()` and rendered as editable Fabric.js objects

### Files to create
- `lib/client/hooks/pdf-editor/use-form-mode.ts` — form mode toggle + field placement
- `components/sections/pdf-editor/FormFieldSidebar.tsx` — field configuration panel
- `lib/client/hooks/pdf-editor/use-form-export.ts` — convert Fabric.js form fields to pdf-lib AcroForm

### Done when
- User can toggle form mode and place text fields, checkboxes, dropdowns on a PDF
- Field properties (name, placeholder, required, options) are configurable in the sidebar
- Tab order is visible and configurable
- Exported PDF opens in any viewer with functional, fillable form fields

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
      EditorTopBar.tsx       # EditorInfoBar (undo/redo, zoom) + EditorToolBar (tools)
      FloatingTextToolbar.tsx # context-sensitive text formatting toolbar
      ThumbnailSidebar.tsx   # left sidebar with draggable page thumbnails
      RightSidebar.tsx       # property panel + layers panel
      HamburgerMenu.tsx      # My PDFs, New, Open, Save, Export
      FindReplaceBar.tsx     # find & replace UI
      FormFieldSidebar.tsx   # form field configuration (Phase 10)
      SignatureModal.tsx     # signature draw/type/upload modal
      modals/
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
        use-page-renderer.ts     # pdf.js page rendering to canvas
        use-fabric-canvas.ts     # Fabric.js mount/unmount/hydrate per page
        use-editor-history.ts    # undo/redo stack management
        use-draw-tool.ts         # freehand brush drawing
        use-shape-tool.ts        # shape + whiteout creation
        use-highlight-tool.ts    # highlight rectangle tool
        use-eraser-tool.ts       # click-to-delete objects
        use-image-tool.ts        # image insertion from file
        use-signature-tool.ts    # signature modal orchestration
        use-text-extraction.ts   # Phase 2B: extract text positions from PDF
        use-edit-text-tool.ts    # Phase 2B: edit existing text mode
        use-sticky-note-tool.ts  # Phase 5B: PDF annotation sticky notes
        use-annotation-export.ts # Phase 5B: convert to pdf-lib annotations
        use-form-mode.ts         # Phase 10: form field placement
        use-form-export.ts       # Phase 10: AcroForm export via pdf-lib
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
