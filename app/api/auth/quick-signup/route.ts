import type { NextRequest } from "next/server";

import { clerkClient } from "@clerk/nextjs/server";

import { logger } from "@/lib/shared/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

type QuickSignupBody = {
  email?: string;
};

type QuickSignupSuccess = {
  status: "created";
  ticket: string;
};

type QuickSignupExists = {
  status: "exists";
};

type QuickSignupError = {
  status: "error";
  error: string;
};

/**
 * Generates a URL-safe random password. 20 bytes → 27-char base64url string —
 * well above Clerk's 8-char minimum and long enough that entropy is not a
 * concern even without a symbol set.
 */
function generatePassword(): string {
  const bytes = new Uint8Array(20);

  crypto.getRandomValues(bytes);

  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Best-effort delivery of the auto-generated password to the user's inbox.
 * Delegated to the backend so the client repo doesn't need SMTP credentials.
 * Non-blocking — if the backend hop fails (endpoint missing, network) we log
 * and continue. The account is still created and the user is still signed
 * in; they can reset the password later via /forgot-password.
 */
async function deliverPasswordEmail(
  email: string,
  password: string,
): Promise<void> {
  if (!API_BASE_URL) {
    logger.warn(
      "quick-signup: NEXT_PUBLIC_API_BASE_URL not set — password email skipped",
      { email },
    );

    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/auth/send-welcome-credentials`, {
      body: JSON.stringify({ email, password }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!res.ok) {
      logger.warn("quick-signup: backend rejected credential email", {
        status: res.status,
      });
    }
  } catch (err) {
    logger.warn("quick-signup: credential email delivery failed", { err });
  }
}

/**
 * POST /api/auth/quick-signup
 *
 * Body: { email }
 * Response:
 *   - 201 { status: "created", ticket }  — new account, use ticket to signIn
 *   - 200 { status: "exists" }           — account exists; caller falls back
 *                                          to the standard login modal
 *   - 400 / 500 { status: "error", error }
 *
 * Used by the editor Done → Download flow: signed-out user drops a PDF,
 * enters their email in the email-first modal, and if the account doesn't
 * exist we auto-create it (verified email + random password), email the
 * password, and hand a sign-in ticket back so the client signs the user
 * in without a password prompt. Downstream auth chain (items #1–4, #8–12,
 * #15) runs unchanged from the ticket sign-in onward.
 */
export async function POST(req: NextRequest): Promise<Response> {
  let body: QuickSignupBody;

  try {
    body = (await req.json()) as QuickSignupBody;
  } catch {
    return Response.json(
      { error: "invalid-json", status: "error" } satisfies QuickSignupError,
      { status: 400 },
    );
  }

  const email = body.email?.trim().toLowerCase();

  if (!email || !EMAIL_REGEX.test(email)) {
    return Response.json(
      { error: "invalid-email", status: "error" } satisfies QuickSignupError,
      { status: 400 },
    );
  }

  const clerk = await clerkClient();

  try {
    const existing = await clerk.users.getUserList({
      emailAddress: [email],
      limit: 1,
    });

    if (existing.totalCount > 0) {
      return Response.json({ status: "exists" } satisfies QuickSignupExists, {
        status: 200,
      });
    }
  } catch (err) {
    logger.captureError(err, "quick-signup.lookup");

    return Response.json(
      { error: "lookup-failed", status: "error" } satisfies QuickSignupError,
      { status: 500 },
    );
  }

  const password = generatePassword();

  let userId: string;

  try {
    const created = await clerk.users.createUser({
      emailAddress: [email],
      password,
      skipPasswordChecks: true,
      skipPasswordRequirement: false,
    });

    userId = created.id;
  } catch (err) {
    // Clerk returns `form_identifier_exists` if a race put the user in
    // between our lookup and the createUser call. Report it as `exists`
    // so the client hands off to the standard login flow.
    const code = (err as { errors?: { code?: string }[] })?.errors?.[0]?.code;

    if (code === "form_identifier_exists") {
      return Response.json({ status: "exists" } satisfies QuickSignupExists, {
        status: 200,
      });
    }
    logger.captureError(err, "quick-signup.createUser");

    return Response.json(
      { error: "create-failed", status: "error" } satisfies QuickSignupError,
      { status: 500 },
    );
  }

  let ticket: string;

  try {
    const token = await clerk.signInTokens.createSignInToken({
      expiresInSeconds: 5 * 60,
      userId,
    });

    ticket = token.token;
  } catch (err) {
    logger.captureError(err, "quick-signup.signInToken");

    return Response.json(
      {
        error: "token-failed",
        status: "error",
      } satisfies QuickSignupError,
      { status: 500 },
    );
  }

  await deliverPasswordEmail(email, password);

  return Response.json(
    { status: "created", ticket } satisfies QuickSignupSuccess,
    { status: 201 },
  );
}
