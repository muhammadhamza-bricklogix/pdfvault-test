"use client";

import { useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import {
  addAppBreadcrumb,
  attachSessionIdTag,
  setSentryUser,
} from "@/lib/shared/utils/sentry";

/**
 * Sentry ↔ Clerk sync. Attaches the current user (id + email) to every
 * event, tags the tab session id, and drops a breadcrumb on every route
 * change. Rendered once inside `AppProviders`.
 */
export function SentryUserContext(): null {
  const { user, isLoaded, isSignedIn } = useUser();
  const pathname = usePathname();

  useEffect(() => {
    attachSessionIdTag();
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (isSignedIn && user) {
      setSentryUser({
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress,
        username: user.username ?? undefined,
      });
      addAppBreadcrumb("auth", "user.identified", {
        userId: user.id,
        hasEmail: Boolean(user.primaryEmailAddress?.emailAddress),
      });

      return;
    }

    setSentryUser(null);
    addAppBreadcrumb("auth", "user.cleared");
  }, [isLoaded, isSignedIn, user]);

  useEffect(() => {
    if (!pathname) {
      return;
    }

    addAppBreadcrumb("navigation", "route.change", { pathname });
  }, [pathname]);

  return null;
}
