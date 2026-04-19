# PDFForge Frontend

Next.js frontend foundation for PDFForge with custom auth flows, shared UI primitives, and a modular `lib/` structure.

## Current Scope

- Home page shell
- Custom Clerk sign-in and sign-up flows
- Theme-ready provider setup
- Modular `lib/` foundation for config, providers, shared schemas, routes, and future client queries/mutations

## Stack

- Next.js App Router
- Clerk
- HeroUI v3
- Tailwind CSS v4
- TanStack Query
- React Hook Form
- Zod
- Zustand
- next-themes

## Structure

- `app/` route entrypoints and app wiring
- `components/sections/` page-level sections
- `components/ui/` reusable UI primitives
- `lib/config/` app-wide configuration
- `lib/providers/` client provider composition
- `lib/client/query/` feature queries and mutations
- `lib/shared/` routes, schemas, and utilities

## Commands

```bash
bun install
bun run dev
bun run build
bun run lint
```
