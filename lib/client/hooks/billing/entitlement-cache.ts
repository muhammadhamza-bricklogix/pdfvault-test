/**
 * Module-level snapshot of the user's entitlement status. Lets the
 * axios REQUEST interceptor gate a call BEFORE it hits the network,
 * saving a round-trip when we already know the user isn't entitled.
 *
 * The snapshot is kept in sync by `useSubscriptionQuery` — every time
 * the query resolves, `setEntitledSnapshot` writes the new value here.
 *
 * **Fail-closed default.** Until the subscription query resolves the
 * snapshot is `false`, so a signed-in user who clicks a gated action
 * before the query lands still hits the paywall. The alternative
 * (fail-open) let the paywall trip only when the network was already
 * in a race — signed-in users would blow past the gate on first
 * click. `PaywallProvider` mounts `useSubscriptionQuery` at the app
 * root so the flip to `true` for entitled users happens within a
 * round-trip of first paint.
 */

let entitledSnapshot = false;
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
