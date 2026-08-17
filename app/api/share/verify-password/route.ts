import type { NextRequest } from "next/server";

import { denyList } from "@/lib/server/share/deny-list";
import { passwordStore, verifyPassword } from "@/lib/server/share/password";
import { verifyToken } from "@/lib/server/share/sign-token";
import {
  mintViewCookie,
  viewCookieAttributes,
  VIEW_COOKIE_NAME,
} from "@/lib/server/share/view-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/share/verify-password
 * Body: { token, password }
 *
 * On success: sets `share_view` cookie path-scoped to the bytes
 * endpoint. Cookie carries its own short-lived HMAC so the share token
 * never leaves the URL bar.
 *
 * Per-token attempt rate-limiting is a TODO before production. The
 * in-memory map below is a placeholder — swap for Upstash Ratelimit.
 */

type AttemptEntry = { count: number; windowStart: number };
const ATTEMPTS = new Map<string, AttemptEntry>();
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function checkAttempts(jti: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = ATTEMPTS.get(jti);

  if (!entry || now - entry.windowStart > ATTEMPT_WINDOW_MS) {
    ATTEMPTS.set(jti, { count: 1, windowStart: now });

    return { allowed: true };
  }
  if (entry.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil(
      (entry.windowStart + ATTEMPT_WINDOW_MS - now) / 1000,
    );

    return { allowed: false, retryAfter };
  }
  entry.count += 1;

  return { allowed: true };
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: { token?: string; password?: string };

  try {
    body = (await req.json()) as { token?: string; password?: string };
  } catch {
    return Response.json({ ok: false, reason: "malformed" }, { status: 400 });
  }

  const { token, password } = body;

  if (typeof token !== "string" || typeof password !== "string") {
    return Response.json({ ok: false, reason: "malformed" }, { status: 400 });
  }

  const verify = await verifyToken(token);

  if (!verify.ok) {
    return Response.json(
      { ok: false, reason: verify.reason },
      { status: verify.reason === "expired" ? 410 : 400 },
    );
  }
  const { claims } = verify;

  if (await denyList.has(claims.jti)) {
    return Response.json({ ok: false, reason: "revoked" }, { status: 410 });
  }
  if (claims.pw !== 1) {
    // Share has no password set — caller shouldn't be hitting this.
    return Response.json({ ok: false, reason: "no-password" }, { status: 400 });
  }

  const gate = checkAttempts(claims.jti);

  if (!gate.allowed) {
    return Response.json(
      { ok: false, reason: "rate-limited" },
      {
        status: 429,
        headers: gate.retryAfter
          ? { "Retry-After": String(gate.retryAfter) }
          : undefined,
      },
    );
  }

  const hash = await passwordStore.get(claims.jti);

  if (!hash) {
    return Response.json({ ok: false, reason: "not-found" }, { status: 404 });
  }

  const ok = await verifyPassword(password, hash);

  if (!ok) {
    return Response.json(
      { ok: false, reason: "bad-password" },
      { status: 401 },
    );
  }

  const cookie = await mintViewCookie(claims.jti);

  return Response.json(
    { ok: true },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": `${VIEW_COOKIE_NAME}=${cookie}; ${viewCookieAttributes(token)}`,
      },
    },
  );
}
