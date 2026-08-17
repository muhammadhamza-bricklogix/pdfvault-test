"use client";

import { useUserSync } from "@/lib/client/hooks/auth/use-user-sync";

/**
 * Headless component — mounts `useUserSync` so the provisioning POST fires
 * once per session, anywhere in the app where the AppProviders tree wraps.
 *
 * Lives as a separate component (rather than inlined in AppProviders) so the
 * hook stays a client-only concern and the providers file doesn't need a
 * `use client` directive itself.
 */
export function UserSyncBoot() {
  useUserSync();

  return null;
}
