---
name: 2026-08-03-apple-pay-diagnostic
description: Apple Pay button not rendering on staging/prod — full stack diagnostic confirmed everything on our side is correct. Blocked on Solidgate-side Apple verification.
metadata: 
  node_type: memory
  type: project
  originSessionId: 21a02c5b-a731-423b-9d9a-e1e14136e521
---

# Apple Pay visibility diagnostic — 2026-08-03 session

Uzair reported the Apple Pay button was not visible on staging or production after enabling it. This session verified every layer of our integration and traced the blocker to Solidgate's side.

## TL;DR — verdict

**Nothing to fix in our code.** All 7 client + hosting checks pass. Backend already sends `apple_pay_merchant_name: "PDFVault"` in every `payment_intent`. Solidgate integrator (Hamza) confirmed they use the **aggregator model** — we host the file, they verify with Apple. Blocker is on Solidgate's server-side action, not ours.

## Verification matrix (all passed)

| Check | Prod (pdfvault.ai) | Staging (staging.pdfvault.ai) | Source |
|---|---|---|---|
| File hosted → HTTP 200 | ✓ | ✓ | `curl -sI` |
| `Content-Type: text/plain` | ✓ | ✓ | `curl -sI` |
| Bytes match repo (9118 exact) | ✓ | ✓ | `diff` |
| No trailing newline | ✓ | ✓ | commit `70716ab` fix intact |
| Middleware skips `.well-known` | ✓ | ✓ | `proxy.ts:75` |
| Client `enabled: true` on both wallets | ✓ | ✓ | `PaywallModal.tsx:57-63` |
| charge-auth SDK loaded before form mounts | ✓ | ✓ | `PaywallModal.tsx:35-44` |
| Container refs exist before `<PaymentForm>` | ✓ | ✓ | `PaywallModal.tsx:596-667` |
| Backend passes `apple_pay_merchant_name` | ✓ | ✓ | `pdf-viewer-backend/src/billing/services/solidgate.service.ts:123` |

File content: starts `7B 22 70 73 70 49 64 22 3A 22 38 38 45 30 34 36 33 31 …` → `{"pspId":"88E04631…"}`. Legit signed Solidgate aggregator payload.

## Solidgate aggregator model (important — do not confuse with self-managed Apple Pay)

Message from Hamza (Solidgate) confirms:

> Under our umbrella. In a process, we require that you host a verification file on a live domain at `HTTPS://[DOMAIN_NAME]/.well-known/apple-developer-merchantid-domain-association`. Then, we verify it with Apple ourselves — at the end you're all set and would be just passing your `apple_pay_merchant_name` within the payment intent.
>
> You do not even touch Apple configuration or Merchant certificates management, we do it for you.

**Consequences for our code:**
- We do NOT manage an Apple Developer account, an Apple merchant ID, or Apple Pay certificates.
- We do NOT pass `apple_pay_merchant_domain` in the payment_intent — Solidgate resolves it from the file we host. Backend comment at `solidgate.service.ts:119-122` already warns against this.
- We DO pass `apple_pay_merchant_name` — currently hardcoded as `"PDFVault"` in `solidgate.service.ts:123`.
- We DO host the domain-association file at `/.well-known/…` (both prod + staging).

## Blocker

Solidgate needs to finish THEIR half:
1. Register both `pdfvault.ai` and `staging.pdfvault.ai` under our Solidgate merchant's Apple Pay config.
2. Send them to Apple for verification (their side, no action from us).
3. Confirm `"PDFVault"` is the correct `apple_pay_merchant_name` string, or send the exact whitelisted value we should use.

## Reply drafted to Hamza (send this)

> Hi Hamza,
>
> File is hosted and returning HTTP 200 + `Content-Type: text/plain` on both domains:
> - https://pdfvault.ai/.well-known/apple-developer-merchantid-domain-association
> - https://staging.pdfvault.ai/.well-known/apple-developer-merchantid-domain-association
>
> Same signed aggregator payload on both (9118 bytes, no trailing newline, starts `{"pspId":"88E04631…"}`).
>
> Backend already passes `apple_pay_merchant_name: "PDFVault"` inside `payment_intent`. charge-auth.js SDK loaded on frontend with `applePayButtonParams: { enabled: true, integrationType: "js", type: "plain", color: "black" }`.
>
> Please confirm:
> 1. Both domains are added under our Solidgate merchant's Apple Pay config
> 2. Apple verification is completed on your side
> 3. `"PDFVault"` is the correct `apple_pay_merchant_name` value — or send the string we should use
>
> Once verified I'll test in Safari on macOS + iOS. Thanks.

## Test procedure (after Hamza confirms)

Apple Pay button will only render when ALL of these are true:
1. Safari on macOS 12+ or iOS 15+ (Chrome/Firefox/Edge = silent no-op, no console error)
2. Device has Apple Pay set up (card in Wallet + Touch/Face ID configured)
3. Exact verified HTTPS domain (`https://pdfvault.ai` or `https://staging.pdfvault.ai` — NOT `*.up.railway.app`, NOT `localhost`)
4. Solidgate has completed Apple verification for that domain

Trigger paywall → Pay step. Button appears ABOVE the "or pay with card" divider (`PaywallModal.tsx:666-676`).

## Why this is easy to misdiagnose

Silent failure modes make this look like a code bug when it's not:
- Non-Safari browser → SDK renders nothing, no console warning
- Unverified domain → SDK renders nothing, no console warning
- Verified but device has no Wallet card → SDK renders nothing, no console warning
- Testing on Railway preview URL → SDK renders nothing, no console warning

The only way to differentiate "our bug" vs "Solidgate not verified yet" is to enumerate every layer, which this session did. Future symptoms of "Apple Pay not showing" — run this same matrix first, don't touch code until every row is green AND Solidgate confirms verification on their side.

## Update to prior spec

This closes out item **3 — Digital Wallets (Apple Pay / Google Pay)** in [[2026-07-31-solidgate-audit]]. That spec's status matrix marked it as "skipped per Uzair's instruction 2026-07-31" — Uzair changed direction and shipped the integration between 2026-07-31 and 2026-08-03. Frontend + backend wiring complete as of `849c8ad` (2026-08-03). Blocked on Solidgate merchant-side verification only.

## Solidgate MCP limitation (reference)

Solidgate's MCP server has NO domain-management endpoint. Available tools: `configure_credentials`, `get_subscriptions`, `get_subscription_status`, `cancel_subscription`, `pause_subscription`, `restore_subscription`, `check_order_status`, `refund_order`. Domain registration + Apple verification is Hub-UI or support-ticket only. Don't waste tool searches looking for a "verify domain" API — it doesn't exist.
