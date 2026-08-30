"use client";

import { useClerk } from "@clerk/nextjs";
import { useEffect } from "react";

import { usersService } from "@/lib/shared/api/services/users.service";

/**
 * Dedicated sign-out landing page. Exists so the landing / marketing /
 * legal routes can trigger sign-out via a plain `<Link href="/sign-out">`
 * without loading the Clerk SDK on their bundle. This page lives inside
 * the `(auth)` group which DOES ship Clerk, so `useClerk().signOut()` is
 * available here. Fires the sign-out audit (previously called inline in
 * `landing-header.handleLogOut`), then redirects back to `/`.
 */
export default function SignOutPage() {
  const { signOut } = useClerk();

  useEffect(() => {
    void usersService.signOutAudit().catch(() => undefined);
    void signOut({ redirectUrl: "/" });
  }, [signOut]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center px-6 py-16">
      <p className="text-[15px] text-[var(--pv-text-secondary)]">
        Signing you out…
      </p>
    </div>
  );
}
