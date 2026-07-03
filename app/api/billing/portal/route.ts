import { auth } from "@clerk/nextjs/server";

import { isBillingEnabled } from "@/lib/shared/constants/billing";
import { logger } from "@/lib/shared/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/billing/portal
 *
 * Returns a short-lived URL to Chargebee's self-serve customer portal, where
 * the user can update payment methods, view invoices, and cancel. This is the
 * "one-click cancel" surface required by FTC's Click-to-Cancel rule — the
 * portal must NOT be gated behind retention prompts on the backend side; save
 * offers belong in our UI ahead of this call, not in the portal itself.
 *
 * Today: returns 501 because Chargebee is not provisioned. When wired up:
 *   1. Look up the Chargebee customerId for `userId`.
 *   2. Call chargebee.portalSession.create({ customer: { id } }).
 *   3. Return { url: session.access_url }.
 */
export async function POST(): Promise<Response> {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isBillingEnabled()) {
    return Response.json({ error: "billing-disabled" }, { status: 503 });
  }

  // TODO(chargebee): create portal session and return { url }.
  logger.info("[billing] portal stub hit", { userId });

  return Response.json({ error: "portal-not-implemented" }, { status: 501 });
}
