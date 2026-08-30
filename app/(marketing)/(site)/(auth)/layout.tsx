import type { ReactNode } from "react";

import { ClerkAppShell } from "@/components/shared/clerk-app-shell";

/**
 * Wraps the auth-flow route group (`/sign-in`, `/sign-up`,
 * `/forgot-password`, `/sign-out`) in Clerk. Root layout no longer
 * ships ClerkProvider so landing / marketing / legal don't pay for
 * `@clerk/clerk-js` on their initial bundle; auth routes bring their
 * own via `<ClerkAppShell>`.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <ClerkAppShell>{children}</ClerkAppShell>;
}
