# 08 — Billing / Paywall / Solidgate

**Snapshot date:** 2026-09-01
**Deep dives:**
- [`../SUBSCRIPTION_USER_JOURNEY.md`](../SUBSCRIPTION_USER_JOURNEY.md) — full billing journey
- [`../../.claude/specs/2026-07-31-solidgate-audit.md`](../../.claude/specs/2026-07-31-solidgate-audit.md) — Solidgate audit (charge-auth SDK migration, React Aria dismiss fix, hard-cancel webhook)
- [`../../.claude/specs/2026-08-03-apple-pay-diagnostic.md`](../../.claude/specs/2026-08-03-apple-pay-diagnostic.md) — Apple Pay diagnostic (blocked on Solidgate-side Apple verification)

## Stack

- Solidgate React SDK `1.34.0` (`@solidgate/react-sdk`)
- Subscription + one-shot orders
- Backend-signed intents; frontend calls `POST /billing/checkout-intent`

## Paywall flow

- `components/sections/billing/PaywallProvider.tsx` — global paywall modal host (mounted at layout root)
- `components/sections/billing/PaywallModal.tsx` — plan grid + Solidgate charge-auth SDK
- `lib/client/hooks/billing/use-paywall.ts` — hook that any code path calls
- `lib/client/hooks/billing/paywall-bus.ts` — event bus for cross-component paywall dispatch

### Rules that keep the flow working

- **`use-paywall.ts` reads `useAuth()` directly** (not the Zustand store). Effect deps include `authLoaded, entitled, isSignedIn`.
- **Signed-out callers routed through `SignInPromptModal` before paywall.** Paywall's `POST /billing/checkout-intent` needs auth — signed-out user in paywall = "Couldn't start checkout" dead-end.
- **`PaywallModal.ErrorState` renders "Sign in & continue"** when error message matches `/sign in|401|not authori[sz]ed/i`. Belt-and-braces for mid-session token expiry.
- **`PaywallModal.finish` calls ONLY `onPaymentSuccess`, not `onClose`.** `usePaywall.onPaymentSuccess` is async — calling `onClose` alongside races "cancelled" against "success" and cancels the queued action.
- **`SuccessStep` auto-dismisses after 2s** so queued downloads fire without a manual click. See [`../../.claude/memory/feedback_download_auto_start.md`](../../.claude/memory/feedback_download_auto_start.md).

## Entitlement

- `lib/client/hooks/billing/ensure-entitlement.ts` — reads + caches current entitlement
- `lib/client/hooks/billing/entitlement-cache.ts` — in-memory + IDB cache
- `lib/client/hooks/billing/use-is-entitled.ts` — boolean hook
- `lib/client/hooks/billing/use-entitlement-allowlist.ts` — allowlist emails (test accounts, staff)
- `lib/shared/constants/entitlement-allowlist.ts` — source of truth for allowlist
- `lib/shared/constants/billing.ts` — plan constants

## Dashboard entitlement gate

`gateEntitledAction(doc)` in `components/sections/dashboard/document-actions-menu.tsx`:

- Returns `true` immediately when `!isConvertedDocument(doc)` — native PDF uploads are free.
- Triggers paywall for converted PDFs (`originalContentType != null`) when the user isn't subscribed.

See [`05-uploads-conversions.md`](./05-uploads-conversions.md) for the paywall distinction (native vs converted docs).

## Invoices

- `components/sections/billing/InvoicesTable.tsx` — settings → billing tab
- `lib/client/billing/generate-receipt-pdf.ts` — client-side PDF receipt generator
- `lib/client/billing/user-currency.ts` — currency helpers

### Currency workaround (active)

Client-side USD override for `/billing/invoices` USD stamp. Delete after the backend Payment writer is fixed. See [`../../.claude/memory/project_invoice_currency_workaround.md`](../../.claude/memory/project_invoice_currency_workaround.md).

## Cancellation flow

- `components/sections/billing/CancellationFlow.tsx` — multi-step flow with retention offers
- `components/sections/billing/DisclaimerBlock.tsx` — subscription disclosure copy (subscription-terms link)

## Related

- [`04-auth.md`](./04-auth.md) — sign-in prompt before paywall
- [`05-uploads-conversions.md`](./05-uploads-conversions.md) — dashboard paywall gate
- [`06-pdf-editor.md`](./06-pdf-editor.md) — export paywall trigger
- [`16-locked-paths.md`](./16-locked-paths.md) — paywall files are locked
