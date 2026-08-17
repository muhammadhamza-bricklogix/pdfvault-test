---
name: 2026-07-31-solidgate-audit
description: "Client audit of Solidgate integration — 5 action items around 3DS focus, SDK migration, digital wallets, 1-click upsells, and hard-cancel webhook. Ships fixes for 1, 2, 5. Blocked on 3, 4."
metadata:
  node_type: memory
  type: project
  originSessionId: 8d1c4623-b8ec-44f4-b9e2-703b6a685ed7
---

# Solidgate audit — 2026-07-31 session

Hamza's Solidgate payment integrator delivered a 5-item audit. This spec captures the original items, what shipped, what's blocked, and the exact test procedures.

## Original audit (verbatim from client)

**Action items:**

1. **3DS Window Focus (High)** — Review the 3DS challenge flow: the window renders above the payment form but isn't clickable, as focus lands on the form behind it, which prevents OTP entry. (Pressing ESC closes the underlying form and makes 3DS clickable, but no success screen shows after the payment.) Consider adjusting the modal layering/focus handling. (video reference attached)

2. **SDK (High)** — Please execute a migration from `solid-form.js` to `charge-auth.js`. Reference PDF: `assets/Charge-Auth Payment SDKs.pdf` in the repo.

**Recommendations:**

3. **Digital Wallets (High)** — Consider implementing Apple Pay and Google Pay buttons on the form to broaden coverage and improve conversion.

4. **1-Click Upsells (Med)** — Consider adopting 1-click for card upsells and re-displaying the wallet button for AP/GP re-authentication.

5. **Hard Cancel (Med)** — Consider revoking user access on the `subscription.update status=canceled` webhook.

## Status matrix

| #   | Item                            | Ship state                                                                                               | Verified?                                                                              | Commits                              |
| --- | ------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------ |
| 1   | 3DS focus                       | ✅ shipped (charge-auth + defensive modal fix)                                                           | ⏳ needs sandbox re-test with `f2b6f1a`                                                | `a689030`, `f2b6f1a`                 |
| 2   | SDK migration to charge-auth.js | ✅ shipped                                                                                               | ✅ verified (`cdn.charge-auth.com/js/form.js` loaded on paywall)                       | `a689030`                            |
| 3   | Apple Pay / Google Pay          | ⚠️ code already wired pre-audit; domain-verify infra shipped; skipped per Hamza's instruction 2026-07-31 | ❌ (no merchant-side enablement done)                                                  | `a689030` (domain-verify infra only) |
| 4   | 1-Click Upsells                 | ❌ not started                                                                                           | —                                                                                      | —                                    |
| 5   | Hard cancel webhook             | ✅ shipped                                                                                               | ✅ backend flip verified via Solidgate Hub cancel; ⚠️ frontend billing-page copy stale | backend `827cde3`                    |

## Item 1 + 2 — 3DS focus fix + SDK migration (both fixed together)

### Root cause

Old SDK `solid-form.js` renders 3DS challenge as a nested iframe layered inside our HeroUI `Modal.Dialog`. Two things fought:

1. **React Aria's Dialog `FocusScope contain`** — keyboard focus was yanked back to our card form iframe when the 3DS overlay tried to focus its OTP input.
2. **React Aria's `useInteractOutside`** — document-level `mousedown` listener installed by `Modal.Backdrop` fired first on any click, treated Solidgate's body-portaled 3DS overlay as "outside", and started closing our modal before the click reached Confirm.

Client's ESC workaround closed our modal → released the focus/click blockers → 3DS became interactive. But closing the modal also unmounted `PaymentForm` → its `onSuccess` callback couldn't fire → "no success screen after payment" symptom.

### Fix v1 — SDK migration (`a689030`)

**File**: `components/sections/billing/PaywallModal.tsx:25-42`.

One-line effective change inside the dynamic import:

```ts
const PaymentForm = dynamic(
  async () => {
    const m = await import("@solidgate/react-sdk");
    await m.SdkLoader.load("https://cdn.charge-auth.com/js/form.js");
    return m.default;
  },
  { ssr: false },
);
```

`SdkLoader` re-exported from `@solidgate/client-sdk-loader`. `SdkLoader.load(sdkUrl?: string)` returns `Promise<ClientSdk | null>` — awaiting inside the dynamic factory guarantees the runtime is swapped before `PaymentForm` mounts.

**What it changes at runtime**: same React SDK, same `PaymentForm` component, same props. Underlying form runtime is swapped from `cdn.solidgate.com/js/solid-form.js` to `cdn.charge-auth.com/js/form.js`. When 3DS fires, charge-auth opens the challenge as a browser popup (or full-page redirect on mobile) instead of a nested iframe. Popup lives outside our HeroUI Modal's DOM → focus trap can't reach it → click backdrop can't intercept it.

Same commit also shipped Apple Pay domain-verification infrastructure (see item 3).

**Verified**: Network tab on `staging.pdfvault.ai` shows `GET https://cdn.charge-auth.com/js/form.js 200` when paywall's PayStep opens.

### Fix v2 — Defensive modal patch (`f2b6f1a`)

Sandbox testing revealed charge-auth's popup path doesn't kick in for Solidgate's sandbox "3DS Challenge Simulator" — the simulator renders as an inline overlay portaled to `document.body`. Same class of clickability bug reproduced.

**File**: `components/sections/billing/PaywallModal.tsx:311`.

```tsx
<Modal.Backdrop
  isDismissable={false}   // ← added
  isOpen={isOpen}
  onOpenChange={...}
>
```

`isDismissable={false}` tells React Aria to skip installing the document-level `mousedown` outside-click handler. Clicks on Solidgate's 3DS overlay now reach the target directly. Users still close the modal via the X `Modal.CloseTrigger` and ESC (`isKeyboardDismissDisabled` remains default `false`).

**Bonus UX win**: accidental background click no longer wipes the entered card mid-payment.

**Complements charge-auth**: production banks that return a popup ACS URL benefit from the SDK migration. Older banks or edge cases returning inline ACS iframes benefit from this defensive patch. Both belt AND braces.

### Auth-flow-guardian invariants (all preserved)

Both fixes touched `PaywallModal.tsx`. That file owns invariants 6 and 7 in the CLAUDE.md "Auth + paywall + export flow" section:

- Invariant 6 — `ErrorState` renders "Sign in & continue" on `/sign in|401|not authori[sz]ed/i` errors. **Not touched.**
- Invariant 7 — `finish` calls only `onPaymentSuccess`, not `onClose`. **Not touched.**

### Test procedure

Once `f2b6f1a` is deployed to Railway staging (~2-3 min after push):

1. **Ensure sub is cancelled** so paywall fires. If you have an active sub, cancel via Solidgate sandbox Hub (see item 5 procedure).
2. **DevTools setup**: Network tab → **check Preserve log + Disable cache**. Keep DevTools open throughout.
3. **Trigger paywall**: any paywalled action (Download → DOCX, Compress → Extreme).
4. **Verify SDK**: Network tab, search `charge-auth`. Expected: `GET https://cdn.charge-auth.com/js/form.js 200`.
5. **Enter test card** (see "Solidgate sandbox test cards" section below).
6. **Verify item 1 assertion**: when the 3DS Challenge Simulator appears, the Confirm Payment button is clickable on first tap. No ESC required.
7. **Complete flow**: Confirm Payment → simulator closes → our modal advances to Success screen.

### Solidgate sandbox test cards (verified from docs.solidgate.com)

**Success (no 3DS)** — sanity check the form works:

| Card                  | Brand                               |
| --------------------- | ----------------------------------- |
| `4067 4299 7471 9265` | Visa                                |
| `5329 7774 4531 9300` | Mastercard                          |
| `4111 1111 1111 1111` | Visa (industry-standard Luhn-valid) |

**3DS challenge**:

| Card                 | Notes                                           |
| -------------------- | ----------------------------------------------- |
| `4975 9277 0594 980` | 15 digits, unusual format, may need 4-digit CVV |

Hamza's merchant channel is `content-clicks_sandbox` (public key `api_pk_94747637_19a0_46f2_b1dc_56812a7497e9`). If none of the above trigger 3DS, contact Solidgate support to enable 3DS test cards on this channel OR use amount-based trigger (`amount: 666` cents = "success with 3DS challenge" in Solidgate sandbox) — requires temporary backend override since our checkout intent locks to $0.99.

**Cards I mistakenly named earlier** (do NOT use, they fail Luhn): `4067 4291 0000 0000`, `4067 4291 0209 6714`, `4067 4291 0087 8073`.

**Sandbox OTP**: usually `1234`.

## Item 3 — Apple Pay / Google Pay (skipped this session)

Code was already wired pre-audit in `PayStep`:

- `applePayContainerRef`, `googlePayContainerRef` — required detached container refs.
- `applePayButtonParams`, `googlePayButtonParams` passed to `<PaymentForm>`.
- Both containers use `empty:hidden` so they auto-hide when SDK doesn't render a button.

**What shipped this session (`a689030`)** — Apple Pay domain-verification infra:

- `next.config.mjs` — Content-Type `text/plain` header for `/.well-known/apple-developer-merchantid-domain-association`.
- `proxy.ts` (Clerk middleware) — `matcher` excludes `.well-known/**` so the domain-association file isn't gated by auth.
- `public/.well-known/README.md` — placement instructions.

**Remaining work (merchant-side, NOT code)**:

- Solidgate Hub → enable Apple Pay + Google Pay on the channel.
- Apple Developer Console → register merchant ID → verify domain → download `apple-developer-merchantid-domain-association` file → place at `public/.well-known/apple-developer-merchantid-domain-association`.
- Google Pay & Wallet Console → business verification.

**Testing** (after merchant setup): Safari on iOS/macOS with Touch ID → Apple Pay button appears. Chrome on Android or desktop Chrome with saved card → Google Pay button appears.

## Item 4 — 1-Click Upsells (blocked)

Not started. Blocked on product decisions:

1. **When does the upsell prompt appear?** — after first successful download / after N uses / only on cancel-flow retention.
2. **What plan does it upsell to?** — annual (needs `SOLIDGATE_PRODUCT_ANNUAL` seeded first; see "Open loop" section) / bundle / higher tier.
3. **Where does the CTA render?** — toast / full modal / inline banner.
4. **What copy?**

Once specced, implementation path: use `charge-auth.js` to charge the customer's existing saved payment method with a fresh server-side `POST /charge` intent. No card re-entry. 3DS handled by the same popup flow the migration provided.

## Item 5 — Hard cancel webhook (shipped + backend-verified)

### Business policy change (surface if reversed)

Client requirement: on `subscription.update status=canceled` webhook, revoke user access **immediately**. This **reverses the 2026-07-23 grace-window decision** ("honor the paid window and let them keep converting until the period ends"). Hamza explicitly chose "Full hard cancel — revoke immediately, always" via AskUserQuestion on 2026-07-31, knowing the downside: users cancelling mid-period lose the remaining paid days (potential refund/chargeback risk).

**Why:** [[feedback_off_limits_revisable]] — when a bug fix conflicts with an off-limits/skill-log decision, surface and apply. Hamza revised prior calls.

### Backend change (`827cde3`)

**File**: `src/billing/services/subscription.service.ts` (backend repo `pdf-viewer-backend`).

Removed the grace-window branch in `isEntitled`:

```ts
// REMOVED:
// if (sub.status === "CANCELLED" && sub.currentPeriodEnd > new Date()) return true;
```

Now: any `CANCELLED` row = not entitled, immediately. Applies to:

- Solidgate Hub cancel → `subscription.update status=canceled` webhook → local upsert to CANCELLED → not entitled.
- User's dashboard "Cancel subscription" button → controller flips local to CANCELLED → not entitled (identical semantics).
- Advanced hard-cancel escape hatch (`POST /billing/subscription/hard-cancel`) → same result.

**Also updated comment in `billing.controller.ts`** soft-cancel controller (lines ~322-336) — updated doc to reflect new policy so future readers don't get confused by stale 2026-07-23 rationale.

**Backend deploy**: Railway service `pdf-viewer-backend` in Staging environment (project ID `99e13786-ab62-4697-a8fb-9f28b862f6ae`, service ID `ecff3aca-0bbb-4bed-83de-58162255c036`, env ID `58bdf358-349b-4acf-aa95-3a73a7e5ad5e`). Commit `827cde3` deployed 2026-07-31 17:28 UTC — status SUCCESS.

### Verified on staging (2026-07-31 ~17:54 UTC)

Hamza's subscription `ad413e6c-3e32-477d-9873-e48c027990b6` cancelled via Solidgate sandbox Hub with `cancel_code: 8.06` ("Cancellation by support"). Webhook fired → backend flipped `status=CANCELLED` → sidebar on `/dashboard/settings/billing` changed from "Ac" (active) to "🔒 Unlock access". Paywall re-engaged on next paywalled action.

### Frontend UI copy — STILL STALE (follow-up needed)

`/dashboard/settings/billing` displays:

- "Cancelled — access continues" ← wrong under new policy
- "Access until Aug 7, 2026" ← wrong, access ended immediately

Copy is keyed off `cancelledButActive` (backend field, `Boolean(cancelledAt) && currentPeriodEnd > now`). Under the new policy, `cancelledButActive` is true but `entitled` is false — user has cancelled AND lost access, but the period-end date hasn't passed. Fix requires frontend edits to `components/sections/billing/InvoicesTable.tsx` or wherever the billing settings page composes.

**Not yet touched.** Cosmetic, not blocking.

### Consolidation opportunity (not urgent)

`POST /billing/subscription/cancel` and `POST /billing/subscription/hard-cancel` are now behaviorally equivalent from an entitlement standpoint. Only difference: hard-cancel `updateMany`s to nuke duplicate rows + bumps `currentPeriodEnd` to now. Consider removing the Advanced endpoint OR keeping as duplicate-row cleanup escape hatch.

## Git history

Commits shipped this session on `main` (frontend `muhammad-Hamza029` / `muhammadhamza-bricklogix/pdf-viewer-app` repo):

| Commit    | Purpose                                                                           |
| --------- | --------------------------------------------------------------------------------- |
| `a689030` | feat(billing): migrate to charge-auth.js SDK + prep Apple Pay domain verification |
| `f2b6f1a` | fix(paywall): stop React Aria outside-click handler from swallowing 3DS clicks    |

Backend (`muhammadhamza-bricklogix/pdf-viewer-backend`):

| Commit    | Purpose                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------- |
| `827cde3` | fix(billing): update cancellation policy and entitlement logic for subscriptions (hard-cancel) |

## Open loops carried into next session

1. **Verify item 1 + 2 end-to-end after `f2b6f1a` deploys** — retest the Solidgate sandbox 3DS Simulator. Confirm Payment button should be clickable on first tap. If still blocked, escalate: check DOM ancestry via Right-click Inspect on the button + Tab-Enter keyboard fallback.

2. **Frontend billing-page copy cleanup** — update `/dashboard/settings/billing` to reflect hard-cancel policy. Change "access continues" → "access ended", hide/rephrase "Access until <future>", keep Renew CTA.

3. **Item 4 spec** — Hamza owes product decisions on 1-click upsell trigger, target plan, placement, copy.

4. **Annual plan** — `SOLIDGATE_PRODUCT_ANNUAL` env var still NOT set on Railway staging or in local `.env` of backend. Hamza backed off pursuing this ("stop the annual subscription stuff for now") — annual paywall option is currently a dead UI element. See earlier decision to hide annual from the PaywallModal picker; that work was partially started then reverted by Hamza. Confirm intended state before re-attempting.

5. **Repo credential hygiene** — backend repo `.git/config` has GitHub PAT `ghp_...` in cleartext in the remote URL. Rotate the token in GitHub Settings + swap remote to SSH or `gh` auth. Flagged 2026-07-31, not yet done.

6. **Consolidate soft/hard cancel endpoints** — see item 5's "Consolidation opportunity".

## Related memories

- [[project_current_work]] — Hamza's active branch context.
- [[feedback_off_limits_revisable]] — precedent for reversing prior product decisions (used here for the 2026-07-23 grace window reversal).
- CLAUDE.md "Auth + paywall + export flow" section — invariants 6 and 7 protect the pieces of PaywallModal touched this session.
