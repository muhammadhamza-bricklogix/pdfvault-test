/**
 * Module-level snapshot of the user's entitlement status. Lets the
 * axios REQUEST interceptor gate a call BEFORE it hits the network,
 * saving a round-trip when we already know the user isn't entitled.
 *
 * The snapshot is kept in sync by `useSubscriptionQuery` — every time
 * the query resolves, `setEntitledSnapshot` writes the new value here.
 * SSR + first-paint hit `getEntitledSnapshot()` before the query has
 * ever run, so the default is `true` (fail-open) to avoid a spurious
 * paywall on cold start; the response interceptor's 402/403 handler
 * still catches server-side rejections.
 */

let entitledSnapshot = true;
let billingEnabledSnapshot = false;

export function setEntitledSnapshot(value: boolean): void {
  entitledSnapshot = value;
}

export function setBillingEnabledSnapshot(value: boolean): void {
  billingEnabledSnapshot = value;
}

export function getEntitledSnapshot(): boolean {
  return entitledSnapshot;
}

export function getBillingEnabledSnapshot(): boolean {
  return billingEnabledSnapshot;
}
