# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install          # install dependencies
bun run dev          # start dev server (Next.js Turbopack)
bun run build        # production build
bun run lint         # lint and auto-fix (eslint --fix)
```

## Architecture

**PDFedits** — a Next.js 16 App Router frontend for a cloud PDF tools platform. Uses Bun as the package manager/runtime.

### Key layers

- **`app/`** — Next.js App Router pages. Route groups: `(auth)` for sign-in/sign-up. Root layout wraps everything in `ClerkProvider` → `Providers` (theme + query).
- **`components/`** — Split into `sections/` (page-level compositions), `ui/` (reusable form controls, theme toggle, dropzone), and `shared/` (cross-cutting like navbar).
- **`lib/providers/`** — Client-side provider tree: `AppProviders` composes `NextThemesProvider` + `QueryProvider` (TanStack Query).
- **`lib/client/query/`** — TanStack Query setup with barrel exports. Mutations and queries go in `mutations/` and `queries/` subdirs.
- **`lib/client/stores/`** — Zustand stores.
- **`lib/shared/`** — Cross-cutting utilities: `constants/routes.ts` (route map), `utils/` (logger, Clerk error handling), `schemas/auth/` (Zod v4 validation schemas).
- **`lib/config/`** — App-level configuration (TanStack Query client config).
- **`proxy.ts`** — Clerk middleware (despite the filename, this is the Next.js middleware file).

### Provider nesting (root layout)

`ClerkProvider` → `NextThemesProvider` → `QueryProvider` → page content

### Tech stack details

- **UI**: HeroUI v3 (built on React Aria) + Tailwind CSS v4
- **Auth**: Clerk (`@clerk/nextjs`)
- **Forms**: react-hook-form + `@hookform/resolvers` + Zod v4
- **State**: Zustand (client stores), TanStack Query (server state)
- **Path alias**: `@/*` maps to project root

### ESLint conventions

- Import ordering enforced: types → builtins → external → internal → parent → sibling → index, with blank lines between groups
- JSX props must be sorted alphabetically with callbacks last and reserved props first
- Unused imports are auto-removed; `no-console` is a warning
- Blank line required before `return` and after variable declarations

## PDF Editor

The PDF editor is the most intricate part of this app. Before touching anything under `lib/client/pdf-editor/**`, `lib/client/hooks/pdf-editor/**`, or `components/sections/pdf-editor/**`, **load the project skill** for an orientation map:

```
Skill({ skill: "pdf-editor-architecture" })
```

It lives at `.claude/skills/pdf-editor-architecture/SKILL.md` and documents the load→render→edit→save pipeline, the load-bearing invariants, and the parts of the code the user has explicitly flagged as off-limits.

### Source layout

| Folder | Purpose |
|---|---|
| `lib/client/pdf-editor/` | Pure logic — extraction, merge, build, vector drawers, color/coordinate helpers |
| `lib/client/hooks/pdf-editor/` | React glue — loaders, tools, save/navigation, manage-pages draft state |
| `components/sections/pdf-editor/` | UI — shell, viewer, toolbar, sidebars, modals |
| `lib/client/stores/pdf-editor-store.ts` | Zustand store: file, pdfDocument, per-page Fabric JSON + history, watermark/bg-image config, page order |

### Key invariants (skill has the full list)

- Fabric coordinates are always at **zoom = 1** (base coords). `setZoom(zoom)` is applied for rendering only.
- Zoom changes **resize** the Fabric canvas; they never re-mount it.
- Manage-Pages rotation is **baked into the content stream** (`append-pdf-page.ts`), not `/Rotate` metadata.
- Background image preview uses `mix-blend-mode: multiply` on the PDF canvas; export uses `BlendMode.Multiply` on `drawImage`.
- Mobile renders the watermark + background-image config in a Modal (`MobileToolPropertiesModal`), not the right sidebar.
- Editor modals (`CreatePdfModal`, `ManagePagesModal`, `PerformancePanel`) are lazy-loaded via `next/dynamic`.
- **pdfjs-dist MUST be imported from the legacy build** — every runtime `import("pdfjs-dist/legacy/build/pdf.mjs")` and the worker URL `pdfjs-dist/legacy/build/pdf.worker.min.mjs`. The modern build (`pdfjs-dist` bare specifier or `pdfjs-dist/build/...`) uses JS features that older iOS Safari WebKit doesn't ship — `getTextContent` throws `"undefined is not a function (near '...t of e...')"` on real devices and the whole text layer goes blank. Type-only imports (`import type { … } from "pdfjs-dist"`) are fine to leave on the bare specifier since they're erased at build time.

### Off-limits without explicit user approval

- The watermark code in `lib/client/pdf-editor/merge-pdf.ts` (the inline `renderPageToPng` + `TEXT_OPS_MIN/MAX/RASTER_SCALE` constants stay there even though a shared util exists for `build-pages-pdf.ts`).
- `objectCaching: false` on IText in `use-edit-text-mode.ts`.

If a fix requires changing one of these, ask the user first.

## Mobile pre-push checklist (REQUIRED before any push or PR)

Mobile (iOS Safari + Android Chrome) is the #1 regression surface in this app — the same code path can render fine on desktop and break completely on a real phone (the Fabric overlay, pdf.js fonts, touch-action, DPR, op-list shape, etc. all behave differently). Before claiming a change is ready to push, walk through this list. If you cannot run on a real mobile device, run in DevTools "Responsive" mode at iPhone 14 / Pixel 7 sizing AND say so explicitly in the summary — never claim mobile is verified when only desktop was tested.

Run on a fresh page load each time (`bun run dev` → open with mobile device or DevTools mobile viewport):

1. **PDF text loads on the FIRST page** — open a multi-page PDF, confirm every glyph is visible (not blank, not a partial render). Open the mobile devtools console and verify:
   - `[PDFedits] load: ok` fires
   - `[PDFedits] render: page` fires with `suppressText: true`
   - `[PDFedits] text: extract ok` fires (NOT `text: extract failed`)
   - `[PDFedits] text: drew IText` fires with `count > 0`
   - If you see `text: extract failed` with a `TypeError`, capture the `message` / `stack` from the log and fix the extractor — DO NOT push.
2. **Text loads on EVERY page** — paginate through the doc. Each page should log the same sequence above. No silent blanks.
3. **Tap-to-edit text works** — tap any text run. An IText cursor must appear and the soft keyboard must open. Type a character; it must render with the same font as the surrounding text.
4. **Pinch-zoom doesn't blank the page** — pinch out to ~2x then pinch in to the floor (~0.5x). Text + shapes stay sharp at both extremes. No blank flash at the zoom floor (iOS Safari regression).
5. **Tools work under finger input** — draw, highlight, eraser, shape. Each tool must respond on first touch (not the second). If a tool needs two taps to engage, check `touch-action` on the Fabric wrapper.
6. **Watermark + background image open in the bottom modal** — these tools must NOT try to render in the right sidebar on mobile (sidebar isn't mounted). Confirm `MobileToolPropertiesModal` opens and closing it returns `activeTool` to `select`.
7. **Manage Pages flow** — Manage Pages button triggers the save-before-action toast, modal opens with thumbnails, rotate / reorder / delete works, Save closes the modal and reflects changes in the editor without a stale-pdf flash.
8. **Save uploads the live edits** — make a visible edit, hit Save, watch for the loading toast, then a success toast. Re-open the saved file and confirm the edit is baked in.
9. **No console errors during the above** — only the `[PDFedits]` info logs. Any uncaught error or red console line is a blocker.
10. **Build is clean** — `bunx tsc --noEmit && bun run lint && bun run build` all pass.

When reporting completion of a PDF-editor change, state which of these you verified and on what (real device vs DevTools). If something on this list couldn't be tested, say so — don't paper over it.

Known mobile failure modes to watch for (these have all bitten us before):
- **pdf.js modern build on older iOS Safari WebKit** → `getTextContent` throws `"undefined is not a function (near '...t of e...')"`, entire text layer blank. **Always use the legacy build** (`pdfjs-dist/legacy/build/pdf.mjs` for runtime imports, `pdfjs-dist/legacy/build/pdf.worker.min.mjs` for the worker URL). If you ever see this error on staging or production, the first thing to check is that NO file slipped back to a bare `pdfjs-dist` runtime import.
- pdf.js operator-list `argsArray[i]` is `null` on certain ops → `args[0]` throws TypeError, the whole text layer is empty. Guarded in `extractSequentialTextColors`; don't undo the `?? []` coalesce.
- pdf.js fonts loading after the first Fabric paint → glyphs render blank on iOS Safari. The `document.fonts.ready` await + `loadingdone` listener in `use-edit-text-mode.ts` fixes this; don't drop them.
- Fabric wrapper without `touch-action: none` → draw/highlight/eraser feel "sticky" on iOS because the outer scroll container is competing for touch events.
- Pinch-zoom below 0.5 → IText overlay disappears on iOS. The `PINCH_MIN_ZOOM = 0.5` floor in `PdfViewerCanvas` exists for this; don't lower it.
- Both pdf.js native text rendering AND the Fabric IText overlay enabled at once → visible glyph doubling at DPR=3. `suppressText: true` is set unconditionally now; don't reintroduce the mobile branch that flipped it.

<!-- repocards:begin -->
## Repo context — repocards

This repository has a pre-computed context folder at `.repocards/`. **Open [`.repocards/AGENT_GUIDE.md`](./.repocards/AGENT_GUIDE.md) at the start of any task about this project** — before running Grep/Glob/Read on the source, and also when the user asks health-check questions like "are you reading repocards?". The guide routes you to pre-computed cards (architecture, entrypoints, api-surface) and contains self-identification instructions. Typical card read is 10–50× fewer tokens than a grep pass.

Generated by [repocards](https://www.npmjs.com/package/repocards). Re-run `npx repocards index` after code changes.
<!-- repocards:end -->
