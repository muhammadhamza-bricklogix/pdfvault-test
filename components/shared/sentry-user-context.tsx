"use client";

import { useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { logger } from "@/lib/shared/utils/logger";
import { attachSessionIdTag, setSentryUser } from "@/lib/shared/utils/sentry";

/**
 * Sentry ↔ Clerk sync. Attaches the current user (id + email) to every
 * event, tags the tab session id, and drops a breadcrumb on every route
 * change. Rendered once inside `AppProviders`.
 *
 * Deps are the primitive user fields (not the `user` object identity —
 * Clerk returns a fresh reference on unrelated re-renders, which would
 * otherwise cause `setUser` to fire repeatedly).
 */
export function SentryUserContext(): null {
  const { user, isLoaded, isSignedIn } = useUser();
  const pathname = usePathname();
  const userId = user?.id;
  const email = user?.primaryEmailAddress?.emailAddress;
  const username = user?.username ?? undefined;

  useEffect(() => {
    attachSessionIdTag();
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (isSignedIn && userId) {
      setSentryUser({ id: userId, email, username });
      logger.breadcrumb("auth", "user.identified", {
        userId,
        hasEmail: Boolean(email),
      });

      return;
    }

    setSentryUser(null);
    logger.breadcrumb("auth", "user.cleared");
  }, [isLoaded, isSignedIn, userId, email, username]);

  useEffect(() => {
    if (!pathname) {
      return;
    }

    logger.breadcrumb("navigation", "route.change", { pathname });
  }, [pathname]);

  return null;
}
