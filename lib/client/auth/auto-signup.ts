import type { SignInFutureResource } from "@clerk/shared/types";

import { suppressNextUnload } from "@/lib/client/hooks/pdf-editor/use-editor-navigation-save";
import {
  clearAuthReturn,
  rememberAuthReturn,
} from "@/lib/client/auth/auth-return";
import { getAuthToken } from "@/lib/client/auth/get-auth-token";
import { documentsService } from "@/lib/shared/api/services/documents.service";
import { ROUTES } from "@/lib/shared/constants/routes";
import { EVENTS } from "@/lib/shared/utils/analytics-events";
import { logger } from "@/lib/shared/utils/logger";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export type AutoSignupOutcome =
  | { kind: "created" }
  | { kind: "exists" }
  | { kind: "error"; message: string };

/**
 * Append `id=<docId>` to a same-origin redirect URL, preserving any
 * existing query string. Signed-in return to the composer will pick
 * up the docId via `useEditorDocumentLoader` and load from cloud —
 * skips the IDB-hydrator restore path, which matters when the file
 * was baked + uploaded here (cloud has the edits; IDB might not).
 */
function appendDocIdToRedirect(redirect: string, docId: string): string {
  const separator = redirect.includes("?") ? "&" : "?";

  return `${redirect}${separator}id=${encodeURIComponent(docId)}`;
}

/**
 * Marks the finalize redirect as a post-signup return, so the destination
 * waits for the Clerk session before auto-launching the export/paywall
 * (the `?id=` marker is missing whenever the pre-finalize upload fails).
 */
export const AUTH_RETURN_PARAM = "signedup";

function appendAuthReturnMarker(redirect: string): string {
  const separator = redirect.includes("?") ? "&" : "?";

  return `${redirect}${separator}${AUTH_RETURN_PARAM}=1`;
}

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
  /**
   * Original file name the user was editing when they hit Download.
   * Forwarded to the backend so the Customer.io "New account created"
   * transactional template renders `{{event.file_name}}` in the body.
   */
  fileName?: string;
  /**
   * PDF with all Fabric edits burned in. When provided, uploaded via
   * the authenticated `/documents/upload` endpoint AFTER the ticket
   * sign-in succeeds, and the resulting `docId` is forwarded to
   * `/auth/quick-signup/notify` so the Customer.io welcome email's
   * CTA links straight to the composer with the file already loaded.
   * `?id=<docId>` is also appended to the finalize redirect URL so
   * the same-session return loads the cloud file directly instead of
   * relying on the IDB-restore path in the hydrator. Absent → notify
   * still fires (email lands with the dashboard fallback URL) and
   * the hydrator's IDB restore takes over on return.
   */
  bakedFile?: File;
}): Promise<AutoSignupOutcome> {
  const { email, redirectUrl, signIn, fileName, bakedFile } = params;

  if (!API_BASE_URL) {
    logger.warn("auto-signup: NEXT_PUBLIC_API_BASE_URL not set");

    return {
      kind: "error",
      message: "Sign-up is temporarily unavailable. Please try again later.",
    };
  }

  let response: Response;

  const begin = {
    apiBase: API_BASE_URL,
    hasEmail: Boolean(email),
    // Only the local part before `@` so the log stays PII-lite.
    emailLocal: email.split("@")[0]?.slice(0, 3) ?? "",
    emailDomain: email.split("@")[1] ?? "",
    hasFileName: Boolean(fileName),
    clerkPublishableKeyPrefix:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.slice(0, 8) ?? "unset",
  };

  // eslint-disable-next-line no-console
  console.info("[AUTH_DIAG] auto-signup.begin", begin);
  // Same info to Sentry as a structured event so it's queryable outside
  // the browser console (which is silenced in prod per instrumentation-
  // client.ts). Info level → attached as breadcrumb to any subsequent
  // error capture in this chain.
  logger.event(EVENTS.AUTH_QUICK_SIGNUP_BEGIN, "info", begin);

  // AbortController + 20 s hard timeout — QA 2026-09-06: logged-out
  // user submits a valid email, EmailFirstModal's "Checking…" button
  // stays forever and no error surfaces. Root cause was an
  // unterminated `fetch` (backend cold-start, VPC hiccup, DNS stall)
  // — the outer promise never resolved so `finally` never ran, and
  // the button + toast were stuck. The abort surfaces an
  // `AbortError` that the catch turns into a user-actionable retry
  // message. 20 s is generous vs. the backend's typical <1 s response
  // but well under a user's patience budget.
  const abortController = new AbortController();
  const timeoutId = window.setTimeout(() => {
    abortController.abort();
  }, 20_000);

  try {
    response = await fetch(`${API_BASE_URL}/auth/quick-signup`, {
      body: JSON.stringify({ email, fileName }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: abortController.signal,
    });
  } catch (err) {
    logger.captureError(err, "auto-signup.fetch", {
      aborted: (err as { name?: string })?.name === "AbortError",
      timeoutMs: 20_000,
    });

    return {
      kind: "error",
      message:
        (err as { name?: string })?.name === "AbortError"
          ? "The request took too long. Please check your connection and try again."
          : "Couldn't reach the server. Check your connection and retry.",
    };
  } finally {
    window.clearTimeout(timeoutId);
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    return { kind: "error", message: "Unexpected response from the server." };
  }

  // Backend wraps every response in a global `{success, message, data}`
  // envelope (see NestJS `ResponseInterceptor` / api-client.ts). Unwrap
  // `data` before reading our payload; accept the un-enveloped shape
  // too in case the interceptor is ever removed.
  const envelope = body as {
    data?: { status?: string; ticket?: string };
    status?: string;
    ticket?: string;
  };
  const payload = envelope.data ?? envelope;
  const status = payload.status;

  const backendResponse = {
    responseStatus: response.status,
    ok: response.ok,
    envelopeStatus: status,
    hasTicket: Boolean(payload.ticket),
    ticketLength: payload.ticket?.length ?? 0,
  };

  // eslint-disable-next-line no-console
  console.info("[AUTH_DIAG] auto-signup.backend_response", backendResponse);

  if (status === "exists") {
    logger.event(EVENTS.AUTH_QUICK_SIGNUP_BACKEND_EXISTS, "info", {
      emailDomain: begin.emailDomain,
    });

    return { kind: "exists" };
  }

  if (!response.ok || status !== "created") {
    logger.event(
      EVENTS.AUTH_QUICK_SIGNUP_BACKEND_ERROR,
      "error",
      backendResponse,
    );
    logger.warn(
      "auto-signup: backend did not return a ticket",
      backendResponse,
    );

    return {
      kind: "error",
      message: "We couldn't set up your account. Please try again.",
    };
  }

  const ticket = payload.ticket;

  if (!ticket) {
    logger.event(EVENTS.AUTH_QUICK_SIGNUP_BACKEND_ERROR, "error", {
      ...backendResponse,
      reason: "missing_ticket",
    });

    return { kind: "error", message: "Missing sign-in token from the server." };
  }

  logger.event(EVENTS.AUTH_QUICK_SIGNUP_BACKEND_OK, "info", {
    emailDomain: begin.emailDomain,
    ticketLength: ticket.length,
  });

  try {
    // eslint-disable-next-line no-console
    console.info("[AUTH_DIAG] auto-signup.ticket_call.start", {
      ticketLength: ticket.length,
      // Clerk publishable key prefix — if this doesn't match the
      // Clerk instance the backend minted the ticket against, the
      // ticket call always rejects with `not_found` /
      // `invalid_client`. Compare `pk_test_…` vs `pk_live_…` here
      // against `sk_test_…` vs `sk_live_…` on the backend.
      clerkPublishableKeyPrefix:
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.slice(0, 12) ?? "unset",
      signInStatusBeforeTicket: (signIn as { status?: string }).status,
    });

    const { error: ticketError } = await signIn.ticket({ ticket });

    if (ticketError) {
      // Loud console dump so the exact Clerk code/message shows up
      // without needing a Sentry lookup. `errors[0]` follows Clerk's
      // standard ClerkAPIError shape.
      const clerkErr = ticketError as {
        errors?: {
          code?: string;
          message?: string;
          longMessage?: string;
          meta?: unknown;
        }[];
        message?: string;
        status?: number;
      };
      const first = clerkErr.errors?.[0];

      // eslint-disable-next-line no-console
      console.error("[AUTH_DIAG] auto-signup.ticket_call.failed", {
        clerkStatus: clerkErr.status,
        clerkErrorCode: first?.code,
        clerkErrorMessage: first?.message,
        clerkErrorLongMessage: first?.longMessage,
        clerkErrorMeta: first?.meta,
        raw: ticketError,
      });

      logger.event(EVENTS.AUTH_QUICK_SIGNUP_TICKET_ERROR, "error", {
        clerkStatus: clerkErr.status,
        clerkErrorCode: first?.code,
        clerkErrorMessage: first?.message,
      });
      logger.captureError(ticketError, "auto-signup.ticket", {
        clerkErrorCode: first?.code,
        clerkErrorMessage: first?.message,
      });

      // Surface the code in the user-facing message so the QA
      // screenshot names the exact fault instead of a generic
      // "please try again". Keep it non-scary but specific.
      const codeHint = first?.code ? ` (${first.code})` : "";

      return {
        kind: "error",
        message: `We couldn't sign you in with the ticket. Please try again${codeHint}.`,
      };
    }

    logger.event(EVENTS.AUTH_QUICK_SIGNUP_TICKET_OK, "info", {
      signInStatusAfterTicket: (signIn as { status?: string }).status,
    });
    // eslint-disable-next-line no-console
    console.info("[AUTH_DIAG] auto-signup.ticket_call.ok", {
      signInStatusAfterTicket: (signIn as { status?: string }).status,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[AUTH_DIAG] auto-signup.ticket_call.threw", { err });
    logger.event(EVENTS.AUTH_QUICK_SIGNUP_TICKET_ERROR, "error", {
      reason: "threw",
      errorMessage: err instanceof Error ? err.message : String(err),
    });
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

  // ─────────────────────────────────────────────────────────────
  // NEW (2026-09-18): between ticket sign-in and finalize, upload
  // the pre-baked PDF via the authenticated `/documents/upload`
  // endpoint and hand the resulting docId to
  // `POST /auth/quick-signup/notify`. The welcome email then fires
  // with a `pdf_editor_url` pointing straight at the composer for
  // this file — same behaviour whether the user opens the email on
  // the same device or a different one, because the edited bytes
  // live in cloud storage now (not just IDB). `?id=<docId>` is
  // appended to the finalize redirect so the same-session return
  // path also loads from cloud, skipping the IDB-restore path in
  // the hydrator.
  //
  // Fall-through behaviour when anything in this block fails is
  // essential: the account exists, the ticket already signed the
  // user in, and the finalize call still runs. Worst case: the
  // welcome email lands with the dashboard fallback URL (Liquid
  // `default:` filter on `pdf_editor_url`) and the hydrator does
  // its normal IDB rehydrate — exactly the pre-2026-09-18 flow.
  // ─────────────────────────────────────────────────────────────
  let effectiveRedirect = appendAuthReturnMarker(safeRedirect);
  let uploadedDocId: string | null = null;

  try {
    if (bakedFile) {
      // Clerk's `signIn.ticket({ ticket })` above sets the session
      // synchronously — `getAuthToken()` returns the fresh JWT
      // immediately, so `apiClient` picks it up on the very next
      // request. No sleep needed.
      const uploaded = await documentsService.uploadDocument({
        file: bakedFile,
      });

      uploadedDocId = uploaded.id;
      effectiveRedirect = appendDocIdToRedirect(
        effectiveRedirect,
        uploadedDocId,
      );

      logger.event(EVENTS.AUTH_QUICK_SIGNUP_UPLOAD_OK, "info", {
        docId: uploadedDocId,
        sizeBytes: bakedFile.size,
      });
    }
  } catch (uploadErr) {
    // Upload failure is non-fatal — see the block header. Log +
    // fall through so the ticketed sign-in isn't wasted.
    logger.captureError(uploadErr, "auto-signup.upload", {
      sizeBytes: bakedFile?.size,
    });
    logger.event(EVENTS.AUTH_QUICK_SIGNUP_UPLOAD_ERROR, "error", {
      errorMessage:
        uploadErr instanceof Error ? uploadErr.message : String(uploadErr),
    });
  }

  // Fire the welcome email. Always call notify even when the upload
  // failed (or `bakedFile` was absent) so the user still gets their
  // sign-in credentials — the CIO template falls back to the
  // dashboard snippet when `pdf_editor_url` isn't in message_data.
  try {
    const token = await getAuthToken();
    const notifyBody: { fileName?: string; docId?: string } = {};

    if (fileName) notifyBody.fileName = fileName;
    if (uploadedDocId) notifyBody.docId = uploadedDocId;

    const notifyResponse = await fetch(
      `${API_BASE_URL}/auth/quick-signup/notify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(notifyBody),
      },
    );

    logger.event(EVENTS.AUTH_QUICK_SIGNUP_NOTIFY_OK, "info", {
      responseStatus: notifyResponse.status,
      hadDocId: Boolean(uploadedDocId),
    });
  } catch (notifyErr) {
    // Best-effort — same fallback story. The user's account and
    // session are fine; only the welcome email may not arrive.
    logger.captureError(notifyErr, "auto-signup.notify", {
      hadDocId: Boolean(uploadedDocId),
    });
    logger.event(EVENTS.AUTH_QUICK_SIGNUP_NOTIFY_ERROR, "error", {
      errorMessage:
        notifyErr instanceof Error ? notifyErr.message : String(notifyErr),
    });
  }

  // Invariant #15: iOS Safari commits the Clerk session cookie during a
  // full-page nav; router.push races the cookie. suppressNextUnload keeps
  // the editor's beforeunload guard quiet during the redirect.
  // Remembered before finalize: Clerk's own page refresh can beat our redirect.
  rememberAuthReturn(effectiveRedirect);
  const { error: finalizeError } = await signIn.finalize({
    navigate: ({ decorateUrl }) => {
      suppressNextUnload();
      window.location.assign(decorateUrl(effectiveRedirect));
    },
  });

  if (finalizeError) {
    clearAuthReturn();
    logger.event(EVENTS.AUTH_QUICK_SIGNUP_FINALIZE_ERROR, "error", {
      errorMessage:
        finalizeError instanceof Error
          ? finalizeError.message
          : String(finalizeError),
      redirectTo: safeRedirect,
    });
    logger.captureError(finalizeError, "auto-signup.finalize");

    return {
      kind: "error",
      message: "We couldn't finish signing you in. Please try again.",
    };
  }

  logger.event(EVENTS.AUTH_QUICK_SIGNUP_FINALIZE_OK, "info", {
    redirectTo: safeRedirect,
  });

  return { kind: "created" };
}
