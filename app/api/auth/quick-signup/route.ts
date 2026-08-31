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
 * Fire-and-forget hand-off to the NestJS backend for email delivery.
 * Backend fires a `welcome_auto_signup` Customer.io event with the
 * generated password in the event `data` — the campaign template
 * renders `{{event.tempPassword}}` to mail the credentials to the user.
 *
 * Non-blocking. If the backend endpoint doesn't exist yet (404) or is
 * unreachable, we log and continue. The account is still created and
 * the user is still signed in; only the welcome email is skipped.
 * Users can reset later via `/forgot-password`.
 */
function fireWelcomeEvent(email: string, password: string): void {
  if (!API_BASE_URL) {
    logger.warn(
      "quick-signup: NEXT_PUBLIC_API_BASE_URL not set — welcome event skipped",
    );

    return;
  }

  void fetch(`${API_BASE_URL}/auth/welcome-auto-signup`, {
    body: JSON.stringify({ email, tempPassword: password }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  })
    .then((res) => {
      if (!res.ok) {
        logger.warn("quick-signup: backend welcome event non-2xx", {
          status: res.status,
        });
      }
    })
    .catch((err) => {
      logger.warn("quick-signup: backend welcome event failed", { err });
    });
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
 * Used by the editor Done → Download flow. Server does the fast blocking
 * work here (Clerk lookup + createUser + ticket), then fires the welcome
 * event at the backend as fire-and-forget so the client isn't blocked on
 * email delivery. Downstream auth chain (items #1–4, #8–12, #15) runs
 * unchanged from the ticket sign-in onward.
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
      { error: "token-failed", status: "error" } satisfies QuickSignupError,
      { status: 500 },
    );
  }

  fireWelcomeEvent(email, password);

  return Response.json(
    { status: "created", ticket } satisfies QuickSignupSuccess,
    { status: 201 },
  );
}
