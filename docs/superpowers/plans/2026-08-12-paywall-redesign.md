# Paywall Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the PayStep (step 2 of PaywallModal) to match the pdfguru layout — payment buttons + card form + features on the left, document preview on the right — and update all plan prices/labels.

**Architecture:** All changes are confined to `components/sections/billing/PaywallModal.tsx`. PlanStep gets price label + plan ID renames. PayStep gets a full column swap: payment (left, white) + document preview (right, cream). The `preview` prop is threaded from `PaywallModal` down into `PayStep`.

**Tech Stack:** Next.js 16 App Router, React, Tailwind CSS v4, HeroUI v3, `@solidgate/react-sdk`

## Global Constraints

- Do NOT touch Solidgate SDK wiring (`merchantData`, `onSuccess`, `onFail`, `onError`, `onMounted`, wallet button refs, retry logic).
- Do NOT modify any file listed in `.claude/LOCKED_PATHS`.
- Tailwind v4 — no `@apply`, no `theme()` calls; inline arbitrary values only.
- `CREAM = "#fdf3f0"` stays as the cream background constant.
- Prices are UI-only labels; backend amounts come from `intent.amountTodayMinor` / `intent.amountRenewMinor` via `formatMinor()`.
- Run `bunx tsc --noEmit && bun run lint` and verify zero errors before pushing.

---

### Task 1: Rename plan IDs, update prices, labels, and disclaimers in PlanStep

**Files:**
- Modify: `components/sections/billing/PaywallModal.tsx`

**Interfaces:**
- `PlanId` type changes from `"trial" | "annual"` → `"monthly" | "annual"`
- All internal references to `"trial"` plan ID update to `"monthly"`

- [ ] **Step 1: Update `PlanId` type and all its usages**

In `PaywallModal.tsx`, change:

```tsx
// Line ~71
type PlanId = "monthly" | "annual";
```

Then update every reference to the `"trial"` string value:

```tsx
// useState default (line ~119)
const [selectedPlan, setSelectedPlan] = useState<PlanId>("monthly");

// Reset in useEffect (line ~141)
setSelectedPlan("monthly");

// handleContinue guard (line ~291)
const handleContinue = () => {
  if (selectedPlan === "monthly") {
    setStep("pay");
    return;
  }
  // annual branch unchanged
  ...
};

// PLAN_ORDER constant (line ~1110)
const PLAN_ORDER: readonly PlanId[] = ["monthly", "annual"] as const;
```

- [ ] **Step 2: Update price constants and plan display data**

```tsx
// PlanStep local constants (lines ~401-402)
const fullAccessPrice = "$25";
const annualPrice = "$300";
```

In `PlanAccordion`, update the `plans` array:

```tsx
const plans: PlanRow[] = [
  {
    id: "monthly",
    title: "Monthly Plan",
    price: fullAccessPrice,
    priceSuffix: "per month",
    badge: "Most popular",
    highlight: true,
  },
  {
    id: "annual",
    title: "Annual Plan",
    price: annualPrice,
    priceSuffix: "per year",
  },
];
```

- [ ] **Step 3: Update PayStep plan-name labels**

In `PayStep`, the plan label for "monthly" (was "trial") currently reads "7-Day Full Access Trial". Update:

```tsx
// In the order-summary card inside PayStep
<p className="pv-heading text-[15px] font-semibold text-[#1a1c21]">
  {selectedPlan === "annual" ? "Annual Plan" : "Monthly Plan"}
</p>

// Renewal row label
<p className="text-[13px] text-[#5c5c5c]">
  {selectedPlan === "annual" ? "Renews yearly" : "Renews monthly"}
</p>
```

- [ ] **Step 4: Update PlanStep disclaimer text**

Replace the `selectedPlan === "trial"` branch in the disclaimer with `selectedPlan === "monthly"`:

```tsx
{selectedPlan === "monthly" ? (
  <p className="mx-auto max-w-3xl text-center text-[11px] leading-relaxed text-[#6c6c6c]">
    You are enrolling in a monthly subscription to pdfvault.ai. You&apos;ll
    be charged {today} per month until you cancel. Payments will be charged
    from the card you specified below. To cancel, visit your{" "}
    <a
      className="text-[var(--pv-brand-red,#f12c23)] underline underline-offset-2"
      href="/dashboard/settings/billing"
    >
      account settings
    </a>
    , see our{" "}
    <a
      className="text-[var(--pv-brand-red,#f12c23)] underline underline-offset-2"
      href="/subscription-terms"
    >
      Subscription Terms
    </a>
    , or email{" "}
    <a
      className="text-[var(--pv-brand-red,#f12c23)] underline underline-offset-2"
      href="mailto:support@pdfvault.ai"
    >
      support@pdfvault.ai
    </a>
    .
  </p>
) : (
  // annual disclaimer unchanged
)}
```

Also update the inline small-print in PayStep:

```tsx
<p className="text-[11px] leading-relaxed text-[#6c6c6c]">
  By continuing you agree to be charged {today}{" "}
  {selectedPlan === "annual"
    ? "today, then $300 every 365 days"
    : "per month"}{" "}
  unless cancelled. See our{" "}
  <a ...>Subscription</a> &amp; <a ...>Refund</a> policies.
</p>
```

- [ ] **Step 5: Update SuccessStep copy (remove trial language)**

```tsx
// Line ~877
<p className="mt-2 text-[13px] leading-relaxed text-[#5c5c5c]">
  Your subscription is active. You now have full access to every PDFVault
  tool.
</p>
```

Also update the receipt card in SuccessStep:

```tsx
<span className="font-semibold text-[#1a1c21]">
  Full Access · {selectedPlan === "annual" ? "Annual" : "Monthly"}
</span>
```

Wait — `SuccessStep` doesn't currently receive `selectedPlan`. Add it to its props:

```tsx
function SuccessStep({
  intent,
  selectedPlan,
  onFinish,
}: {
  intent: CheckoutIntent;
  selectedPlan: PlanId;
  onFinish: () => void;
})
```

And pass it from the render site inside `PaywallModal`:

```tsx
<SuccessStep intent={intent} selectedPlan={selectedPlan} onFinish={finish} />
```

- [ ] **Step 6: TypeScript check**

```bash
bunx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 7: Lint**

```bash
bun run lint
```

Expected: 0 errors (warnings OK for `no-console`).

- [ ] **Step 8: Commit**

```bash
git add components/sections/billing/PaywallModal.tsx
git commit -m "feat(billing): update paywall plan IDs, prices, and disclaimer text"
```

---

### Task 2: Redesign PayStep layout — payment left, preview right

**Files:**
- Modify: `components/sections/billing/PaywallModal.tsx`

**Interfaces:**
- `PayStep` now accepts `preview: PaywallPreview | null`
- `PaywallModal` passes `preview` to `<PayStep>`

- [ ] **Step 1: Add `preview` prop to PayStep signature**

```tsx
function PayStep({
  intent,
  onSuccess,
  onFail,
  payFailed,
  retryKey,
  retryLoading,
  onRetry,
  selectedPlan,
  preview,                          // ← add this
}: {
  intent: CheckoutIntent;
  onSuccess: (message?: { order?: { subscription_id?: string } }) => void;
  onFail: () => void;
  payFailed: boolean;
  retryKey: number;
  retryLoading: boolean;
  onRetry: () => void;
  selectedPlan: PlanId;
  preview: PaywallPreview | null;   // ← add this
})
```

- [ ] **Step 2: Thread `preview` from PaywallModal into PayStep**

In `PaywallModal`'s render, update the `<PayStep>` usage:

```tsx
<PayStep
  intent={intent}
  payFailed={payFailed}
  preview={preview}              // ← add this line
  retryKey={retryKey}
  retryLoading={retryLoading}
  selectedPlan={selectedPlan}
  onFail={handleIframeFail}
  onRetry={handleRetry}
  onSuccess={handleIframeSuccess}
/>
```

- [ ] **Step 3: Replace PayStep JSX with the new layout**

Replace the entire `return (...)` block of `PayStep` with:

```tsx
return (
  <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
    {/* ── Left column — payment (white) ── */}
    <div className="flex flex-col gap-0">
      {/* Total due today header */}
      <div className="flex items-baseline justify-between border-b border-[#ececec] px-6 py-5 md:px-8">
        <span className="text-[14px] font-medium text-[#5c5c5c]">
          Total due today:
        </span>
        <span className="pv-heading text-[22px] font-bold text-[#1a1c21]">
          {today}
        </span>
      </div>

      <div className="flex flex-col gap-4 p-6 md:p-8">
        {/* Express checkout label */}
        <p className="text-[13px] font-semibold uppercase tracking-wide text-[#1a1c21]">
          Express checkout
        </p>

        {/* Wallet buttons — Solidgate mounts Apple/Google Pay here */}
        <div className="flex flex-col gap-2">
          <div
            ref={googlePayContainerRef}
            className="empty:hidden overflow-hidden rounded-xl [&>*]:!min-h-[48px] [&>*]:!w-full [&_iframe]:!min-h-[48px] [&_iframe]:!w-full [&_iframe]:!rounded-xl"
          />
          <div
            ref={applePayContainerRef}
            className="empty:hidden overflow-hidden rounded-xl [&>*]:!min-h-[48px] [&>*]:!w-full [&_iframe]:!min-h-[48px] [&_iframe]:!w-full [&_iframe]:!rounded-xl"
          />
        </div>

        {/* or pay with card divider */}
        <div className="relative flex items-center gap-3 has-[+_.rounded-xl:only-child]:hidden">
          <div className="h-px flex-1 bg-[#ececec]" />
          <span className="text-[11px] uppercase tracking-wide text-[#9a9a9a]">
            or pay with card
          </span>
          <div className="h-px flex-1 bg-[#ececec]" />
        </div>

        {/* Solidgate card form */}
        <div className="rounded-xl">
          <PaymentForm
            key={retryKey}
            applePayButtonParams={APPLE_PAY_BUTTON_PARAMS}
            applePayContainerRef={applePayContainerRef}
            googlePayButtonParams={GOOGLE_PAY_BUTTON_PARAMS}
            googlePayContainerRef={googlePayContainerRef}
            merchantData={{
              merchant: intent.merchant,
              signature: intent.signature,
              paymentIntent: intent.paymentIntent,
            }}
            width="100%"
            onError={(error) => {
              logger.error("[paywall] Solidgate iframe error", error);
            }}
            onFail={onFail}
            onMounted={() => {
              logger.info("[paywall] Solidgate iframe mounted");
            }}
            onSuccess={onSuccess}
          />
        </div>

        {/* Decline retry banner */}
        {payFailed ? (
          <div
            aria-live="polite"
            className="flex flex-col gap-2 rounded-xl border border-danger-200 bg-danger-50 p-4 text-[13px] text-danger-800 dark:border-danger-800 dark:bg-danger-900/20 dark:text-danger-200"
          >
            <p className="font-semibold">
              Your card was declined and hasn&apos;t been charged.
            </p>
            <p>
              Try another card or contact your bank. You can re-enter details
              below.
            </p>
            <button
              className="mt-1 inline-flex h-10 w-fit cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--pv-brand-red,#f12c23)] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#d8241c] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={retryLoading}
              type="button"
              onClick={onRetry}
            >
              {retryLoading ? "Preparing…" : "Try another card"}
            </button>
          </div>
        ) : null}

        {/* Plan features */}
        <div className="flex flex-col gap-3">
          <p className="text-[12px] font-bold uppercase tracking-widest text-[#1a1c21]">
            {selectedPlan === "annual" ? "Annual Plan" : "Monthly Plan"}
          </p>
          <ul className="flex flex-col gap-2.5 text-[13px] text-[#1a1c21]">
            <Feature>Unlimited downloads</Feature>
            <Feature>Unlimited edits</Feature>
            <Feature>Convert to any format</Feature>
            <Feature>Full access to 80+ tools</Feature>
            <Feature>Password-protect your documents</Feature>
          </ul>
        </div>

        {/* Legal small-print */}
        <p className="text-[11px] leading-relaxed text-[#6c6c6c]">
          By continuing you agree to be charged {today}{" "}
          {selectedPlan === "annual"
            ? "today, then $300.00 every 365 days"
            : "per month"}{" "}
          unless cancelled. See our{" "}
          <a
            className="text-[var(--pv-brand-red,#f12c23)] underline underline-offset-2"
            href="/terms-and-conditions"
          >
            Subscription
          </a>{" "}
          &amp;{" "}
          <a
            className="text-[var(--pv-brand-red,#f12c23)] underline underline-offset-2"
            href="/refund"
          >
            Refund
          </a>{" "}
          policies.
        </p>

        {process.env.NODE_ENV !== "production" ? (
          <p className="rounded-md bg-warning-50 px-2 py-1.5 text-[11px] text-warning-800 dark:bg-warning-900/30 dark:text-warning-200">
            <strong>Sandbox test card:</strong> 4067 4299 7471 9265 · any
            future expiry · any CVV
          </p>
        ) : null}
      </div>
    </div>

    {/* ── Right column — document preview (cream) ── */}
    <div
      className="flex flex-col gap-5 p-6 md:p-8"
      style={{ backgroundColor: CREAM }}
    >
      {preview ? (
        <PreviewFileCard preview={preview} />
      ) : (
        <GenericPreviewCard />
      )}

      {/* Order summary card at bottom */}
      <div className="mt-auto rounded-2xl bg-white p-5">
        <div className="flex items-baseline justify-between">
          <p className="pv-heading text-[15px] font-semibold text-[#1a1c21]">
            {selectedPlan === "annual" ? "Annual Plan" : "Monthly Plan"}
          </p>
          <p className="pv-heading text-[18px] font-semibold text-[#1a1c21]">
            {today}
          </p>
        </div>
        <p className="mt-0.5 text-[12px] text-[#6c6c6c]">Due today</p>
        <div className="my-4 h-px bg-[#ececec]" />
        <div className="flex items-baseline justify-between">
          <p className="text-[13px] text-[#5c5c5c]">
            {selectedPlan === "annual" ? "Renews yearly" : "Renews monthly"}
          </p>
          <p className="pv-heading text-[15px] font-semibold text-[#1a1c21]">
            {renew} {selectedPlan === "annual" ? "/ year" : "/ month"}
          </p>
        </div>
      </div>

      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-[#6c6c6c]">
        <span aria-hidden>🔒</span>
        Card details never touch our servers. Payments run through a
        PCI-compliant partner.
      </p>
    </div>
  </div>
);
```

- [ ] **Step 4: Remove now-unused variables from PayStep**

The old PayStep used `nextChargeLabel` from `formatRenewalDate()`. This variable is no longer rendered in the new layout. Remove it:

```tsx
// Delete this line inside PayStep:
const nextChargeLabel = formatRenewalDate();
```

- [ ] **Step 5: TypeScript check**

```bash
bunx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Lint**

```bash
bun run lint
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add components/sections/billing/PaywallModal.tsx
git commit -m "feat(billing): redesign PayStep — payment left, document preview right"
```

---

### Task 3: QA verification + push

**Files:** No code changes — verification only.

- [ ] **Step 1: Start dev server**

```bash
bun run dev
```

- [ ] **Step 2: Visual QA — Plan step**

Open the paywall (trigger any paywall action). On Step 1 (Choose your plan):
- Monthly Plan card shows **$25** / per month
- Annual Plan card shows **$300** / per year
- Disclaimer footer says "monthly subscription… $25 per month" for monthly selected
- Disclaimer says "annual subscription… $300 per year" for annual selected
- "Most popular" badge still on Monthly Plan

- [ ] **Step 3: Visual QA — Pay step (click Continue)**

On Step 2 (Pay securely):
- Left column (white): "Total due today: $X.XX" header → Express checkout label → Google Pay → Apple Pay → divider → card form → plan features → legal
- Right column (cream): document preview card + order summary card showing plan name + amounts
- Both columns are side-by-side on desktop (≥ md breakpoint)
- On mobile (< md) they stack: payment on top, preview below

- [ ] **Step 4: Visual QA — Success step**

On Step 3 (after payment):
- "Your subscription is active." (no "7-day trial" text)
- Receipt card shows "Full Access · Monthly" or "Full Access · Annual"

- [ ] **Step 5: Functional QA — Solidgate iframe still loads**

- Card form iframe renders inside the left column
- Google Pay / Apple Pay buttons mount correctly in their containers (or hide if unavailable on the test device)
- Sandbox test card `4067 4299 7471 9265` triggers success flow in dev

- [ ] **Step 6: Mobile viewport check (DevTools responsive — iPhone 14)**

- Plan step renders correctly (stacked or 2-col depending on breakpoint)
- Pay step left column renders in full; preview card appears below on mobile
- No horizontal overflow

- [ ] **Step 7: Full build check**

```bash
bunx tsc --noEmit && bun run lint && bun run build
```

Expected: 0 TypeScript errors, 0 lint errors, clean build.

- [ ] **Step 8: Push to GitHub**

```bash
git push origin main
```
