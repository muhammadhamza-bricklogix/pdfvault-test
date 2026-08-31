import type { SignInFutureResource } from "@clerk/shared/types";

import { suppressNextUnload } from "@/lib/client/hooks/pdf-editor/use-editor-navigation-save";
import { ROUTES } from "@/lib/shared/constants/routes";
import { logger } from "@/lib/shared/utils/logger";

export type AutoSignupOutcome =
  | { kind: "created" }
  | { kind: "exists" }
  | { kind: "error"; message: string };

/**
 * Editor Download flow (2026-08-31): call `/api/auth/quick-signup` to
 * create the Clerk user in the background, sign them in via the returned
 * ticket, then hard-navigate to `redirectUrl` so the auth chain
 * (invariants #8–12, #15) restores the pending file and auto-fires the
 * queued export. If the account already exists, the caller falls back
 * to the standard email-first login handoff — this helper only owns the
 * "new user" branch.
 */
export async function runAutoSignup(params: {
  email: string;
  redirectUrl: string;
  signIn: SignInFutureResource;
}): Promise<AutoSignupOutcome> {
  const { email, redirectUrl, signIn } = params;

  let response: Response;

  try {
    response = await fetch("/api/auth/quick-signup", {
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
    logger.warn("auto-signup: server did not return a ticket", {
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

  // Same pattern as LoginCard.finalizeAndRedirect — invariant #15: iOS
  // Safari commits the Clerk session cookie during a full-page nav;
  // router.push races the cookie and drops the user on middleware that
  // reads them as signed-out. Also suppressNextUnload so the editor's
  // beforeunload guard doesn't fire on top of the sign-in redirect.
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
