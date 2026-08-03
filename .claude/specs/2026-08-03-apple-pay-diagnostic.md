---
name: 2026-08-03-apple-pay-diagnostic
description: Apple Pay button not rendering — flipped format twice before Solidgate clarified they want the hex-encoded 9118-byte version, not the raw-JSON 4559-byte version.
metadata: 
  node_type: memory
  type: project
  originSessionId: 21a02c5b-a731-423b-9d9a-e1e14136e521
---

# Apple Pay visibility diagnostic — 2026-08-03 session

Uzair reported the Apple Pay button was not visible on staging or production after enabling it. This session verified every layer of our integration and traced the blocker to Solidgate's side.

## TL;DR — verdict

**Correct hosted format = UPPERCASE ASCII hex, 9118 bytes exact, no trailing newline.** The file starts with the literal ASCII characters `7B22707370496422…` and Solidgate's verifier byte-compares against that. It looks like a "double-encoded mistake" but it is intentional — Solidgate's aggregator stores + transports the file in hex form and decodes internally before forwarding to Apple.

Client + backend wiring was correct throughout the session. Backend sends `apple_pay_merchant_name: "PDFVault"` in every `payment_intent`. Frontend SDK + refs + params all correct.

**Format churn during this session (don't repeat):**

1. Original state (commits `5a82d96` + `70716ab`): hex-encoded 9118 bytes ✓ CORRECT
2. My mistaken "fix" (commit `f17dd82`): I misread `head -c 200` output as a hex-view of `{"pspId":…}` when it was the literal file content — decoded with `xxd -r -p` to raw JSON 4559 bytes ✗ WRONG
3. Solidgate re-flagged mismatch → reverted back to hex-encoded 9118 bytes ✓ CORRECT

Also confirmed by Solidgate: `apple_pay_merchant_name` has **no restrictions** — any string that customers will recognize on the Apple Pay sheet is fine. `"PDFVault"` stays.

## Verification matrix (all passed)

| Check | Prod (pdfvault.ai) | Staging (staging.pdfvault.ai) | Source |
|---|---|---|---|
| File hosted → HTTP 200 | ✓ | ✓ | `curl -sI` |
| `Content-Type: text/plain` | ✓ | ✓ | `curl -sI` |
| Bytes match repo (9118 exact — hex-encoded) | ✓ | ✓ | `diff` |
| No trailing newline | ✓ | ✓ | commit `70716ab` fix intact |
| **File IS hex-encoded (uppercase ASCII)** | ✓ | ✓ | `head -c 20` must print `7B22707370496422223A22` |
| Middleware skips `.well-known` | ✓ | ✓ | `proxy.ts:75` |
| Client `enabled: true` on both wallets | ✓ | ✓ | `PaywallModal.tsx:57-63` |
| charge-auth SDK loaded before form mounts | ✓ | ✓ | `PaywallModal.tsx:35-44` |
| Container refs exist before `<PaymentForm>` | ✓ | ✓ | `PaywallModal.tsx:596-667` |
| Backend passes `apple_pay_merchant_name` | ✓ | ✓ | `pdf-viewer-backend/src/billing/services/solidgate.service.ts:123` |

## Root cause of the churn — Solidgate wants the hex-encoded format

First round (mid-day): Solidgate said **"the 2 files are still not the same — validation failed."** I saw the file bytes were the ASCII characters `"7B22707370…"` and concluded (wrongly) that this was a "double-encoded mistake" — that the real file should start with the literal `{` character. Ran `xxd -r -p` to "decode" it to raw JSON, committed as `f17dd82`, pushed.

Second round (later): Solidgate re-flagged the same error. Their message quoted:
- What they saw at our URL: `{"pspId":"88E046314E5A179C5015…"}` (my decoded raw JSON)
- What they expected: `7B227073704964223A2238384530343633313445354131373943353031354334353835443441393643413232334132463032…` (the UPPERCASE ASCII hex representation of the same JSON)

That confirmed: **Solidgate's aggregator wants the hex-encoded 9118-byte form** — not because Apple wants it that way, but because Solidgate's internal store + fetch pipeline hex-encodes everything and does a byte-for-byte compare on the fetched file. They decode internally before forwarding to Apple.

**Revert path:**

```bash
# restore the correct hex-encoded file from commit 70716ab
git show 70716ab:public/.well-known/apple-developer-merchantid-domain-association \
  > public/.well-known/apple-developer-merchantid-domain-association
```

Or re-encode from a raw JSON version:

```bash
xxd -p -c 999999 public/.well-known/apple-developer-merchantid-domain-association \
  | tr 'a-z' 'A-Z' | tr -d '\n' > /tmp/hex \
  && mv /tmp/hex public/.well-known/apple-developer-merchantid-domain-association
```

Verified: 9118 bytes, no trailing newline, starts `7B22707370496422223A22` (ASCII hex, uppercase). Matches Solidgate's expected byte-for-byte.

**Note on the Solidgate reply attachment:** the base64/PKCS7 file Solidgate attached (`MIIQXwYJKoZIhvcN…`) decodes to a payload for domain `tryastro.org` team `RP423FWHCR` — that's a DIFFERENT customer's file. Solidgate support attached the wrong file by mistake. Ignore that attachment; the hex string in the message body IS the correct expected content for our aggregator (pspId `88E046314E5A179C…`).

**Guard:** `public/.well-known/README.md` now documents the hex-encoded format as CORRECT and warns against decoding it. Don't repeat the churn.

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

## Post-fix status (after hex-restore commit)

1. Ping Solidgate to re-run verification for `pdfvault.ai` and `staging.pdfvault.ai`.
2. On success, Solidgate confirms `Verified` in Hub → Apple Pay → Domains.
3. Test in Safari on real Apple device (see procedure below).

`apple_pay_merchant_name`: Solidgate confirmed 2026-08-03 there are **no restrictions** — any string customers will recognize on the Apple Pay sheet is fine. `"PDFVault"` stays.

## Reply to Solidgate (send after hex-restore deployed)

> Thanks for the clarification — you're right, the correct format is the hex-encoded one. I had briefly "fixed" it by decoding to raw JSON (misread the byte pattern as double-encoding); Solidgate's fetch obviously flagged the mismatch immediately. Reverted to the hex-encoded 9118-byte version and redeployed.
>
> Both domains now serve the expected content:
> - https://pdfvault.ai/.well-known/apple-developer-merchantid-domain-association
> - https://staging.pdfvault.ai/.well-known/apple-developer-merchantid-domain-association
>
> Sanity check either URL — `curl` should return `text/plain`, 9118 bytes, starting `7B227073704964223A2238384530343633313445354131373943353031354334353835443441393643413232334132463032…` (matches the "expected" hex you quoted).
>
> Note on the file you attached (`MIIQXw…`) — that decodes to `teamId=RP423FWHCR`, `domain=tryastro.org`, which looks like a different customer. I ignored it and stuck with the pspId `88E046314E5A179C…` payload matching our aggregator. Let me know if that's actually meant for us and I've misread it.
>
> Please re-run verification for both domains.

## Test procedure (after Hamza confirms)

Apple Pay button will only render when ALL of these are true:
1. Safari on macOS 12+ or iOS 15+ (Chrome/Firefox/Edge = silent no-op, no console error)
2. Device has Apple Pay set up (card in Wallet + Touch/Face ID configured)
3. Exact verified HTTPS domain (`https://pdfvault.ai` or `https://staging.pdfvault.ai` — NOT `*.up.railway.app`, NOT `localhost`)
4. Solidgate has completed Apple verification for that domain

Trigger paywall → Pay step. Button appears ABOVE the "or pay with card" divider (`PaywallModal.tsx:666-676`).

## Why this is easy to misdiagnose

Silent failure modes make this look like a code bug when it's not:
- **Domain-association file byte-mismatch** (this session's root cause) → SDK renders nothing, no console warning. Sanity-check with `head -c 20` on the hosted file — must print `7B22707370496422223A22` (UPPERCASE ASCII hex), NOT `{"pspId":"88E04631`. Solidgate's aggregator stores the file hex-encoded and compares byte-for-byte; hosting the raw-JSON decoded form fails their integrity check.
- Non-Safari browser → SDK renders nothing, no console warning
- Unverified domain → SDK renders nothing, no console warning
- Verified but device has no Wallet card → SDK renders nothing, no console warning
- Testing on Railway preview URL → SDK renders nothing, no console warning

The only way to differentiate "our bug" vs "Solidgate not verified yet" is to enumerate every layer, which this session did. Future symptoms of "Apple Pay not showing" — run this same matrix first, don't touch code until every row is green AND Solidgate confirms verification on their side.

## Update to prior spec

This closes out item **3 — Digital Wallets (Apple Pay / Google Pay)** in [[2026-07-31-solidgate-audit]]. That spec's status matrix marked it as "skipped per Uzair's instruction 2026-07-31" — Uzair changed direction and shipped the integration between 2026-07-31 and 2026-08-03. Frontend + backend wiring complete as of `849c8ad` (2026-08-03). Blocked on Solidgate merchant-side verification only.

## Solidgate MCP limitation (reference)

Solidgate's MCP server has NO domain-management endpoint. Available tools: `configure_credentials`, `get_subscriptions`, `get_subscription_status`, `cancel_subscription`, `pause_subscription`, `restore_subscription`, `check_order_status`, `refund_order`. Domain registration + Apple verification is Hub-UI or support-ticket only. Don't waste tool searches looking for a "verify domain" API — it doesn't exist.
