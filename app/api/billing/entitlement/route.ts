import { getEntitlementForCurrentUser } from "@/lib/server/billing/entitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/billing/entitlement
 *
 * Returns the caller's entitlement, computed from Clerk publicMetadata.
 * Signed-out callers get an empty entitlement (status: "none").
 */
export async function GET(): Promise<Response> {
  const { entitlement } = await getEntitlementForCurrentUser();

  return Response.json(entitlement, {
    headers: { "Cache-Control": "no-store" },
  });
}
