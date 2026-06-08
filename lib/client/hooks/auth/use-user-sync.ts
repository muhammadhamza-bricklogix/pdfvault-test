"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

import { usersService } from "@/lib/shared/api/services/users.service";
import { logger } from "@/lib/shared/utils/logger";

/**
 * Calls `POST /users/me` exactly once per session immediately after the Clerk
 * session is established. Server-side this idempotently upserts the local
 * `User` row, closing the race where a freshly-signed-up user's first action
 * (e.g. document upload) hit the backend before the Clerk `user.created`
 * webhook had populated the User table.
 *
 * Gated on `isLoaded && isSignedIn`. The sentinel ref ensures we don't fire
 * again on remount within the same browser session.
 */
export function useUserSync(): void {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const provisionedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return;
    if (provisionedFor.current === userId) return;
    provisionedFor.current = userId;

    void usersService.ensureMe().catch((err) => {
      // Provisioning failure isn't fatal — the user might be hitting this
      // before the webhook has fired (race), or the network might be flaky.
      // Document upload also calls `ensureLocalUser` server-side, so the
      // first real action will retry. Log it for forensics.
      logger.warn?.("ensureMe call failed", err);
      // Allow retry on the next mount.
      provisionedFor.current = null;
    });
  }, [isLoaded, isSignedIn, userId]);
}
