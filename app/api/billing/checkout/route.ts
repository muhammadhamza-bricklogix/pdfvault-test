import type { NextRequest } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { getPlan, isBillingEnabled } from "@/lib/shared/constants/billing";
import { logger } from "@/lib/shared/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/billing/checkout
 *
 * Body: { planId: string, returnUrl?: string }
 * Success: { url: string }  — client redirects the browser to `url`.
 *
 * Today: returns 501 because Chargebee is not provisioned. Once it is,
 * this handler must:
 *   1. Ensure a Chargebee customer exists for `userId` (upsert by clerkId).
 *   2. Call chargebee.hostedPage.checkoutNewForItems with the plan's
 *      externalId, prefilled email, and returnUrl.
 *   3. Return { url: hostedPage.url } so the client can window.location it.
 *
 * The frontend contract (returned shape, error codes) MUST stay stable
 * across this switch — the download-gate modal already consumes it.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isBillingEnabled()) {
    return Response.json({ error: "billing-disabled" }, { status: 503 });
  }

  let body: { planId?: string; returnUrl?: string };

  try {
    body = (await req.json()) as { planId?: string; returnUrl?: string };
  } catch {
    return Response.json({ error: "invalid-body" }, { status: 400 });
  }

  const planId = body.planId?.trim();

  if (!planId) {
    return Response.json({ error: "plan-required" }, { status: 400 });
  }

  const plan = getPlan(planId);

  if (!plan) {
    return Response.json({ error: "unknown-plan" }, { status: 404 });
  }

  if (!plan.externalId) {
    logger.warn("[billing] checkout requested for plan without externalId", {
      planId,
    });

    return Response.json({ error: "plan-not-provisioned" }, { status: 503 });
  }

  // TODO(chargebee): create hosted page and return { url }.
  logger.info("[billing] checkout stub hit", {
    userId,
    planId,
    externalId: plan.externalId,
  });

  return Response.json({ error: "checkout-not-implemented" }, { status: 501 });
}
