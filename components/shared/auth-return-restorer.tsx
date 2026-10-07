"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { clearAuthReturn, peekAuthReturn } from "@/lib/client/auth/auth-return";
import { EVENTS } from "@/lib/shared/utils/analytics-events";
import { logger } from "@/lib/shared/utils/logger";

/**
 * After sign-in/up, if the user landed on the intended page but its query
 * (e.g. `?export=pdf`) was lost, put it back so the paywall/auto-launch
 * runs. Same page only; the remembered URL is consumed on first use.
 */
export function AuthReturnRestorer() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const remembered = peekAuthReturn({ fromEarlierPage: true });

    if (!remembered) return;
    clearAuthReturn();

    const target = new URL(remembered, window.location.origin);

    if (target.pathname !== window.location.pathname) return;

    const current = new URLSearchParams(window.location.search);
    const missing = [...target.searchParams].some(
      ([key, value]) => current.get(key) !== value,
    );

    if (!missing) return;

    target.searchParams.forEach((value, key) => current.set(key, value));
    logger.event(EVENTS.AUTH_RETURN_RESTORED, "info", {
      path: target.pathname,
      keys: [...target.searchParams.keys()],
    });
    router.replace(`${target.pathname}?${current.toString()}`);
  }, [isLoaded, isSignedIn, router]);

  return null;
}
