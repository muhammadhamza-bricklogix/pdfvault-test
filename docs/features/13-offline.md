# 13 — Offline detection + resilience

**Snapshot date:** 2026-09-01

## What it does

Detects when the browser goes offline, surfaces a banner, and ensures in-progress editor work isn't lost when connectivity drops.

## Detection

- `components/shared/offline-boot.tsx` — installs `online` + `offline` listeners on `window`
- `lib/client/hooks/use-online-status.ts` — React hook exposing current status
- `components/shared/OfflineBanner.tsx` — top banner shown when offline

## Editor resilience

The PDF editor autosave layer gives implicit offline resilience:

- **Signed-in autosave** — `lib/client/hooks/pdf-editor/use-editor-auto-persist.ts` writes Fabric state + config on debounce (client-side)
- **Signed-out autosave** — `lib/client/hooks/pdf-editor/use-signed-out-auto-persist.ts` mirrors into IndexedDB
- Cloud upload is retried on reconnect (via the normal Save action)

## Related files

| File | Role |
|---|---|
| `components/shared/offline-boot.tsx` | Online/offline listeners |
| `components/shared/OfflineBanner.tsx` | Offline banner UI |
| `lib/client/hooks/use-online-status.ts` | Online status hook |
| `lib/client/offline/` | Offline helpers (if extended) |
| `lib/client/hooks/pdf-editor/use-editor-auto-persist.ts` | Signed-in autosave |
| `lib/client/hooks/pdf-editor/use-signed-out-auto-persist.ts` | Signed-out IDB autosave |

## Related

- [`03-providers.md`](./03-providers.md) — offline boot mounted globally
- [`06-pdf-editor.md`](./06-pdf-editor.md) — autosave + reload guards
