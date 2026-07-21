import { billingService } from "@/lib/shared/api/services/billing.service";

import { getEntitledSnapshot, setEntitledSnapshot } from "./entitlement-cache";

let inflight: Promise<boolean> | null = null;

/**
 * Confirms the caller's entitlement against the backend before a
 * paywall gate decides whether to fire.
 *
 * Fast path: the cached snapshot is `true` — trust it and return
 * immediately. `useSubscriptionQuery` keeps that value fresh through
 * its mirror effect, so entitled users pay zero round-trips per gate.
 *
 * Slow path: snapshot is `false`. That's ambiguous — it could mean the
 * user genuinely isn't entitled OR the `useSubscriptionQuery` hasn't
 * resolved yet (fresh mount after sign-in, IDB rehydrate, browser
 * back-forward cache). Force a network read against
 * `billingService.getSubscription()` and mirror the truth back into
 * the snapshot. Fail closed on network errors (return `false`) so a
 * broken network doesn't accidentally unlock premium actions.
 *
 * Concurrent callers share an inflight promise so a single mount that
 * fires N gated checks (Extract, Compress, Export all racing) only
 * hits the endpoint once.
 */
export async function ensureFreshEntitlement(): Promise<boolean> {
  if (getEntitledSnapshot()) return true;

  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const sub = await billingService.getSubscription();
      const entitled = !!sub?.entitled;

      setEntitledSnapshot(entitled);

      return entitled;
    } catch {
      return false;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
