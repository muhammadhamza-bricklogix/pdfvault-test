# W-9 Form Editor — How it works

> Paste this into a fresh AI session for full context, or use as the
> reference for new contributors. Covers every strategy applied across the
> three implementation sessions plus all subsequent bug fixes.

---

## 1. Product surface

Two user-facing routes:

| Route | Purpose | Auth |
| --- | --- | --- |
| `/w9-form` | SEO + paid-ads landing page. Single wide hero card with the W-9 form image as a darkened background and the red "Get W-9 Form" CTA overlaid on top. Below: 3-step quick guide, FAQ, instructions, disclaimer. | Public |
| `/forms/w-9` | Alternate longer-form landing (kept for direct URLs; not surfaced from the home grid). | Public |
| `/forms/w-9/edit` | The editor itself. PDF rendering + overlay + sidebar + finalize. | Public |

The W-9 also shows up on the homepage tool grid under a new **Tax forms** tab.

---

## 2. High-level architecture

```
┌────────────────────────────────────────────────────────────────┐
│  Browser (single-page editor)                                  │
│                                                                │
│  /forms/w-9/edit                                               │
│   ├── FormEditor                          ← orchestrator       │
│   │    ├── FormCanvas      ← pdf.js → N canvases (one/page)    │
│   │    │    └── PdfPage (×6)                                   │
│   │    │         └── FormFieldOverlay (only on page 1)         │
│   │    │              └── per-field components (TextField,     │
│   │    │                 SsnField, EinField, DateField,        │
│   │    │                 RadioGroupField, CheckboxField,       │
│   │    │                 SignatureField)                       │
│   │    ├── FormSidebar      ← same per-field components in     │
│   │    │                      "sidebar" mode (HeroUI inputs)   │
│   │    └── FormFooter       ← Done → FinalizeModal             │
│   │                                                            │
│   └── Zustand store (useFormEditorStore) — single source of    │
│       truth for values, errors, sessionId, signatureKey.       │
│       Sidebar + overlay both bind here, so editing one mirrors │
│       the other in real time.                                  │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (only on bootstrap + signature + finalize)
┌────────────────────────────────────────────────────────────────┐
│  Backend (NestJS) — does NOT store intermediate values         │
│                                                                │
│  POST /form-templates/w-9/start    → { sessionId, schema, pdfUrl }
│  POST /form-sessions/:id/signature → { signatureKey }          │
│  POST /form-sessions/:id/finalize  ← { values, signatureKey }  │
│                                    → { downloadUrl }           │
└────────────────────────────────────────────────────────────────┘
```

**Key insight:** the backend is stateless mid-session. The browser holds all
typed values until the user clicks Done. Refreshing loses unsaved data —
that was a deliberate trade-off (removed auto-save in session 4) to keep
the data flow simple and avoid PATCH-on-every-keystroke noise.

---

## 3. The dual-UI strategy (sidebar + PDF overlay)

The biggest UX decision: render the form **twice** in different modes,
both bound to the same store.

| Mode | Where | Why |
| --- | --- | --- |
| **Sidebar** (`mode: "sidebar"`) | Right pane, ~40% of viewport on desktop, full-width on mobile | Labelled HeroUI inputs with helper text, error messages, accessibility. Source-of-truth UX for screen readers. |
| **Overlay** (`mode: "overlay"`) | Positioned absolutely over each PDF page's canvas | Lets the user type directly into the printed boxes, matching real-form intuition. |

Every field component takes a `{ field, mode, page? }` prop and returns
different JSX based on `mode`. The shared Zustand action `setValue(fieldId,
value)` is what wires both together — typing in either side triggers a
re-render on the other.

This is in `components/sections/forms/fields/`:

```
fields/
├── types.ts            # FieldProps + pdfRectToCss helper
├── TextField.tsx
├── SsnField.tsx
├── EinField.tsx
├── DateField.tsx
├── RadioGroupField.tsx
├── CheckboxField.tsx
├── ConditionalField.tsx
└── SignatureField.tsx
```

---

## 4. Schema model (`lib/client/forms/w9-schema.ts`)

The schema is hand-authored from the raw AcroForm extraction
(`schemas/w9-raw-fields.json`, produced by `scripts/extract-w9-fields.mjs`).

```typescript
type FormSchema = {
  id: "w-9"
  label: "Form W-9"
  pdfUrl: "/static/forms/fw9.pdf"
  pageCount: 1            // editable page count; PDF has 6 total
  sections: FormSection[]
}

type FormField = {
  id: "ssn"               // matches our internal id (or AcroForm name suffix)
  label: "Social Security Number"
  type: FormFieldType     // "text" | "ssn" | "ein" | "date" | "radio" | "checkbox" | "signature"
  required: boolean
  pdfRef: string          // full nested topmostSubform path for backend stamping
  rect: FormFieldRect     // bounding box in PDF user-space (origin = bottom-left)
  options?: FormFieldOption[]    // for radio: per-option label + rect
  segments?: { rect, length }[]  // for ssn/ein: per-segment rects (3-2-4 / 2-7)
  showIf?: { [otherFieldId]: expectedValue }  // conditional visibility
  maxLength?: number
}
```

### Section breakdown for the W-9

| Section | Fields | Notes |
| --- | --- | --- |
| **identity** | `f1_01` (name), `f1_02` (business name) | Plain text fields |
| **classification** | `c1_1` (radio, 7 options), `f1_03` (LLC letter, conditional), `f1_04` (Other description, conditional), `c1_2` (3b foreign-partner checkbox) | The two conditional fields use `showIf: { c1_1: "llc" }` and `showIf: { c1_1: "other" }` |
| **exemptions** | `f1_05`, `f1_06` | Optional payee + FATCA codes |
| **address** | `f1_07`, `f1_08`, `f1_09`, `f1_10` | |
| **tin** | `ssn`, `ein` | Mutually exclusive (validated as xor); both have `segments` for per-digit overlays |
| **certification** | `signature`, `signature_date` | No AcroForm widgets for these — coords estimated from the printed form layout |

---

## 5. Field strategies (the heart of the system)

### 5.1 Text fields

Simple. Overlay = an `<input type="text">` positioned absolutely with
`pdfRectToCss(rect, page)`. Sidebar = HeroUI `<TextField>` + `<Input>`.

### 5.2 SSN / EIN — per-digit box rendering

The W-9 prints discrete digit boxes inside each segment (3 + 2 + 4 for
SSN, 2 + 7 for EIN). A single input centred over the full segment makes
the digits drift out of the printed cells due to font metric variation.

**Strategy:** `expandSegmentsToBoxes()` divides each segment's rect into
`length` equal sub-rects, then renders **one single-character `<input>`
per box**. Each input is `maxLength={1}`, advances focus on type, and
backspaces back to the previous box. The middle SSN segment masks to `*`
when unfocused.

```typescript
// Each box: rect.x + cellWidth * i, width = cellWidth = rect.w / length
```

This is exactly how PIN / OTP entry components work — proven UX pattern
applied to PDF-aligned inputs.

### 5.3 Radio classification

The W-9's 7 tax classification options are 7 separate AcroForm checkbox
widgets, each at a different `(x, y)`. The schema carries `optionRects`
inside the `options` array:

```typescript
options: [
  { id: "individual", label: "...", rect: { x: 73,   y: 603.72, w: 8, h: 8 } },
  { id: "c-corp",     label: "...", rect: { x: 180,  y: 603.72, w: 8, h: 8 } },
  ...
]
```

**Overlay:** one transparent `<button role="radio">` per option, sized
exactly to its 8×8-point printed box. Clicking it sets the field value to
the option's `id` and draws a black ✓. Sidebar uses HeroUI `<RadioGroup>`
for the labelled vertical list.

Side effect: selecting any option ≠ `"llc"` clears `f1_03`; selecting any
≠ `"other"` clears `f1_04`. This keeps stale values from being stamped on
the final PDF when the user changes their mind.

### 5.4 Date

Native `<input type="date">` so the user gets the OS picker. The
**store holds MM/DD/YYYY** (validator format) and the input takes ISO
`YYYY-MM-DD`; conversion in both directions inside `DateField`.

**Gotcha fix:** browsers paint a localized placeholder ("dd/mm/yyyy" or
"mm/dd/yyyy") over empty date inputs, which leaked onto the PDF. Fix:
the overlay input has `text-transparent` when empty, switching to
`text-black` only when a date is picked.

### 5.5 Checkbox

For the 3b foreign-partner checkbox. Overlay = a transparent `<button
role="checkbox">` sized to the printed box; renders a ✓ when checked.
Sidebar = HeroUI `<Checkbox>`.

### 5.6 Signature — the most involved one

Stored as a server-side asset (`signatureKey` from `POST
/form-sessions/:id/signature`), not as an inline blob. The overlay shows
a dashed placeholder button "Click to sign" that opens a modal.

**SignatureModal** has 3 tabs:

| Tab | How it captures |
| --- | --- |
| **Draw** | 600×200 canvas, pointer events (mouse + touch), stroke style 2px black. Clear button wipes back to white. |
| **Type** | Text input + 5 cursive font choices (Dancing Script, Great Vibes, Allura, Sacramento, Pacifico — loaded in `app/layout.tsx` via `next/font/google`). Renders the typed name to a canvas with `ctx.font`, exports PNG. |
| **Upload** | Drag/click PNG/JPG ≤ 1 MB, preview before applying. |

On Apply: `canvas.toBlob("image/png")` → `useUploadSignatureMutation` →
backend returns `signatureKey` → stored in Zustand → modal closes.

### 5.7 Conditional visibility (`showIf`)

The `fieldIsVisible(field, values)` helper evaluates `showIf` rules:

```typescript
// f1_03 only renders when c1_1 === "llc"
showIf: { c1_1: "llc" }
```

Used by both `FormFieldOverlay` and `FormSidebar` to skip rendering fields
whose dependencies aren't satisfied.

---

## 6. PDF rendering & coordinate math

### 6.1 Multi-page rendering (`FormCanvas`)

The W-9 has 6 pages; page 1 has the fillable form, pages 2-6 are
instructions. Rather than hiding instructions, the editor scrolls through
all 6 — they're educational, and rendering them is cheap.

`FormCanvas` loads the PDF once via pdf.js, then maps each `PDFPageProxy`
to a `<PdfPage>` component. Each `PdfPage`:

1. Creates a single canvas sized at `viewport.width × dpr × scale`.
2. Sets `canvas.style.width` to `viewport.width / dpr` so retina screens
   render sharply without doubling layout pixels.
3. Calls `page.render({ canvasContext, viewport, canvas })`.
4. When done, fires `onReady(pageNumber, RenderedPageInfo)` to the
   parent so the overlay can lay out.

`FormCanvas` accepts a `renderOverlay(pageNumber)` render prop. Each
`PdfPage` invokes it as a child, scoped to that page's relative
container. Only page 1 returns non-null content; pages 2-6 stay
overlay-free.

### 6.2 PDF user-space → CSS pixels

PDF coordinates have origin at the **bottom-left**, units are **points**
(1/72 inch). CSS pixels have origin at the **top-left**. Conversion in
`fields/types.ts`:

```typescript
function pdfRectToCss(rect, page) {
  const scale = page.displayWidth / page.pdfWidth;
  return {
    left:   rect.x * scale,
    top:    (page.pdfHeight - (rect.y + rect.h)) * scale,
    width:  rect.w * scale,
    height: rect.h * scale,
  };
}
```

Every overlay component calls this with its own rect to produce the
absolute CSS positioning that lines up with the printed form.

---

## 7. Session lifecycle

```
1. User lands on /forms/w-9/edit
2. FormEditor mounts → POST /form-templates/w-9/start
3. Backend returns { sessionId, schema, pdfUrl }
4. Store hydrates; FormCanvas + FormSidebar render
5. User types → setValue() updates Zustand (NO network)
6. User clicks "Add signature" → SignatureModal opens
7. User picks/draws/uploads → POST /form-sessions/:id/signature
   → store.signatureKey = result.signatureKey
8. User clicks Done
9. FormFooter runs validateW9() pre-flight
   - If errors: setErrors(), scroll to first invalid sidebar input, toast
   - If clean: open FinalizeModal
10. FinalizeModal "Generate" button → POST /form-sessions/:id/finalize
    body: { values, signatureKey }
11. Backend stamps the PDF, returns { downloadUrl }
12. User sees Download / Print / Fill another buttons
```

**No auto-save.** The 500 ms debounced PATCH was removed in session 4.
Pros: simpler data flow, no race conditions, less network. Cons: refresh
= data loss. Trade-off accepted.

---

## 8. Validation strategy (`lib/client/forms/validate-w9.ts`)

Pure function: `validateW9({ values, signatureKey }) → Record<fieldId,
errorMessage>`. Returns empty object on success.

Rules in IRS-form order:

1. `f1_01` (name) required
2. `c1_1` (classification) required ∈ 7 known options
3. `if c1_1 === "llc"`: `f1_03` required ∈ {C, S, P}
4. SSN **xor** EIN — exactly one
5. SSN regex: `^(?!000|666|9)\d{3}-?(?!00)\d{2}-?(?!0000)\d{4}$`
   (matches the IRS prohibited-prefix rules)
6. EIN regex: `^(?!00|07|08|09|17|18|19|28|29|49|78|79|89)\d{2}-?\d{7}$`
   (matches the IRS prohibited-prefix rules)
7. `signature_date` parses as MM/DD/YYYY, year ∈ [1900, currentYear]
8. `signatureKey` is set

Error display: `setErrors(errors)` populates `store.errors`. Each field
component reads `errors[field.id]` and renders red borders + a `<FieldError>`
message in the sidebar. The overlay also gets `aria-invalid` for screen
readers.

---

## 9. Zustand store (`lib/client/stores/form-editor-store.ts`)

Minimal — auto-save fields removed in session 4:

```typescript
{
  // Server state (hydrated once from /start)
  sessionId, schema, pdfUrl, signatureKey, finalizedUrl,

  // User state
  values: Record<fieldId, string>,
  errors: Record<fieldId, string>,

  // Actions
  hydrateFromSession, setValue, setValues, setErrors, clearError,
  setSignatureKey, setFinalizedUrl, reset,
}
```

`setValue(id, value)` also clears the field's error so users see
validation messages disappear as they fix them.

---

## 10. Backend contract

```
POST /form-templates/:slug/start
  → 200 { sessionId, schema, pdfUrl }

POST /form-sessions/:id/signature
  body: multipart/form-data { file: <PNG blob> }
  → 200 { signatureKey }

POST /form-sessions/:id/finalize
  body: { values: Record<fieldId, string>, signatureKey: string | null }
  → 200 { downloadUrl }
```

The frontend never reads back a session by id and never PATCHes
mid-fill. Single source of truth for in-progress data is the browser.

---

## 11. Asset generation

`scripts/extract-w9-fields.mjs` — pdf-lib AcroForm walker. Reads
`public/static/forms/fw9.pdf` and dumps every field + rect to
`schemas/w9-raw-fields.json`. The hand-curated `w9-schema.ts` cherry-picks
these and adds semantic labels + types + sections.

`scripts/render-w9-preview.mjs` — macOS `qlmanage` (Quick Look) renders
the W-9 page 1 to `public/static/forms/w9-preview.png` at 927×1200. Used
as the hero background image on `/w9-form`. We had to use qlmanage instead
of pdf.js because the W-9's visible content lives in an XFA layer that
pdf.js doesn't render cleanly in Node.

---

## 12. Mobile responsiveness

| Breakpoint | Behavior |
| --- | --- |
| `≥ 768px` | Side-by-side: canvas (60%) + sidebar (40%) |
| `< 768px` | Sidebar takes full width; canvas hidden. A floating "Preview PDF" button reveals the canvas in a full-screen modal in read-only mode. |

The signature modal is full-screen on mobile so the drawing canvas has
enough room.

---

## 13. Known limitations + future ideas

| Limitation | Note |
| --- | --- |
| Refresh = data loss | Removed auto-save in session 4 by user request. Could reintroduce with `localStorage` persistence if desired. |
| Signature/date coords are estimated | The W-9's AcroForm extraction returned no widgets for signature/date (they're in the XFA layer). Coordinates in `w9-schema.ts` were eyeballed from the printed template. |
| Single-page editing | Only page 1 has fields. Pages 2-6 render as read-only instructions. |
| pdf.js annotation layer not used | We render fields ourselves via custom overlays. An alternative is `pdfjs.AnnotationLayer.render()` which gives the standard blue field highlighting Adobe Reader shows. Would simplify the codebase significantly but require a separate migration. |
| One form (W-9) | The `FormSchema` design is generic so W-4, 1099-NEC, W-7 etc. can be added without code changes — just new schema files. |

---

## 14. File index (everything that matters)

```
app/(tools)/forms/w-9/edit/page.tsx                   # entry point
app/(marketing)/(site)/w9-form/page.tsx               # SEO landing
app/(marketing)/(site)/forms/w-9/page.tsx             # alt landing

components/sections/forms/
├── FormEditor.tsx       # orchestrator + session bootstrap
├── FormCanvas.tsx       # multi-page pdf.js renderer
├── FormFieldOverlay.tsx # per-page overlay dispatcher
├── FormSidebar.tsx      # labelled sidebar dispatcher
├── FormFooter.tsx       # Done button + validation pre-flight
├── FinalizeModal.tsx    # Generate / Download / Print
├── SignatureModal.tsx   # Draw / Type / Upload tabs
├── visibility.ts        # showIf evaluator
├── w9-faq.tsx           # FAQ accordion (shared by landings)
└── fields/
    ├── types.ts
    ├── TextField.tsx
    ├── SsnField.tsx
    ├── EinField.tsx
    ├── DateField.tsx
    ├── RadioGroupField.tsx
    ├── CheckboxField.tsx
    ├── ConditionalField.tsx
    └── SignatureField.tsx

lib/client/
├── forms/
│   ├── w9-schema.ts     # the hand-authored schema
│   └── validate-w9.ts   # pure validator
├── stores/form-editor-store.ts
└── query/mutations/forms.mutation.ts

lib/shared/
├── api/services/forms.service.ts
├── constants/endpoints.ts       # FORMS.START / SIGNATURE / FINALIZE
└── types/forms.types.ts

scripts/
├── extract-w9-fields.mjs
└── render-w9-preview.mjs

public/static/forms/
├── fw9.pdf
└── w9-preview.png

schemas/w9-raw-fields.json       # generated, gitignored
```

---

## 15. Test coverage

`tests/forms/w-9.spec.ts` — Playwright happy-path:

1. Visit `/forms/w-9`
2. Click "Fill Out W-9 Now" → lands on `/forms/w-9/edit`
3. Fill `f1_01` (name) + classification radio + SSN + date
4. Open SignatureModal → Type tab → "Test User" → Apply
5. Click Done → Generate PDF
6. Assert "Download PDF" link is visible

Runs via `bun run test:e2e -- tests/forms`.
