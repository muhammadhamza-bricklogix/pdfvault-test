"use client";

import { useMobileDebug } from "@/lib/client/hooks/use-mobile-debug";

export function MobileDebugBoot() {
  useMobileDebug();

  return null;
}
