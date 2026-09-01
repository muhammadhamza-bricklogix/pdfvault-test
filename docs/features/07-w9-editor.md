# 07 — W-9 Form Editor

**Snapshot date:** 2026-09-01
**Status:** LOCKED. See [`16-locked-paths.md`](./16-locked-paths.md).
**Deep dive:** [`../W9_EDITOR_ARCHITECTURE.md`](../W9_EDITOR_ARCHITECTURE.md) — every strategy across the three implementation sessions + subsequent bug fixes.

## Product surface

| Route | Purpose | Auth |
|---|---|---|
| `/w9-form` | SEO + paid-ads landing (hero + 3-step + FAQ + disclaimer) | Public |
| `/forms/w-9` | Alternate longer-form landing (kept for direct URLs) | Public |
| `/forms/w-9/edit` | Editor — PDF rendering + overlay + sidebar + finalize | Public |

Homepage tool grid surfaces W-9 under the **Tax forms** tab.

Old `/w-9` requests 308-redirect to `/w-9-form` via `next.config.mjs` so pre-rename bookmarks still resolve.

## Architecture

```
FormEditor              ← orchestrator
 ├── FormCanvas         ← pdf.js → N canvases (one per page)
 │    └── PdfPage (×6)
 │         └── FormFieldOverlay (page 1 only)
 │              └── per-field components:
 │                    TextField / SsnField / EinField / DateField /
 │                    RadioGroupField / CheckboxField / SignatureField
 ├── FormSidebar        ← same field components in "sidebar" mode (HeroUI inputs)
 └── FormFooter         ← Done → FinalizeModal
```

**Zustand store `useFormEditorStore`** is the single source of truth for values, errors, `sessionId`, `signatureKey`. Sidebar + overlay both bind to it — editing one mirrors the other in real time.

## Dual-UI strategy (sidebar + PDF overlay)

The biggest UX decision: render the form **twice** in different modes, both bound to the same store.

| Mode | Where | Why |
|---|---|---|
| **Sidebar** (`mode: "sidebar"`) | Right pane ~40% viewport desktop; full-width mobile | Labelled HeroUI inputs with helper text, errors, a11y. Source-of-truth UX for screen readers. |
| **Overlay** (`mode: "overlay"`) | Positioned absolutely over each PDF page's canvas | Lets the user type directly into the printed boxes, matching real-form intuition. |

Every field component takes `{ field, mode, page? }` and returns different JSX per `mode`. Shared action `setValue(fieldId, value)` wires both sides.

## Backend contract

Backend is **stateless mid-session** (deliberate — session 4 removed auto-save to keep data flow simple and avoid PATCH-on-every-keystroke noise):

```
POST /form-templates/w-9/start    → { sessionId, schema, pdfUrl }
POST /form-sessions/:id/signature → { signatureKey }
POST /form-sessions/:id/finalize  ← { values, signatureKey }
                                   → { downloadUrl }
```

**Key insight:** browser holds all typed values until Done. Refreshing loses unsaved data — deliberate trade-off.

## Support components

| File | Role |
|---|---|
| `components/sections/forms/FormEditor.tsx` | Orchestrator |
| `components/sections/forms/FormCanvas.tsx` | pdf.js → N canvases |
| `components/sections/forms/FormSidebar.tsx` | Sidebar mode fields |
| `components/sections/forms/FormFieldOverlay.tsx` | Overlay mode (page 1) |
| `components/sections/forms/FinalizeModal.tsx` | Finalize dialog |
| `components/sections/forms/SignatureModal.tsx` | Signature capture |
| `components/sections/forms/visibility.ts` | Conditional field visibility |
| `components/sections/forms/W9EditorBootstrap.tsx` | Session start + schema hydration |
| `components/sections/forms/W9AutoPersist.tsx` | Client-side draft persistence |
| `components/sections/forms/W9FinalizeIntercept.tsx` | Wraps SignatureModal for W-9 (routes exported bytes through finalize contract) |
| `components/sections/forms/W9FormFieldsPortal.tsx` | Overlay ↔ sidebar portal wiring |
| `components/sections/forms/W9PreviewScroller.tsx` | Preview scroller |
| `components/sections/forms/W9LandingContent.tsx` | Landing content |
| `components/sections/forms/w9-faq.tsx` | FAQ block |

## Field components

Under `components/sections/forms/fields/`:

- `TextField.tsx`
- `SsnField.tsx` — SSN mask + validation
- `EinField.tsx` — EIN mask + validation
- `DateField.tsx` — date picker
- `RadioGroupField.tsx`
- `CheckboxField.tsx`
- `SignatureField.tsx` — draws to SignatureModal
- `ConditionalField.tsx` — visibility wrapper
- `types.ts` — field type definitions

## Pure logic

Under `lib/client/forms/`:

- `w9-schema.ts` — schema definition
- `validate-w9.ts` — Zod-based validation
- `normalize-w9-values.ts` — value normalization before finalize
- `stamp-w9-client.ts` — client stamping helpers
- `pending-w9-values.ts` — pending values persistence
- `render-pdf-pages-to-images.ts` — pre-render pages for preview

## W-9 canonical filename (2026-08 enforcement)

Commit `503104a`: single canonical filename per W-9 document. Delete + rename actions **suppressed** on the dashboard for W-9 docs. Enforced in `document-actions-menu.tsx`.

## Related

- [`02-routes.md`](./02-routes.md) — W-9 route paths
- [`04-auth.md`](./04-auth.md) — public routes; no auth required for W-9
- [`09-dashboard.md`](./09-dashboard.md) — W-9 tab in forms grid
- [`16-locked-paths.md`](./16-locked-paths.md) — full W-9 lock
- [`../W9_EDITOR_ARCHITECTURE.md`](../W9_EDITOR_ARCHITECTURE.md) — deep dive
