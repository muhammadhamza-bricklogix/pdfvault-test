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
