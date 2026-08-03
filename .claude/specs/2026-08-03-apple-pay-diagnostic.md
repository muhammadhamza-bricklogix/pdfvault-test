---
name: 2026-08-03-apple-pay-diagnostic
description: Apple Pay button not rendering — flipped format twice before finding Solidgate's canonical CDN file at cdn.solidgate.com/apple/... Real root cause was a 2-byte typo in the human-transcribed original commit.
metadata: 
  node_type: memory
  type: project
  originSessionId: 21a02c5b-a731-423b-9d9a-e1e14136e521
---

# Apple Pay visibility diagnostic — 2026-08-03 session

Uzair reported the Apple Pay button was not visible on staging or production after enabling it. This session verified every layer of our integration and traced the blocker to Solidgate's side.

## TL;DR — verdict

**Canonical file lives at Solidgate's CDN:** `https://cdn.solidgate.com/apple/apple-developer-merchantid-domain-association.txt` (9118 bytes, MD5 `022ab7b28e7cb3ea45d82c3f69b62dc0`, unchanged since 2021-10-27). Every merchant under Solidgate's aggregator hosts THAT exact file verbatim. Documented at <https://docs.solidgate.com/payments/integrate/payment-form/apple-pay-button/>.

**Real root cause:** commit `5a82d96` (Hamza's transcription of the file into our repo) had a **2-byte typo** at offsets 1196 and 1198 — two hex chars `3` and `5` were swapped in the middle of the signature field. Solidgate's byte-for-byte verifier caught it and complained "the 2 files are still not the same." All the "hex vs raw JSON" churn during this session was chasing the wrong bug.

Client + backend wiring was correct throughout. Backend sends `apple_pay_merchant_name: "PDFVault"` in every `payment_intent`. Frontend SDK + refs + params all correct. `apple_pay_merchant_name` value is unrestricted (Solidgate confirmed).

**Format churn during this session (don't repeat):**

1. `5a82d96` + `70716ab`: hex-encoded 9118 bytes, but **2-byte typo** vs canonical ✗ WRONG (but format-correct)
2. `f17dd82` — my mistaken "fix": misread `head -c 200` output as a hex-view of `{"pspId":…}` when it was the literal file content. Decoded with `xxd -r -p` to raw JSON 4559 bytes ✗ WRONG format
3. `0d0b9f5` — my "revert": restored from `70716ab` (still had the 2-byte typo) ✗ STILL WRONG
4. This commit — replaced with `curl https://cdn.solidgate.com/apple/apple-developer-merchantid-domain-association.txt` output ✓ CORRECT

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

## Root cause — 2-byte typo in Hamza's transcription

The real bug was a byte-level mismatch, not a format mismatch. Solidgate's byte-for-byte verifier compares against the file at their CDN. Our repo copy differed by exactly two bytes at offsets 1196 and 1198 — two hex characters (`3` and `5`) were transposed in the middle of the signature field. Verifier flagged mismatch; we assumed the WHOLE format was wrong; we thrashed.

**Definitive fix — use Solidgate's canonical CDN file:**

```bash
curl -s https://cdn.solidgate.com/apple/apple-developer-merchantid-domain-association.txt \
  > public/.well-known/apple-developer-merchantid-domain-association

md5 public/.well-known/apple-developer-merchantid-domain-association
# expect: 022ab7b28e7cb3ea45d82c3f69b62dc0
```

`cmp -l` between the wrong hex file (from commit `70716ab`) and the CDN canonical showed exactly 2 differing bytes:

```
  1196  63  65     (CDN='3' vs repo='5')
  1198  65  63     (CDN='5' vs repo='3')
```

Solidgate rarely rotates this file — last-modified 2021-10-27. Should be considered a static asset. Don't ever hand-edit it.

**Note on the Solidgate reply attachment:** the base64/PKCS7 file Solidgate attached (`MIIQXwYJKoZIhvcN…`) decodes to a payload for domain `tryastro.org` team `RP423FWHCR` — a different customer's Apple-standard (non-aggregator) file. Solidgate support attached the wrong file by mistake. Ignore that attachment; the hex string in the message body was the correct hint (though hosting the CDN file directly is even more reliable than transcribing from their message).

**Guard:** `public/.well-known/README.md` now documents the CDN URL as the single source of truth with the MD5 to verify against. Never re-transcribe.

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

## Reply to Solidgate (send after canonical file deployed)

> Root cause found: our file matched the correct format (uppercase hex, 9118 bytes) but had a 2-byte typo at offsets 1196 and 1198 — two hex chars were transposed in the middle of the signature field. Verifier caught it every time.
>
> Fix: replaced our copy with the canonical file from `https://cdn.solidgate.com/apple/apple-developer-merchantid-domain-association.txt` (MD5 `022ab7b28e7cb3ea45d82c3f69b62dc0`). Both domains now serve the identical bytes:
> - https://pdfvault.ai/.well-known/apple-developer-merchantid-domain-association
> - https://staging.pdfvault.ai/.well-known/apple-developer-merchantid-domain-association
>
> Please re-run Apple verification for both domains.
>
> Two side-notes for your team:
> 1. The `MIIQXw…` file you attached decodes to `teamId=RP423FWHCR domain=tryastro.org` — looks like a different customer's file. Might be worth a ticket to whoever attached it.
> 2. It would help future integrations if the Solidgate Hub "Add Domain" flow linked to your CDN URL rather than delivering the file over Slack/email — humans transcribing a 9118-byte hex string introduce byte-level typos that look identical to a format bug.

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
