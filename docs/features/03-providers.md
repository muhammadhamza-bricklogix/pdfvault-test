# 03 — Provider tree + boot components

**Snapshot date:** 2026-09-01

## Provider tree

`app/layout.tsx` wraps the tree in the following order. Order matters — Clerk must be outermost so its context is available to all child providers.

```
ClerkProvider                            ← @clerk/nextjs
  └─ NextThemesProvider                  ← next-themes (system/light/dark)
      └─ QueryProvider                   ← TanStack Query client + hydration
          └─ PaywallProvider             ← global paywall modal host
              └─ UploadToastProvider     ← bottom-left live upload chips
                  └─ EditorEventsLogger  ← dev-only editor:* event log
                      └─ page content
```

Files:

- `app/layout.tsx` — root layout
- `app/providers.tsx` — composes provider tree
- `lib/providers/app-providers.tsx` — inner composition
- `lib/client/query/query-provider.tsx` — TanStack Query wrapper
- `lib/config/query-client.ts` — TanStack Query client config
- `components/sections/billing/PaywallProvider.tsx` — global paywall host
- `components/ui/upload-toast/UploadToastProvider.tsx` — upload chip host

## Global boot components

Mounted globally (in `app/layout.tsx` or a top-level layout), these fire on every page load:

| Component | Purpose |
|---|---|
| `user-sync-boot.tsx` | Mirrors the Clerk user record to the backend `/users/me` on sign-in |
| `sentry-user-context.tsx` | Sets Sentry user scope (id, email) once Clerk hydrates |
| `mobile-debug-boot.tsx` | Dev-mode debug overlay for mobile sessions (touch + viewport + orientation logs) |
| `offline-boot.tsx` + `OfflineBanner.tsx` | Offline detection + banner |
| `google-ads-click-boot.tsx` | Captures Google Ads click ID + persists to storage |
| `gtag-conversion.tsx` | Fires GTM + Google Ads conversion events |
| `pending-editor-file-hydrator.tsx` | Post-signin rehydrate of the IDB pending editor file (see [`04-auth.md`](./04-auth.md)) |
| `sign-in-prompt-modal.tsx` | Global sign-in confirm dialog (Cancel + "Sign in & continue") |
| CookieYes script | Injected in root layout `<head>` (re-enabled after GTM debug, commit `7a038d2`) |

## Configuration invariants

- **Provider order is load-bearing.** Do not reorder without checking every hook that depends on outer context.
- `QueryProvider` calls `setPendingConversionsQueryClient(queryClient)` on mount so the module-scope background conversion runner (`run-pending-conversion.ts`) can invalidate the docs list from outside React (see [`05-uploads-conversions.md`](./05-uploads-conversions.md)).
- `UploadToastProvider` is `placement="bottom start"`. Do NOT switch back to `toast.loading` (top-right, no progress bar).
- `SignInPromptModal` is dispatched via a custom event bus (`dispatchSignInPrompt`) — any code path can trigger it without prop drilling.

## Related

- [`04-auth.md`](./04-auth.md) — Clerk usage + `SignInPromptModal` + pending file hydrator
- [`05-uploads-conversions.md`](./05-uploads-conversions.md) — upload toast provider + module-scope runner
- [`08-billing-paywall.md`](./08-billing-paywall.md) — `PaywallProvider`
- [`12-analytics.md`](./12-analytics.md) — Google Ads + GTM + Sentry
