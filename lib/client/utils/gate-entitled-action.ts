import { ensureFreshEntitlement } from "@/lib/client/hooks/billing/ensure-entitlement";
import {
  PAYWALL_CANCELLED_ERR_NAME,
  requestPaywall,
} from "@/lib/client/hooks/billing/paywall-bus";

/**
 * Returns true if the caller is entitled or the paywall was completed
 * successfully. Returns false if the paywall was cancelled or the
 * network read failed. Wraps the `ensureFreshEntitlement + requestPaywall`
 * pair so dashboard actions (Open, Download) share one gate.
 */
export async function gateEntitledAction(): Promise<boolean> {
  const entitled = await ensureFreshEntitlement();

  if (entitled) return true;

  try {
    const outcome = await requestPaywall(undefined, { hidePreview: true });

    return outcome === "success";
  } catch (err) {
    if ((err as { name?: string })?.name === PAYWALL_CANCELLED_ERR_NAME) {
      return false;
    }
    throw err;
  }
}
