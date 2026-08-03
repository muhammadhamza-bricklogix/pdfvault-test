---
name: 2026-08-03-apple-pay-diagnostic
description: Apple Pay button not rendering on staging/prod — root cause was a double-hex-encoded domain-association file. Fixed by hex-decoding + redeploying.
metadata: 
  node_type: memory
  type: project
  originSessionId: 21a02c5b-a731-423b-9d9a-e1e14136e521
---

# Apple Pay visibility diagnostic — 2026-08-03 session

Uzair reported the Apple Pay button was not visible on staging or production after enabling it. This session verified every layer of our integration and traced the blocker to Solidgate's side.

## TL;DR — verdict

**Client + backend wiring was correct; hosted file was WRONG.** Backend correctly sends `apple_pay_merchant_name: "PDFVault"` in every `payment_intent`. Frontend SDK + refs + params all correct. BUT the domain-association file we were hosting was **double-encoded** — bytes were the ASCII characters `"7B22707370…"` (hex representation of `{"pspId":…`), not the literal JSON bytes Solidgate expected. Solidgate's byte-for-byte compare against Apple failed with "the 2 files are still not the same." Fixed 2026-08-03 by `xxd -r -p` decode + replace + push. Solidgate re-verifying after redeploy.

Also confirmed by Solidgate: `apple_pay_merchant_name` has **no restrictions** — any string that customers will recognize on the Apple Pay sheet is fine. `"PDFVault"` stays.

## Verification matrix (all passed)

| Check | Prod (pdfvault.ai) | Staging (staging.pdfvault.ai) | Source |
|---|---|---|---|
| File hosted → HTTP 200 | ✓ | ✓ | `curl -sI` |
| `Content-Type: text/plain` | ✓ | ✓ | `curl -sI` |
| Bytes match repo (~~9118~~ 4559 exact after fix) | ✓ (post-fix) | ✓ (post-fix) | `diff` |
| No trailing newline | ✓ | ✓ | commit `70716ab` fix intact |
| **File is raw JSON, NOT hex-encoded** | ✓ (post-fix) | ✓ (post-fix) | `head -c 20` must print `{"pspId":"88E04631` |
| Middleware skips `.well-known` | ✓ | ✓ | `proxy.ts:75` |
| Client `enabled: true` on both wallets | ✓ | ✓ | `PaywallModal.tsx:57-63` |
| charge-auth SDK loaded before form mounts | ✓ | ✓ | `PaywallModal.tsx:35-44` |
| Container refs exist before `<PaymentForm>` | ✓ | ✓ | `PaywallModal.tsx:596-667` |
| Backend passes `apple_pay_merchant_name` | ✓ | ✓ | `pdf-viewer-backend/src/billing/services/solidgate.service.ts:123` |

## Root cause — file was double-hex-encoded

Solidgate came back after initial verification attempt: **"the 2 files are still not the same — validation failed."**

Diagnosis:

```
$ head -c 20 public/.well-known/apple-developer-merchantid-domain-association
7B227073704964223A22383845303436

$ xxd public/.well-known/… | head -1
00000000: 3742 3232 3730 3733 3730 3439 3634 3232  7B22707370496422
```

Every byte in the file was `0x37 0x42 0x32 0x32 …` — the ASCII bytes for the characters `"7"`, `"B"`, `"2"`, `"2"`. So the file was **double-encoded**: someone took the binary/JSON Solidgate provided and turned each byte into two ASCII hex characters before saving.

**The initial diagnostic in the "TL;DR" and "matrix" above was WRONG.** I read `head -c 200`'s output as a hex-view of `{"pspId":"88E04631"}`, but that same output was actually the *literal file content*. Both interpretations look identical in a terminal — the tell is that the real file must start with byte `0x7B` (a `{` character), not the ASCII bytes for the string `"7B"`.

Fix:

```bash
xxd -r -p public/.well-known/apple-developer-merchantid-domain-association \
  > /tmp/fixed && mv /tmp/fixed public/.well-known/apple-developer-merchantid-domain-association
```

After decode:
- Size: 9118 → 4559 bytes (halved, matches the hex→bin 2:1 ratio)
- First bytes: literal `{"pspId":"88E046314E5A179C5015C4585D4A96CA223A2F0249671F9A8426EE8C151889CE","version":1,"createdOn":1633962250699,"signature":"3080…"}`
- Ends with `"}` (no trailing newline preserved — commit `70716ab` intent kept)

Guard: `public/.well-known/README.md` now has a "Pitfall — do NOT hex-encode the file" section with a `head -c 20` sanity check and the `xxd -r -p` fix recipe. Don't reintroduce.

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

## Post-fix status

After the hex-decode fix + push + redeploy:
1. Ping Solidgate integrator to re-run verification for `pdfvault.ai` and `staging.pdfvault.ai`.
2. On success, Solidgate confirms `Verified` in Hub → Apple Pay → Domains.
3. Test in Safari on real Apple device (see procedure below).

`apple_pay_merchant_name`: Solidgate confirmed 2026-08-03 there are **no restrictions** — any string customers will recognize on the Apple Pay sheet is fine. `"PDFVault"` stays.

## Reply to Solidgate (post-fix, send this)

> Thanks for flagging — you were right, the files didn't match. Root cause on our side: the file had been saved double-encoded (each byte as two ASCII hex characters, so `{"pspId":…` became the literal string `"7B227073704964…"`). Solidgate's byte-for-byte compare against Apple would always fail against that.
>
> Fixed and pushed. Both domains now serve the raw 4559-byte JSON:
> - https://pdfvault.ai/.well-known/apple-developer-merchantid-domain-association
> - https://staging.pdfvault.ai/.well-known/apple-developer-merchantid-domain-association
>
> Sanity check either domain — `curl` should return content starting with `{"pspId":"88E046314E5A179C…"`, size 4559 bytes, `Content-Type: text/plain`.
>
> Please re-run verification for both domains. On `apple_pay_merchant_name`: thanks for confirming no restrictions — we'll keep `"PDFVault"`.

## Test procedure (after Hamza confirms)

Apple Pay button will only render when ALL of these are true:
1. Safari on macOS 12+ or iOS 15+ (Chrome/Firefox/Edge = silent no-op, no console error)
2. Device has Apple Pay set up (card in Wallet + Touch/Face ID configured)
3. Exact verified HTTPS domain (`https://pdfvault.ai` or `https://staging.pdfvault.ai` — NOT `*.up.railway.app`, NOT `localhost`)
4. Solidgate has completed Apple verification for that domain

Trigger paywall → Pay step. Button appears ABOVE the "or pay with card" divider (`PaywallModal.tsx:666-676`).

## Why this is easy to misdiagnose

Silent failure modes make this look like a code bug when it's not:
- **Domain-association file byte-mismatch** (this session's root cause) → SDK renders nothing, no console warning. Sanity-check with `head -c 20` on the hosted file — must be JSON, not hex.
- Non-Safari browser → SDK renders nothing, no console warning
- Unverified domain → SDK renders nothing, no console warning
- Verified but device has no Wallet card → SDK renders nothing, no console warning
- Testing on Railway preview URL → SDK renders nothing, no console warning

The only way to differentiate "our bug" vs "Solidgate not verified yet" is to enumerate every layer, which this session did. Future symptoms of "Apple Pay not showing" — run this same matrix first, don't touch code until every row is green AND Solidgate confirms verification on their side.

## Update to prior spec

This closes out item **3 — Digital Wallets (Apple Pay / Google Pay)** in [[2026-07-31-solidgate-audit]]. That spec's status matrix marked it as "skipped per Uzair's instruction 2026-07-31" — Uzair changed direction and shipped the integration between 2026-07-31 and 2026-08-03. Frontend + backend wiring complete as of `849c8ad` (2026-08-03). Blocked on Solidgate merchant-side verification only.

## Solidgate MCP limitation (reference)

Solidgate's MCP server has NO domain-management endpoint. Available tools: `configure_credentials`, `get_subscriptions`, `get_subscription_status`, `cancel_subscription`, `pause_subscription`, `restore_subscription`, `check_order_status`, `refund_order`. Domain registration + Apple verification is Hub-UI or support-ticket only. Don't waste tool searches looking for a "verify domain" API — it doesn't exist.
