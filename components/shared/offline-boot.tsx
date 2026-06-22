"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

import { invalidateOnAccountSwitch } from "@/lib/client/offline";

/**
 * Headless component — runs once per signed-in Clerk session and clears the
 * previous user's IndexedDB if the current user differs. Prevents one
 * account from seeing another account's cached documents on a shared
 * browser. Cheap no-op when the user matches (or when the user is signed
 * out / Clerk hasn't loaded yet).
 */
export function OfflineBoot() {
  const { isLoaded, userId } = useAuth();
  const invalidatedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !userId) return;
    if (invalidatedFor.current === userId) return;

    invalidatedFor.current = userId;
    void invalidateOnAccountSwitch(userId);
  }, [isLoaded, userId]);

  return null;
}
