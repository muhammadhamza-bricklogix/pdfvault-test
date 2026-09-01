# 01 — Stack + build

**Snapshot date:** 2026-09-01
**Package name:** `pdf-vault` (v0.0.1)

## Runtime + framework

| Layer | Tech | Version | Notes |
|---|---|---|---|
| Runtime + package manager | Bun | `1.2.19` | Enforced via `engines.bun` in `package.json` |
| Framework | Next.js | `16.2.4` | App Router + Turbopack |
| UI library | React | `19.x` | React 19 concurrent features |
| Styling | Tailwind CSS | `v4` | CSS-first config |
| Component kit | HeroUI | `3.0.3` | Built on React Aria |
| Auth | Clerk | `@clerk/nextjs` v7 | Middleware at `proxy.ts` |
| Forms | react-hook-form + `@hookform/resolvers` + Zod | v4 | Schemas in `lib/shared/schemas/` |
| State (client) | Zustand | `v5` | Stores in `lib/client/stores/` |
| State (server) | TanStack Query | `v5` | Client in `lib/client/query/`, config in `lib/config/` |
| PDF render | pdfjs-dist | `5.6.205` | **Legacy build only** — loaded via `loadPdfJs()` with Safari polyfills |
| PDF edit overlay | Fabric.js | `7.3.1` | One canvas per PDF page |
| PDF write | pdf-lib + `@pdf-lib/fontkit` | `1.17.1` | Server + merge pipeline |
| Billing | Solidgate React SDK | `1.34.0` | Subscription + one-shot orders |
| Errors | Sentry | `10.69.0` | Wired via `sentry-user-context.tsx` |
| HTTP | axios | `1.15.2` | Live upload progress via `use-tracked-upload` |
| Theming | next-themes | `0.4.6` | System + light + dark |
| Icons | Hugeicons + Tabler + react-icons | | |
| Drag + drop | @dnd-kit | `6.3.1` | Manage-pages reorder |
| Zip | jszip | `3.10.1` | Multi-file downloads |
| E2E tests | Playwright | | `tests/` folder |

## Commands

```bash
bun install           # install dependencies
bun run dev           # start Next dev + Turbopack
bun run build         # production build
bun run lint          # eslint --fix
bun run start:prod    # node server.js (prod runtime)
bun run test:e2e      # Playwright suite
bun run test:e2e:ui   # Playwright UI mode
bun run analyze       # bundle analysis
```

## Path alias

- `@/*` → repo root
- E.g. `@/lib/client/hooks/pdf-editor/use-save-editor` resolves to `<root>/lib/client/hooks/pdf-editor/use-save-editor.ts`

## ESLint conventions

- Import ordering: types → builtins → external → internal → parent → sibling → index (blank line between groups)
- JSX props sorted alphabetically, callbacks last, reserved props first
- Unused imports auto-removed
- `no-console` warns
- Blank line before `return`, blank line after variable declarations

## Related

- [`02-routes.md`](./02-routes.md) — route map
- [`03-providers.md`](./03-providers.md) — provider tree
- [`14-environment.md`](./14-environment.md) — env vars
