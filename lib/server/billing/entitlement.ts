import type { Entitlement } from "@/lib/shared/types/billing.types";

import { auth, clerkClient } from "@clerk/nextjs/server";

import { emptyEntitlement } from "@/lib/shared/types/billing.types";

/**
 * Entitlement is stored on the Clerk user's `publicMetadata.entitlement` so
 * we don't need to stand up a database to ship the P0 billing flow.
 *
 * The webhook is the sole authoritative writer. Client reads should go
 * through the /api/billing/entitlement route (cached by TanStack Query and
 * invalidated after checkout redirects).
 *
 * When we outgrow Clerk metadata (webhook idempotency, admin filtering,
 * chargeback correlations), move to Postgres and keep this module's public
 * shape stable so the UI doesn't need to change.
 */

const METADATA_KEY = "entitlement";

interface PublicMetadataShape {
  [METADATA_KEY]?: Entitlement;
  [key: string]: unknown;
}

export const getEntitlementForUser = async (
  userId: string,
): Promise<Entitlement> => {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const metadata = (user.publicMetadata ?? {}) as PublicMetadataShape;
  const stored = metadata[METADATA_KEY];

  return stored ?? emptyEntitlement();
};

export const getEntitlementForCurrentUser = async (): Promise<{
  userId: string | null;
  entitlement: Entitlement;
}> => {
  const { userId } = await auth();

  if (!userId) {
    return { userId: null, entitlement: emptyEntitlement() };
  }

  const entitlement = await getEntitlementForUser(userId);

  return { userId, entitlement };
};

/**
 * Overwrites the user's entitlement. Only webhook handlers should call this.
 * The `updatedAt` timestamp is set here — callers should not override.
 */
export const setEntitlementForUser = async (
  userId: string,
  next: Omit<Entitlement, "updatedAt">,
): Promise<Entitlement> => {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const currentMetadata = (user.publicMetadata ?? {}) as PublicMetadataShape;

  const entitlement: Entitlement = { ...next, updatedAt: Date.now() };

  await client.users.updateUser(userId, {
    publicMetadata: { ...currentMetadata, [METADATA_KEY]: entitlement },
  });

  return entitlement;
};
