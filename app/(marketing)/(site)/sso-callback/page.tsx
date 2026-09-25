"use client";

import { useClerk, useSignIn, useSignUp } from "@clerk/nextjs";
import { toast } from "@heroui/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { ROUTES } from "@/lib/shared/constants/routes";
import { logger } from "@/lib/shared/utils/logger";
import { trackSignUp } from "@/lib/client/analytics/gtag";

/**
 * Only allow same-origin relative paths so the redirect can't be
 * turned into an open-redirect via a crafted URL.
 */
function safeRedirect(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;

  return raw;
}

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
  const searchParams = useSearchParams();
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

    // signup-card / login-card forward the intended return URL as a
    // `?redirect_url=` query param on the callback URL because Clerk's
    // stored redirectUrl occasionally gets dropped on the Google
    // round-trip (cookie / localStorage eviction on some browsers),
    // which then defaulted to the DASHBOARD fallback and wiped the
    // editor session. Reading it from our own URL means we control
    // the destination end-to-end.
    const returnUrl = safeRedirect(searchParams.get("redirect_url"));

    void (async () => {
      try {
        await handleRedirectCallback({
          // Force overrides Clerk's stored redirectUrl. Only set when
          // signup / login provided one explicitly — otherwise fall
          // back so Clerk's own state (or the DASHBOARD default) wins.
          ...(returnUrl
            ? {
                signInForceRedirectUrl: returnUrl,
                signUpForceRedirectUrl: returnUrl,
              }
            : {}),
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
          // Preserve the return URL so the user still lands back on
          // the editor after they sign in with the existing account.
          const signInUrl = returnUrl
            ? `${ROUTES.AUTH.SIGN_IN}?redirect_url=${encodeURIComponent(returnUrl)}`
            : ROUTES.AUTH.SIGN_IN;

          router.replace(signInUrl);

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
          const signUpUrl = returnUrl
            ? `${ROUTES.AUTH.SIGN_UP}?redirect_url=${encodeURIComponent(returnUrl)}`
            : ROUTES.AUTH.SIGN_UP;

          router.replace(signUpUrl);

          return;
        }

        if (signUp?.status === "complete") {
          trackSignUp("google", { email: signUp.emailAddress });
        }
      } catch (err) {
        if (cancelled) return;
        logger.error("OAuth callback failed", err);
        toast.danger("Sign-in didn't complete. Please try again.");
        router.replace(ROUTES.AUTH.SIGN_IN);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [handleRedirectCallback, router, signIn, signUp]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
      <div
        aria-label="Signing you in"
        className="h-12 w-12 animate-spin rounded-full border-[3px] border-default-200 border-t-[var(--pv-brand-red,#de472e)]"
        role="status"
      />
      <div className="text-center">
        <p className="text-[16px] font-semibold text-[var(--pv-text-strong,#1a1c21)]">
          Signing you in…
        </p>
        <p className="mt-1 text-[13px] text-[var(--pv-text-muted,#666666)]">
          One moment while we securely finish your login.
        </p>
      </div>
    </div>
  );
}
