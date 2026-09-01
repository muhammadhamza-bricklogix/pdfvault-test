# 10 — Share links

**Snapshot date:** 2026-09-01
**Backend contract:** [`../SHARE_LINKS_BACKEND_CONTRACT.md`](../SHARE_LINKS_BACKEND_CONTRACT.md)

## What it does

Generates a public token-based URL for a document so the recipient can view it without an account. Optional restrictions (expiry, password) handled server-side per the contract.

## Flow

1. In the editor, user clicks Share → `components/sections/pdf-editor/ShareModal.tsx` opens.
2. ShareModal dispatches `editor:save-before-action` — the save pipeline (`use-save-editor.ts` → `merge-pdf.ts`) bakes current edits into the source bytes before the URL is generated. Prevents the "shared link shows stale content" bug.
3. ShareModal calls `lib/client/api/shares.ts` to request a token from the backend.
4. Backend returns a `token`; frontend surfaces the public URL `{origin}/share/{token}`.
5. Recipient hits `/share/[token]` → `app/share/[token]/page.tsx` renders the public view.
6. Public view fetches doc metadata + bytes via the server helper in `lib/server/share/`.

## Server + API

- `app/api/share/` — Next.js route handler (proxies to backend)
- `lib/server/share/` — server-side helpers
- `lib/client/api/shares.ts` — client wrapper

## Contract

Backend contract for token issue, expiry, password, and revocation is in [`../SHARE_LINKS_BACKEND_CONTRACT.md`](../SHARE_LINKS_BACKEND_CONTRACT.md). Read that before touching this feature.

## Related files

| File | Role |
|---|---|
| `components/sections/pdf-editor/ShareModal.tsx` | Share dialog (LOCKED — editor lock) |
| `app/share/[token]/page.tsx` | Public share view |
| `app/api/share/` | Next route handler |
| `lib/server/share/` | Server helpers |
| `lib/client/api/shares.ts` | Client wrapper |

## Related

- [`06-pdf-editor.md`](./06-pdf-editor.md) — save-before-action dispatch
- [`11-version-history.md`](./11-version-history.md) — shared docs vs versioning
- [`../SHARE_LINKS_BACKEND_CONTRACT.md`](../SHARE_LINKS_BACKEND_CONTRACT.md) — full contract
