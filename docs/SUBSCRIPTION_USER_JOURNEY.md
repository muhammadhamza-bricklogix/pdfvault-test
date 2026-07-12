# PDFVault Subscription — User Journey

**Audience:** Product, engineering, support, and QA.
**Scope:** How a real user moves through the paywall funnel from discovery to cancellation. Covers the happy path, edge cases, and every screen / event / API call that fires along the way.
**Companion doc:** [`../../pdf-viewer-backend/docs/subscription/00-discovery.md`](https://github.com/muhammadhamza-bricklogix/pdf-viewer-backend/blob/features/subscription/docs/subscription/00-discovery.md) — architecture + integration contract.

---

## TL;DR

- **Free by default** — editing a PDF (open, save to vault, annotate, edit text, sign, watermark) is free. Sign-in is not required to start.
- **Paywall triggers at value moment** — the very first time the user asks the backend to convert, export a downloadable file, share publicly, or run a bulk PDF-tool operation, the paywall fires.
- **7-day trial for $0.99** — one-time trial charge, then $25/month recurring. Full disclosure shown adjacent to the pay button.
- **Solidgate iframe** — card data never touches PDFVault's servers. Apple Pay + Google Pay + card, all inside the Solidgate-hosted iframe.
- **Cancel anytime** — dashboard button, two-step flow captures reason then finalises.
- **Access continues until period end** — cancellation is not instant termination; the user still gets what they paid for.

---

## The user journey, screen by screen

### 1. Discovery — landing page

**URL:** `/`

The landing page is fully open. No signup wall. The upload workspace on the hero accepts any supported file (PDF, DOC, DOCX, JPG, PNG). Nothing about pricing is surfaced until value has been proven.

**Behaviour:**
- User drops a file → uploaded → routed to `/pdf-composer` in the browser.
- If signed out, the upload → editor path still works — the file lives in the client-side Zustand store during the session.

**Nothing paywalled here.**

---

### 2. Free editing — the PDF Composer

**URL:** `/pdf-composer` (also served under `/pdf-editor` as a legacy redirect)

The editor is intentionally generous:

- Text edit, draw, highlight, shape, eraser
- Watermark, background image
- Page rotate, reorder, split, insert blank, delete
- Password protect (client-side)
- Save the working document to the user's vault (requires sign-in)

**All of the above is free forever.** The competitor's model is edit-to-download; ours is edit-freely-charge-on-download.

Behind the scenes: nothing in `/pdf-composer` calls a paywalled backend endpoint. The user can produce an entire finished document without a subscription.

---

### 3. The value moment — first paywalled action

The paywall fires the first time the user requests something the backend has to do work for:

| Action | Backend endpoint | Gated? |
|---|---|---|
| Convert PDF → Word/Excel/PPT/HTML/TXT/JPG/PNG | `POST /conversion` | ✅ |
| Convert Word/Excel/PPT/JPG/PNG → PDF | `POST /conversion` | ✅ |
| Compress PDF | `POST /pdf-tools/compress` | ✅ |
| Encrypt / password-protect (server-side) | `POST /pdf-tools/encrypt` | ✅ |
| Decrypt (remove password) | `POST /pdf-tools/decrypt` | ✅ |
| Flatten annotations | `POST /pdf-tools/flatten` | ✅ |
| Extract images | `POST /pdf-tools/extract-images` | ✅ |
| Create shareable link | `POST /shares` | ✅ |
| Save edits to vault | `POST /documents/upload` | ❌ FREE |
| Read vault documents | `GET /documents` | ❌ FREE |
| Read invoices / subscription | `GET /billing/*` | ❌ FREE |

The gate is a single greppable const in [`lib/config/api-client.ts`](../lib/config/api-client.ts):

```ts
const PAYWALL_GATED_PREFIXES = [
  "/conversion",
  "/pdf-tools/compress",
  "/pdf-tools/encrypt",
  "/pdf-tools/decrypt",
  "/pdf-tools/flatten",
  "/pdf-tools/extract-images",
  "/shares",
];
```

**How the trigger works transparently:**

1. User clicks Convert / Download / Share.
2. The axios request interceptor sees the URL prefix + reads a module-level `entitledSnapshot` (kept in sync by `useSubscriptionQuery`).
3. Not entitled? → `requestPaywall()` on the paywall bus → `<PaywallModal>` opens.
4. The original request is paused until the modal resolves.

No individual button needs to know about the paywall. Adding a new gated endpoint is a one-line addition to `PAYWALL_GATED_PREFIXES`.

---

### 4. The paywall — "Last step to unlock your file"

**Component:** [`components/sections/billing/PaywallModal.tsx`](../components/sections/billing/PaywallModal.tsx)

**Sequence:**

```
User clicks Convert
    │
    ├── Interceptor sees /conversion + not entitled
    │
    ├── requestPaywall() opens PaywallModal
    │
    ├── PaywallModal on mount:
    │     POST /billing/checkout-intent
    │       Body: { disclaimerVersion: "2026-07-12.v1" }
    │       Backend writes ConsentRecord row FIRST
    │       Backend calls Solidgate SDK formMerchantData()
    │       Backend returns:
    │         { merchant, paymentIntent (encrypted), signature,
    │           orderId, amountTodayMinor: 99, amountRenewMinor: 2500,
    │           renewalDate, currency: "USD" }
    │
    ├── Modal renders:
    │     ┌────────────────────────────────────┐
    │     │ Last step to unlock your file      │
    │     │ 7-day trial for $0.99              │
    │     │                                    │
    │     │ [ Verbatim disclaimer block ]      │
    │     │                                    │
    │     │ [ Solidgate iframe: PaymentForm ]  │  ← @solidgate/react-sdk
    │     │   - Apple Pay button              │
    │     │   - Google Pay button             │
    │     │   - Card input fields             │
    │     │   - Solidgate's own pay button     │
    │     └────────────────────────────────────┘
    │
    ├── User picks payment method, pays
    │
    ├── Iframe fires 'success' event
    │     - invalidateSubscription() invalidates TanStack Query cache
    │     - Paywall bus resolves → axios releases the queued request
    │     - Toast: "Payment received. Your access is unlocked."
    │
    └── Original /conversion call runs → user gets their file
```

**PCI scope:** off-box. Card data never touches PDFVault's DOM or servers. The iframe is served by Solidgate, sandboxed via `sandbox` attribute + cross-origin isolation.

---

### 5. The verbatim disclaimer — legal + compliance

Rendered directly above the iframe. Non-collapsible, non-hidden, always visible before the user pays.

> **By continuing, you agree you will be charged $0.99 today for a 7-day trial and $25 automatically every 30 days thereafter unless you cancel before your trial ends. You can cancel auto-renewing charges through your online account, by emailing payments@pdfvault.ai before your next monthly renewal date. Prices may change. See our Subscription Policy and Refund Policy for full details.**

The two numeric amounts (`$0.99` and `$25`) are interpolated from the server response, never hardcoded — the disclaimer always reflects what the user will actually be charged.

Every paywall render writes a `ConsentRecord` row with:

- `userId`
- `disclaimerVersion` (bumped whenever the copy changes)
- `amountTodayMinor`, `amountRenewMinor`
- `renewalDate`, `currency`
- `ip`, `userAgent`
- `createdAt`

This is the paper trail we hand to a card scheme during a chargeback dispute: "user saw disclaimer version 2026-07-12.v1 on {timestamp} from {ip}, agreed to be charged $0.99 today and $25 at renewal on {date}."

**Rule:** if the ConsentRecord write fails for any reason, the backend does NOT return a signed intent. No charge is ever possible without a stored consent.

---

### 6. Payment states from the user's perspective

| State | What the user sees | Server truth |
|---|---|---|
| Paying | Iframe spinner during 3DS challenge / bank auth | Solidgate holds |
| Success | Green toast, iframe collapses, download runs | Webhook: `subscription.trial_started` → `TRIALING` |
| Declined | Red toast, modal stays open for retry | No state change |
| 3DS failed | Red toast, modal stays open for retry | No state change |
| Cancelled (X on modal) | Modal closes, no toast, no charge | `PaywallCancelledError` on the queued request |

**We never mutate subscription state from a client event** — webhooks are the sole source of truth. This defends against the "iframe said success but the charge silently failed" class of bug.

---

### 7. Post-purchase — trial period

**Duration:** 7 days from the trial charge.

**During the trial:**

- All gated actions succeed transparently (no paywall).
- Dashboard `/dashboard/settings/billing` shows:
  - Status pill: **Trial** (green)
  - Trial ends: `<date>`
  - Next renewal: `<same date>`
  - Cancel button
- **~24h before renewal** — SES sends an "Upcoming renewal reminder" email (Phase 6, needs SES production access to fire in prod).

**At trial end + 1 second:**

- Solidgate charges $25.00.
- Webhook: `subscription.recurring_success` (or the Solidgate equivalent) → local status flips `TRIALING → ACTIVE`, `Payment` row inserted, `Invoice` link stored on the Payment, receipt email sent.

**If the card fails at renewal:**

- Solidgate's smart-retry chain kicks in (default: 4 attempts over ~7 days).
- Webhook fires `subscription.recurring_failed` → local status flips `ACTIVE → PAST_DUE`.
- User still has access during `PAST_DUE` (the "grace" window) — this deliberately avoids kicking out a user during a temporary card blip.
- Dunning email sent via SES.
- If retries exhaust → `PAST_DUE → CANCELLED`.

---

### 8. Managing the subscription — dashboard

**URL:** `/dashboard/settings/billing`

**Component:** [`components/sections/dashboard/settings/billing-settings-section.tsx`](../components/sections/dashboard/settings/billing-settings-section.tsx)

**Layout:**

```
Your subscription
─────────────────────────────────────
Plan:        PDFVault Pro          [ Trial ]
Trial ends:  17 Jul 2026
Next renewal: 17 Jul 2026

[ Cancel subscription ]

You can also cancel by emailing payments@pdfvault.ai
before your next renewal.

Invoices
─────────────────────────────────────
Date         Invoice      Amount   Status    PDF
12 Jul 2026  INV-4291     $0.99    approved  Download
```

**States rendered on the plan card:**

| Local status | Display | Buttons |
|---|---|---|
| `NONE` | "No subscription" | (none — should not reach this page) |
| `TRIALING` | Green "Trial" pill + trial-end date | Cancel |
| `ACTIVE` | Green "Active" pill + next renewal date | Cancel |
| `PAST_DUE` | Amber "Payment past due" pill | Cancel |
| `CANCELLED` but `currentPeriodEnd > now` | "Cancelled — access continues" + access-until date | **Renew** |
| `CANCELLED` and past period end | "Cancelled" | (paywall re-triggers on next gated action) |
| `PAUSED` | Muted "Paused" pill | (see support) |

The **email-to-cancel** line (`payments@pdfvault.ai`) is mandatory compliance copy — self-serve cancel exists AND the email fallback must be advertised alongside it, per FTC negative-option / click-to-cancel guidance.

---

### 9. Cancellation flow — two-step

**Component:** [`components/sections/billing/CancellationFlow.tsx`](../components/sections/billing/CancellationFlow.tsx)

Triggered by the "Cancel subscription" button on the billing tab.

#### Step 1 — Feedback capture ("Before you go")

- **Categorical question** (single select):
  1. Unforeseen circumstances
  2. Lacks features I need
  3. Too expensive
  4. I only needed it once
  5. Too buggy
  6. Switching to a different tool
  7. Other
- **Free text** (optional, up to 2000 chars): "What would make you use PDFVault regularly?"

**Cancel my subscription** button → step 2.

The categorical answer is translated by the backend into a Solidgate `cancel_code` string via a mapping table in `billing.controller.ts`. Also stored locally on `Subscription.cancelReasonCode` + `cancelReasonText` for retention analytics.

#### Step 2 — Confirmation ("You're all set")

- `POST /billing/subscription/cancel` with:
  - `reason` (the categorical answer from step 1)
  - `freeText` (optional)
- Backend calls Solidgate `cancelSubscription` with `cancelAtPeriodEnd: true` + the mapped `cancel_code`.
- Webhook: `subscription.cancelled` → local status flips to `CANCELLED`, `cancelledAt` populated, `currentPeriodEnd` stays in place.
- Confirmation screen: "Your subscription has been cancelled. You'll continue to have access until the end of your current billing period."
- Cancellation confirmation email sent via SES.

**Downsells (dropped):** an earlier version of the spec included a 1-year 90%-off downsell followed by a 2-year lock-in. Removed per product decision. The `CancellationOffer` model + `DOWNSELL_1Y` / `DOWNSELL_2Y` plan kinds remain in the schema so retention flows can be re-added later without a migration.

---

### 10. Post-cancellation — the grace window

While `CANCELLED` but `currentPeriodEnd > now`:

- All gated actions still work (paid-for period is honoured).
- Billing tab shows "Cancelled — access continues" and an access-until date.
- **Renew subscription** button appears → `POST /billing/subscription/restore` → Solidgate `restoreSubscription` → status flips back to `ACTIVE` on the resulting webhook.

At `currentPeriodEnd`:
- Solidgate stops billing, no webhook needed to flip our state — the reconciliation job picks it up nightly.
- The next gated action re-triggers the paywall (fresh trial? no — user goes straight to $25/mo unless the finance team seeds a "returning user" plan).

---

### 11. Invoices

Each successful payment (trial charge, monthly renewal, downsell payment) produces:

- A local `Payment` row with `invoiceNumber` + `invoiceUrl` populated from the Solidgate webhook payload.
- A row in the invoices table on `/dashboard/settings/billing`:
  - Date, invoice number, amount, status, download link.
- The download link opens the **Solidgate-hosted PDF** directly (`target="_blank"` + `rel="noopener noreferrer"`) — we don't proxy PDF bytes, keeping our servers thin.

Refunds appear as a separate row with `type: REFUND` + `status: REFUNDED`.

---

### 12. Emails the user receives

Sent via SES from `receipts@pdfvault.ai`, reply-to `payments@pdfvault.ai`. Never contain passwords or credentials — the `EmailService.send()` method refuses any body containing a `password:` / `password=` line as a defensive backstop.

| Event | Email |
|---|---|
| Trial started | Charge amount + renewal date + amount |
| Upcoming renewal (~24h before) | Amount + date + "cancel via dashboard" link |
| Renewal success | Receipt with invoice number |
| Renewal failed | "Your card was declined. We'll retry over the next few days." + update-card link |
| Cancellation confirmed | Access-until date + "Changed your mind? Renew here" link |
| "Don't forget your file" (behavioural) | Fires if user edited a doc but didn't hit Convert / Export |

---

## Edge cases and how they're handled

### The user cancels the paywall modal

The axios request that triggered the paywall throws `PaywallCancelledError`. Callers get a "Payment required" state instead of a network error. No charge attempted.

### The iframe reports success but the webhook never arrives

**Impossible in theory** because the webhook is the source of truth. In practice:

- The client shows success (unlock proceeds).
- The nightly reconciliation job calls Solidgate `getSubscription`, sees the trial as active, and creates the local `Subscription` row.
- Recovery window: up to 24h in the worst case.

If a user complains about being charged but no access: check `Payment` table for the `solidgateOrderId`; run reconciliation manually.

### Duplicate webhook delivery

Every event is keyed on `WebhookEvent.eventKey` (Solidgate event id, order id, or a body hash as fallback). Duplicate delivery hits the unique-index, gets logged, returns 200, no side effects re-run. Solidgate stops retrying.

### The user pays on their phone and refreshes the tab

State is server-side. On refresh, `useSubscriptionQuery` fetches the current status, entitlement snapshot flips, next gated action works.

### The card fails at renewal

- Solidgate smart-retry (4 attempts by default).
- Status: `ACTIVE → PAST_DUE` on first failure.
- User still has access.
- Dunning email sent.
- Terminal failure → `PAST_DUE → CANCELLED` at end of retry window.

### The user reports "I was charged twice"

Check the `Payment` table filtered by `userId`. Each row corresponds to a unique `solidgateOrderId`; there is exactly one row per Solidgate order. If two rows exist, both were real charges — refund via Solidgate Hub and process a `REFUND` webhook.

### The compliance disclaimer copy needs to change

1. Update `DISCLAIMER_TEMPLATE` in [`lib/shared/constants/billing.ts`](../lib/shared/constants/billing.ts).
2. Bump `DISCLAIMER_VERSION` (format: `YYYY-MM-DD.vN`).
3. Deploy. Every `ConsentRecord` written after the deploy carries the new version tag; the audit log stays intact for old versions.

Never edit an old `DISCLAIMER_VERSION` value retroactively — you'd break the audit trail.

### The feature flag is off (`BILLING_ENABLED=false`)

- Frontend: `useSubscriptionQuery` returns `entitled: true` for everyone → paywall never triggers.
- Backend: `EntitlementService` short-circuits to true → no gates enforce.
- Checkout intent endpoint refuses to sign envelopes ("Billing is not enabled in this environment.")
- Safe default for staging or a controlled rollout.

---

## Metrics + observability

**Metrics to monitor:**

- **Trial start rate** = `count(Subscription where status='TRIALING') / count(users who saw the paywall)`
- **Trial → paid conversion** = `count(subs that reached ACTIVE from TRIALING) / count(subs that started TRIALING)`
- **Voluntary churn** = users who cancelled during a period
- **Involuntary churn** = users where `PAST_DUE → CANCELLED` via terminal card failure
- **MRR** = `sum(Subscription.plan.recurringAmountMinor / plan.intervalMonths) where status IN (ACTIVE, TRIALING)`

**Alerts (Phase 8):**

- Webhook signature-verification failure spike → potential spoofing attempt or Solidgate key rotation.
- Reconciliation job drift > 5% → webhook delivery outage.
- Trial → paid conversion drop > 20% week-over-week → paywall or checkout regression.
- SES bounce rate > 5% → sender reputation risk.

**Structured logs** include:

- Every webhook delivery: event key, event type, verification result, processing outcome.
- Every checkout intent: user id, plan kind, disclaimer version — never the secret / signature.
- Every downsell decision: tier + accepted / rejected + timestamp.

Secrets (Solidgate secret key, webhook secret) are NEVER logged anywhere. A CI job at Phase 8 greps the `next build` output for known secret prefixes as a last-line defence.

---

## Support playbook — common tickets

| User says | First check | Then |
|---|---|---|
| "I was charged but don't have access" | `Payment` row for their user id + `Subscription.status` | If status is `TRIALING`/`ACTIVE` → clear their browser cache. If not → run reconciliation for that sub id. |
| "I want a refund" | `Payment.solidgateOrderId` | Refund via Solidgate Hub → `order.refunded` webhook → `Payment` row updates automatically. |
| "The paywall keeps popping" | Their `entitled` flag on `GET /billing/subscription` | If false, check `Subscription.currentPeriodEnd`. If past, they're outside the grace window — expected behaviour. |
| "I can't cancel" | Try `POST /billing/subscription/cancel` from the dashboard button | If it errors, fall back to Solidgate Hub → Subscriptions → Cancel. |
| "I never got a receipt" | SES send logs by their email | If not sent, verify SES sender is out of sandbox mode. |
| "I don't remember agreeing to a subscription" | `ConsentRecord` rows for their user id | Ship the row (disclaimer version + timestamp + IP + UA) to legal. |

---

## Related files

**Frontend:**
- [`lib/config/api-client.ts`](../lib/config/api-client.ts) — global paywall gate (axios interceptors)
- [`lib/client/hooks/billing/`](../lib/client/hooks/billing/) — paywall bus + entitlement snapshot + hook
- [`components/sections/billing/`](../components/sections/billing/) — modal + disclaimer + cancellation + invoices UI
- [`app/(app)/dashboard/settings/billing/page.tsx`](../app/(app)/dashboard/settings/billing/page.tsx) — billing settings tab
- [`lib/shared/constants/billing.ts`](../lib/shared/constants/billing.ts) — disclaimer template + version

**Backend** (in `pdf-viewer-backend` repo):
- `src/billing/billing.controller.ts` — checkout intent, subscription, cancel, restore, downsell, invoices
- `src/billing/services/solidgate.service.ts` — SDK wrapper + webhook verify
- `src/billing/services/webhook-processor.service.ts` — state machine
- `src/billing/webhooks/solidgate-webhook.controller.ts` — raw-body receiver
- `src/billing/queues/reconcile.processor.ts` — nightly drift repair
- `src/email/email.service.ts` — SES transactional templates
- `prisma/schema.prisma` — 6 billing models

---

*Last updated: 2026-07-12. Bump this timestamp when the funnel changes.*
