---
name: project-current-work
description: Active branch main — Solidgate billing hardening + Apple Pay rollout
metadata: 
  node_type: memory
  type: project
  originSessionId: 21a02c5b-a731-423b-9d9a-e1e14136e521
---

Active branch as of 2026-08-03: `main` (branched off `feat/doc_versions`, merged since).

**Current focus:** Solidgate billing hardening + Apple Pay rollout under the Solidgate aggregator model.

**Recent shipped work (post `feat/doc_versions` merge):**
- `a689030` — migrated payment SDK from `solid-form.js` to `charge-auth.js` (fixes 3DS OTP click-swallow bug)
- `f2b6f1a` — React Aria outside-click handler no longer swallows 3DS clicks
- `5a82d96` — host Solidgate-aggregator Apple Pay domain-association file
- `70716ab` — strip trailing newline from that file (Apple rejects otherwise)
- `849c8ad` — set `enabled: true` explicitly on `applePayButtonParams` + `googlePayButtonParams` (SDK defaults these to undefined/false when the params object is present)

**In flight / pending external:**
- Apple Pay button visibility on staging + prod → all code green, blocked on Solidgate merchant-side Apple verification. See [[2026-08-03-apple-pay-diagnostic]] for full evidence trail + reply drafted to Hamza.
- 1-click upsells (item 4 of [[2026-07-31-solidgate-audit]]) — awaiting product spec.
- Annual subscription — paused per Uzair. `SOLIDGATE_PRODUCT_ANNUAL` not set on Railway prod. Annual UI option in PaywallModal is currently a dead element.

**Why:** Solidgate integrator's 2026-07-31 audit surfaced 5 items; items 1, 2, 5 shipped in that session, item 3 (Apple Pay) shipped 2026-07-31 → 2026-08-03. This spec exists because Apple Pay's silent-failure modes made the "button not visible" symptom look like a code bug when the actual blocker was Solidgate-side verification.

**How to apply:** When Uzair references paywall / Solidgate / Apple Pay / Google Pay work, cross-check [[2026-07-31-solidgate-audit]] and [[2026-08-03-apple-pay-diagnostic]] before touching code. Domain-association file at `public/.well-known/apple-developer-merchantid-domain-association` is aggregator-provided — do not regenerate without a fresh file from Solidgate Hub. Do not pass `apple_pay_merchant_domain` in payment_intent (aggregator model resolves it from hosted file).
