import type { SignInFutureResource } from "@clerk/shared/types";

import { suppressNextUnload } from "@/lib/client/hooks/pdf-editor/use-editor-navigation-save";
import { ROUTES } from "@/lib/shared/constants/routes";
import { logger } from "@/lib/shared/utils/logger";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export type AutoSignupOutcome =
  | { kind: "created" }
  | { kind: "exists" }
  | { kind: "error"; message: string };

/**
 * Editor Download flow (2026-08-31): hand the email off to the NestJS
 * backend. Backend does everything blocking:
 *   - Clerk lookup (409 → we return `exists` and caller falls back to
 *     the login modal).
 *   - `users.createUser` with a random password + verified email.
 *   - Fire the `welcome_auto_signup` Customer.io event so the campaign
 *     template mails the password to the user.
 *   - `signInTokens.createSignInToken` and return the ticket.
 *
 * Client then `signIn.ticket({ticket})` + `signIn.finalize({navigate})`
 * with `window.location.assign` per auth invariant #15. The hydrator
 * (items #8–12) restores the pending file on return and re-fires the
 * queued export; the paywall opens back in the editor.
 */
export async function runAutoSignup(params: {
  email: string;
  redirectUrl: string;
  signIn: SignInFutureResource;
}): Promise<AutoSignupOutcome> {
  const { email, redirectUrl, signIn } = params;

  if (!API_BASE_URL) {
    logger.warn("auto-signup: NEXT_PUBLIC_API_BASE_URL not set");

    return {
      kind: "error",
      message: "Sign-up is temporarily unavailable. Please try again later.",
    };
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/auth/quick-signup`, {
      body: JSON.stringify({ email }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  } catch (err) {
    logger.captureError(err, "auto-signup.fetch");

    return {
      kind: "error",
      message: "Couldn't reach the server. Check your connection and retry.",
    };
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    return { kind: "error", message: "Unexpected response from the server." };
  }

  const status = (body as { status?: string }).status;

  if (status === "exists") {
    return { kind: "exists" };
  }

  if (!response.ok || status !== "created") {
    logger.warn("auto-signup: backend did not return a ticket", {
      responseStatus: response.status,
      status,
    });

    return {
      kind: "error",
      message: "We couldn't set up your account. Please try again.",
    };
  }

  const ticket = (body as { ticket?: string }).ticket;

  if (!ticket) {
    return { kind: "error", message: "Missing sign-in token from the server." };
  }

  try {
    const { error: ticketError } = await signIn.ticket({ ticket });

    if (ticketError) {
      logger.captureError(ticketError, "auto-signup.ticket");

      return {
        kind: "error",
        message: "We couldn't sign you in with the ticket. Please try again.",
      };
    }
  } catch (err) {
    logger.captureError(err, "auto-signup.signIn");

    return {
      kind: "error",
      message: "We couldn't sign you in. Please try again.",
    };
  }

  const safeRedirect =
    redirectUrl.startsWith("/") && !redirectUrl.startsWith("//")
      ? redirectUrl
      : ROUTES.APP.DASHBOARD;

  // Invariant #15: iOS Safari commits the Clerk session cookie during a
  // full-page nav; router.push races the cookie. suppressNextUnload keeps
  // the editor's beforeunload guard quiet during the redirect.
  const { error: finalizeError } = await signIn.finalize({
    navigate: ({ decorateUrl }) => {
      suppressNextUnload();
      window.location.assign(decorateUrl(safeRedirect));
    },
  });

  if (finalizeError) {
    logger.captureError(finalizeError, "auto-signup.finalize");

    return {
      kind: "error",
      message: "We couldn't finish signing you in. Please try again.",
    };
  }

  return { kind: "created" };
}
