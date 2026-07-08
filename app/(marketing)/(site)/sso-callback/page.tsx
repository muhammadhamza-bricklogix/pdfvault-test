"use client";

import { useClerk, useSignIn, useSignUp } from "@clerk/nextjs";
import { toast } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { ROUTES } from "@/lib/shared/constants/routes";
import { logger } from "@/lib/shared/utils/logger";

/**
 * OAuth (Google) callback handler.
 *
 * Default Clerk behaviour silently transfers an OAuth sign-up to a
 * sign-in when the chosen Google email already maps to an existing
 * account — i.e. the user clicks "Sign up with Google" with a Gmail
 * they already used and ends up logged in to the existing account
 * without any "account already exists" feedback. QA reported this on
 * 2026-06-18 as "the sign-up feature worked more like a log-in".
 *
 * The fix: instead of using `<AuthenticateWithRedirectCallback />`'s
 * out-of-the-box flow, drive `handleRedirectCallback` ourselves and
 * inspect `signUp.status === "transferable"`. When we see that, we
 * explicitly transfer to sign-in (so the user lands in the right
 * account), surface a toast explaining what happened, and avoid
 * silently completing a sign-up that didn't actually create a new
 * account.
 *
 * Clean sign-up (new account) → toast a welcome and route to dashboard.
 * Clean sign-in (existing account) → route straight to dashboard.
 */
export default function SSOCallbackPage() {
  const router = useRouter();
  const { handleRedirectCallback } = useClerk();
  const { signUp } = useSignUp();
  const { signIn } = useSignIn();
  const ranRef = useRef(false);

  useEffect(() => {
    // React 19 + StrictMode double-invokes effects; guard so we don't
    // process the OAuth ticket twice (Clerk's second call returns a
    // generic error which then masks a successful first call).
    if (ranRef.current) return;
    ranRef.current = true;

    let cancelled = false;

    void (async () => {
      try {
        await handleRedirectCallback({
          // ForceRedirect URLs only fire on CLEAN completion. The
          // transferable + missing-requirements branches don't reach
          // these — we handle them manually below.
          signInForceRedirectUrl: ROUTES.APP.DASHBOARD,
          signUpForceRedirectUrl: ROUTES.APP.DASHBOARD,
          signInFallbackRedirectUrl: ROUTES.APP.DASHBOARD,
          signUpFallbackRedirectUrl: ROUTES.APP.DASHBOARD,
        });

        if (cancelled) return;

        // OAuth-sign-up where the email already maps to a user: Clerk
        // sets `signUp.verifications.externalAccount.status` to
        // `"transferable"` and leaves `signUp.status` at
        // `"missing_requirements"`. The default `signIn.create({
        // transfer: true })` flow would silently log the user in to
        // the existing account — which is what the QA ticket called
        // out as "sign-up worked more like a log-in". We refuse the
        // transfer here, reset the partial sign-up, and route to the
        // sign-in form with a toast explaining the situation.
        const extStatus = signUp?.verifications?.externalAccount?.status as
          | string
          | undefined;

        if (extStatus === "transferable") {
          toast.danger(
            "An account with this email already exists. Please sign in instead.",
          );
          await signUp?.reset();
          router.replace(ROUTES.AUTH.LOGIN);

          return;
        }

        // Inverse case: user tried to SIGN IN with Google but no Clerk
        // account exists for that email. Push them to sign-up so they
        // can finish creating the account instead of bouncing in a loop.
        const signInExtStatus = signIn?.firstFactorVerification?.status as
          | string
          | undefined;

        if (signInExtStatus === "transferable") {
          toast("No account found for this email — let's create one.");
          router.replace(ROUTES.AUTH.SIGNUP);

          return;
        }
      } catch (err) {
        if (cancelled) return;
        logger.error("OAuth callback failed", err);
        toast.danger("Sign-in didn't complete. Please try again.");
        router.replace(ROUTES.AUTH.LOGIN);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [handleRedirectCallback, router, signIn, signUp]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-default-500">
      Completing sign-in…
    </div>
  );
}
