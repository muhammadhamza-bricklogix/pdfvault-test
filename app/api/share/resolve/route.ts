import type { NextRequest } from "next/server";

import { resolveShare } from "@/lib/server/share/resolve-share";
import {
  mintViewCookie,
  viewCookieAttributes,
  VIEW_COOKIE_NAME,
} from "@/lib/server/share/view-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/share/resolve?t=<token>
 *
 * Public — no auth. Verifies token signature, expiry, and revocation.
 * Returns share metadata (NOT the bytes) for the viewer page to
 * render. For password-less shares we also mint a `share_view` cookie
 * here so the viewer can fetch bytes immediately.
 *
 * Response:
 *   { ok: true, name, expiresAt, requiresPassword }
 *   { ok: false, reason: "not-found" | "expired" | "revoked" | "malformed" }
 */
export async function GET(req: NextRequest): Promise<Response> {
  const token = req.nextUrl.searchParams.get("t");
  const result = await resolveShare(token);

  if (!result.ok) {
    const status =
      result.reason === "not-found"
        ? 404
        : result.reason === "expired" || result.reason === "revoked"
          ? 410
          : 400;

    return Response.json({ ok: false, reason: result.reason } as const, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const headers: Record<string, string> = { "Cache-Control": "no-store" };

  // Password-less shares: mint the view cookie now so the viewer can
  // pull bytes without an extra round-trip.
  if (!result.requiresPassword && token) {
    const cookie = await mintViewCookie(result.jti);

    headers["Set-Cookie"] =
      `${VIEW_COOKIE_NAME}=${cookie}; ${viewCookieAttributes(token)}`;
  }

  return Response.json(
    {
      ok: true,
      name: result.name,
      expiresAt: result.expiresAt,
      requiresPassword: result.requiresPassword,
    } as const,
    { status: 200, headers },
  );
}
